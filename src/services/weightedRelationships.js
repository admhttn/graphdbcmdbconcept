/**
 * Weighted Relationships Service
 *
 * Provides utilities for calculating, managing, and querying weighted relationships
 * in the CMDB graph database.
 *
 * Weighted relationships add numeric properties to edges that represent:
 * - Criticality Score: How important is this dependency (0.0 - 1.0)
 * - Load Factor: Percentage of traffic/load through this path (0-100)
 * - Redundancy Level: Number of alternative paths (1-N)
 * - Latency Weight: Network latency or processing delay (ms)
 */

const { runReadQuery, runWriteQuery } = require('./neo4j');
const neo4j = require('neo4j-driver');

// Criticality mapping constants
const CRITICALITY_SCORES = {
  'CRITICAL': 1.0,
  'HIGH': 0.75,
  'MEDIUM': 0.5,
  'LOW': 0.25,
  'INFO': 0.1
};

/**
 * Calculate relationship criticality score based on multiple factors
 *
 * @param {Object} params - Calculation parameters
 * @param {number} params.sourceCriticality - Source CI criticality (0.0-1.0)
 * @param {number} params.targetCriticality - Target CI criticality (0.0-1.0)
 * @param {number} params.businessImpact - Revenue impact if this fails (0.0-1.0)
 * @param {number} params.redundancyLevel - Number of alternative paths (higher = lower criticality)
 * @param {number} params.historicalFailures - Number of past failures on this path
 * @param {number} params.recoveryComplexity - How hard to recover (0.0=easy, 1.0=very hard)
 * @returns {number} Criticality score (0.0 - 1.0)
 */
function calculateCriticalityScore({
  sourceCriticality = 0.5,
  targetCriticality = 0.5,
  businessImpact = 0.5,
  redundancyLevel = 1,
  historicalFailures = 0,
  recoveryComplexity = 0.5
}) {
  const weights = {
    ciCriticality: 0.30,      // 30% weight on CI criticality
    businessImpact: 0.25,     // 25% weight on business impact
    redundancy: 0.15,         // 15% weight on redundancy (inverse)
    reliability: 0.20,        // 20% weight on historical reliability
    recovery: 0.10            // 10% weight on recovery complexity
  };

  const avgCriticality = (sourceCriticality + targetCriticality) / 2;
  const redundancyFactor = 1 / Math.max(redundancyLevel, 1); // Inverse relationship
  const reliabilityFactor = Math.min(historicalFailures / 100, 1.0); // Normalize to 0-1

  const score = (
    avgCriticality * weights.ciCriticality +
    businessImpact * weights.businessImpact +
    redundancyFactor * weights.redundancy +
    reliabilityFactor * weights.reliability +
    recoveryComplexity * weights.recovery
  );

  return Math.min(Math.max(score, 0.0), 1.0); // Clamp to 0.0-1.0
}

/**
 * Calculate load distribution across relationship paths
 *
 * @param {Object} params - Load parameters
 * @param {number} params.requestsPerSecond - Actual RPS through this path
 * @param {number} params.totalCapacity - Total RPS capacity
 * @param {number} params.peakLoadHistory - Historical peak load
 * @param {number} params.loadBalancingWeight - Manual load balancing configuration (0-100)
 * @returns {number} Load percentage (0-100)
 */
function calculateLoadFactor({
  requestsPerSecond = 0,
  totalCapacity = 1,
  peakLoadHistory = 0,
  loadBalancingWeight = 50
}) {
  const utilization = (requestsPerSecond / totalCapacity) * 100;
  const historicalFactor = (peakLoadHistory / totalCapacity) * 100;

  // Blend current utilization with historical peak and manual weights
  const loadFactor = (
    utilization * 0.5 +
    historicalFactor * 0.3 +
    loadBalancingWeight * 0.2
  );

  return Math.min(Math.max(loadFactor, 0), 100);
}

/**
 * Calculate overall relationship weight from multiple factors
 *
 * @param {Object} params - Weight calculation parameters
 * @returns {number} Overall weight (0.0 - 1.0)
 */
function calculateRelationshipWeight({
  criticalityScore = 0.5,
  loadFactor = 50,
  latencyMs = 0,
  maxLatencyMs = 1000,
  redundancyLevel = 1
}) {
  // Normalize load factor to 0-1
  const normalizedLoad = loadFactor / 100;

  // Normalize latency to 0-1 (inverse - lower latency = higher weight)
  const latencyFactor = latencyMs > 0 ? Math.max(1 - (latencyMs / maxLatencyMs), 0) : 1.0;

  // Normalize redundancy to 0-1 (inverse - more redundancy = lower weight)
  const redundancyFactor = 1 / Math.max(redundancyLevel, 1);

  // Weighted combination
  const weight = (
    criticalityScore * 0.4 +
    normalizedLoad * 0.3 +
    latencyFactor * 0.2 +
    redundancyFactor * 0.1
  );

  return Math.min(Math.max(weight, 0.0), 1.0);
}

/**
 * Convert criticality string to numeric score
 *
 * @param {string} criticality - Criticality level (CRITICAL, HIGH, MEDIUM, LOW, INFO)
 * @returns {number} Numeric score (0.0-1.0)
 */
function criticalityToScore(criticality) {
  return CRITICALITY_SCORES[criticality] || 0.5;
}

/**
 * Convert numeric score to criticality string
 *
 * @param {number} score - Numeric score (0.0-1.0)
 * @returns {string} Criticality level
 */
function scoreToCriticality(score) {
  if (score >= 0.9) return 'CRITICAL';
  if (score >= 0.7) return 'HIGH';
  if (score >= 0.4) return 'MEDIUM';
  if (score >= 0.2) return 'LOW';
  return 'INFO';
}

/**
 * Create or update a weighted relationship between two CIs
 *
 * @param {Object} params - Relationship parameters
 * @param {string} params.fromId - Source CI ID
 * @param {string} params.toId - Target CI ID
 * @param {string} params.type - Relationship type (DEPENDS_ON, RUNS_ON, etc.)
 * @param {Object} params.properties - Relationship properties
 * @returns {Promise<Object>} Created/updated relationship
 */
async function createWeightedRelationship({ fromId, toId, type, properties = {} }) {
  const {
    weight = 0.5,
    criticality = 'MEDIUM',
    criticalityScore = criticalityToScore(criticality),
    loadFactor = 50,
    redundancyLevel = 1,
    latencyMs = 0,
    bandwidthMbps = 0,
    costPerHour = 0,
    confidence = 0.8,
    source = 'manual'
  } = properties;

  const cypher = `
    MATCH (from:ConfigurationItem {id: $fromId})
    MATCH (to:ConfigurationItem {id: $toId})
    MERGE (from)-[r:${type}]->(to)
    SET r.weight = $weight,
        r.criticality = $criticality,
        r.criticalityScore = $criticalityScore,
        r.loadFactor = $loadFactor,
        r.redundancyLevel = $redundancyLevel,
        r.latencyMs = $latencyMs,
        r.bandwidthMbps = $bandwidthMbps,
        r.costPerHour = $costPerHour,
        r.confidence = $confidence,
        r.source = $source,
        r.lastUpdated = datetime()
    RETURN r, from.name as fromName, to.name as toName, type(r) as relType
  `;

  const result = await runWriteQuery(cypher, {
    fromId,
    toId,
    weight,
    criticality,
    criticalityScore,
    loadFactor,
    redundancyLevel,
    latencyMs,
    bandwidthMbps,
    costPerHour,
    confidence,
    source
  });

  if (result.length === 0) {
    throw new Error(`Could not create relationship: CIs not found (${fromId}, ${toId})`);
  }

  return {
    from: fromId,
    to: toId,
    type: result[0].relType,
    properties: result[0].r.properties,
    fromName: result[0].fromName,
    toName: result[0].toName
  };
}

/**
 * Get weighted relationship between two CIs
 *
 * @param {string} fromId - Source CI ID
 * @param {string} toId - Target CI ID
 * @param {string} type - Relationship type
 * @returns {Promise<Object|null>} Relationship or null if not found
 */
async function getWeightedRelationship(fromId, toId, type) {
  const cypher = `
    MATCH (from:ConfigurationItem {id: $fromId})-[r:${type}]->(to:ConfigurationItem {id: $toId})
    RETURN r, from.name as fromName, to.name as toName, type(r) as relType
  `;

  const result = await runReadQuery(cypher, { fromId, toId });

  if (result.length === 0) {
    return null;
  }

  return {
    from: fromId,
    to: toId,
    type: result[0].relType,
    properties: result[0].r.properties,
    fromName: result[0].fromName,
    toName: result[0].toName
  };
}

/**
 * Find shortest weighted path between two CIs using Dijkstra's algorithm
 *
 * @param {string} startId - Starting CI ID
 * @param {string} endId - Target CI ID
 * @param {Object} options - Search options
 * @param {string} options.weightProperty - Property to use as weight (default: 'weight')
 * @param {number} options.maxDepth - Maximum path depth (default: 10)
 * @returns {Promise<Object>} Path information
 */
async function findShortestWeightedPath(startId, endId, options = {}) {
  const { weightProperty = 'criticalityScore', maxDepth = 10 } = options;

  const cypher = `
    MATCH (start:ConfigurationItem {id: $startId})
    MATCH (end:ConfigurationItem {id: $endId})
    MATCH path = shortestPath((start)-[*1..${maxDepth}]->(end))
    WITH path, relationships(path) as rels, nodes(path) as nodes

    WITH path, rels, nodes,
         reduce(totalWeight = 0.0, r IN rels |
           totalWeight + coalesce(r.${weightProperty}, 0.5)
         ) as totalWeight

    RETURN
      [node IN nodes | {id: node.id, name: node.name, type: node.type}] as pathNodes,
      [rel IN rels | {type: type(rel), weight: rel.${weightProperty}}] as pathRelationships,
      totalWeight,
      length(path) as hops
    ORDER BY totalWeight DESC
    LIMIT 1
  `;

  const result = await runReadQuery(cypher, { startId, endId });

  if (result.length === 0) {
    return null;
  }

  return {
    start: startId,
    end: endId,
    pathNodes: result[0].pathNodes,
    pathRelationships: result[0].pathRelationships,
    totalWeight: result[0].totalWeight,
    hops: result[0].hops,
    weightProperty
  };
}

/**
 * Find all paths between CIs, ranked by total weight
 *
 * @param {string} startId - Starting CI ID
 * @param {string} endId - Target CI ID
 * @param {Object} options - Search options
 * @param {number} options.maxDepth - Maximum path depth (default: 6)
 * @param {number} options.limit - Maximum number of paths to return (default: 10)
 * @param {string} options.weightProperty - Property to use as weight (default: 'criticalityScore')
 * @returns {Promise<Array>} Array of paths ranked by weight
 */
async function findAllWeightedPaths(startId, endId, options = {}) {
  const { maxDepth = 6, limit = 10, weightProperty = 'criticalityScore' } = options;

  const cypher = `
    MATCH path = (start:ConfigurationItem {id: $startId})
                 -[rels:DEPENDS_ON|RUNS_ON|SUPPORTS|USES*1..${maxDepth}]->
                 (end:ConfigurationItem {id: $endId})
    WITH path, rels, nodes(path) as nodes,
         reduce(totalWeight = 0.0, r IN rels |
           totalWeight + coalesce(r.${weightProperty}, 0.5)
         ) as totalWeight,
         reduce(totalLoad = 0, r IN rels |
           totalLoad + coalesce(r.loadFactor, 50)
         ) as totalLoad
    RETURN
      [node IN nodes | {id: node.id, name: node.name, type: node.type}] as pathNodes,
      [rel IN rels | {
        type: type(rel),
        weight: rel.${weightProperty},
        criticality: rel.criticality,
        loadFactor: rel.loadFactor
      }] as pathRelationships,
      totalWeight,
      totalLoad / size(rels) as avgLoad,
      length(path) as hops
    ORDER BY totalWeight DESC, hops ASC
    LIMIT $limit
  `;

  const result = await runReadQuery(cypher, { startId, endId, limit: neo4j.int(limit) });

  return result.map(r => ({
    start: startId,
    end: endId,
    pathNodes: r.pathNodes,
    pathRelationships: r.pathRelationships,
    totalWeight: r.totalWeight,
    averageLoad: r.avgLoad,
    hops: r.hops
  }));
}

/**
 * Calculate criticality rankings for all CIs based on weighted relationships
 * Uses a PageRank-style algorithm where weight flows through relationships
 *
 * @param {Object} options - Ranking options
 * @param {number} options.limit - Maximum number of results (default: 20)
 * @param {string} options.weightProperty - Property to use as weight (default: 'criticalityScore')
 * @returns {Promise<Array>} Array of CIs with criticality rankings
 */
async function calculateCriticalityRankings(options = {}) {
  const { limit = 20, weightProperty = 'criticalityScore' } = options;

  const cypher = `
    MATCH (ci:ConfigurationItem)
    OPTIONAL MATCH (ci)-[r:DEPENDS_ON|RUNS_ON|SUPPORTS]->()
    WITH ci,
         count(r) as outboundCount,
         avg(coalesce(r.${weightProperty}, 0.5)) as avgOutboundWeight
    OPTIONAL MATCH ()-[r2:DEPENDS_ON|RUNS_ON|SUPPORTS]->(ci)
    WITH ci, outboundCount, avgOutboundWeight,
         count(r2) as inboundCount,
         avg(coalesce(r2.${weightProperty}, 0.5)) as avgInboundWeight

    WITH ci,
         (inboundCount * avgInboundWeight * 0.6 +
          outboundCount * avgOutboundWeight * 0.4) as criticalityRank,
         inboundCount,
         outboundCount,
         avgInboundWeight,
         avgOutboundWeight

    WHERE criticalityRank > 0
    RETURN
      ci.id as id,
      ci.name as name,
      ci.type as type,
      ci.criticality as ciCriticality,
      criticalityRank,
      inboundCount,
      outboundCount,
      avgInboundWeight,
      avgOutboundWeight
    ORDER BY criticalityRank DESC
    LIMIT $limit
  `;

  const result = await runReadQuery(cypher, { limit: neo4j.int(limit) });

  return result.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    ciCriticality: r.ciCriticality,
    criticalityRank: r.criticalityRank,
    inboundDependencies: r.inboundCount,
    outboundDependencies: r.outboundCount,
    avgInboundWeight: r.avgInboundWeight,
    avgOutboundWeight: r.avgOutboundWeight
  }));
}

/**
 * Automatically calculate and update weights for all relationships of a given type
 *
 * @param {string} relationshipType - Type of relationship to update
 * @param {Object} options - Calculation options
 * @returns {Promise<Object>} Update statistics
 */
async function autoCalculateWeights(relationshipType = 'DEPENDS_ON', options = {}) {
  const cypher = `
    MATCH (from:ConfigurationItem)-[r:${relationshipType}]->(to:ConfigurationItem)
    WHERE r.weight IS NULL OR r.source = 'automated'

    WITH from, r, to,
         coalesce(from.criticality, 'MEDIUM') as fromCrit,
         coalesce(to.criticality, 'MEDIUM') as toCrit

    WITH from, r, to,
         CASE fromCrit
           WHEN 'CRITICAL' THEN 1.0
           WHEN 'HIGH' THEN 0.75
           WHEN 'MEDIUM' THEN 0.5
           WHEN 'LOW' THEN 0.25
           ELSE 0.1
         END as fromScore,
         CASE toCrit
           WHEN 'CRITICAL' THEN 1.0
           WHEN 'HIGH' THEN 0.75
           WHEN 'MEDIUM' THEN 0.5
           WHEN 'LOW' THEN 0.25
           ELSE 0.1
         END as toScore

    WITH from, r, to,
         (fromScore + toScore) / 2 as avgCriticality

    SET r.criticalityScore = avgCriticality,
        r.weight = avgCriticality,
        r.criticality = CASE
          WHEN avgCriticality >= 0.9 THEN 'CRITICAL'
          WHEN avgCriticality >= 0.7 THEN 'HIGH'
          WHEN avgCriticality >= 0.4 THEN 'MEDIUM'
          ELSE 'LOW'
        END,
        r.source = 'automated',
        r.confidence = 0.8,
        r.lastUpdated = datetime()

    RETURN count(r) as updatedCount
  `;

  const result = await runWriteQuery(cypher);

  return {
    relationshipType,
    updatedCount: result[0]?.updatedCount || 0,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  calculateCriticalityScore,
  calculateLoadFactor,
  calculateRelationshipWeight,
  criticalityToScore,
  scoreToCriticality,
  createWeightedRelationship,
  getWeightedRelationship,
  findShortestWeightedPath,
  findAllWeightedPaths,
  calculateCriticalityRankings,
  autoCalculateWeights,
  CRITICALITY_SCORES
};
