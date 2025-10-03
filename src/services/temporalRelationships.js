/**
 * Temporal Relationships Service
 *
 * Provides time-aware relationship management including:
 * - Versioned relationship tracking
 * - Time-travel queries (query topology at any point in time)
 * - Historical change auditing
 * - Future-state planning
 * - Event-driven temporal updates
 *
 * Part of Phase 2: Enhanced Relationship Modeling
 */

const neo4j = require('neo4j-driver');
const { getDriver } = require('./neo4j');

/**
 * Create or update a temporal relationship
 * Implements append-only versioning strategy
 *
 * @param {Object} params - Relationship parameters
 * @param {string} params.from - Source CI ID
 * @param {string} params.to - Target CI ID
 * @param {string} params.type - Relationship type (e.g., 'DEPENDS_ON')
 * @param {Object} params.properties - Relationship properties (including weight, criticality, etc.)
 * @param {Date} params.validFrom - Start of validity period (defaults to now)
 * @param {Date} params.validTo - End of validity period (null = indefinite)
 * @param {string} params.createdBy - User or service creating this relationship
 * @param {string} params.changeReason - Reason for creating/updating this relationship
 * @returns {Promise<Object>} Created relationship with version info
 */
async function createTemporalRelationship({
  from,
  to,
  type,
  properties = {},
  validFrom = new Date(),
  validTo = null,
  createdBy = 'system',
  changeReason = 'Initial creation'
}) {
  const driver = getDriver();
  const session = driver.session();

  try {
    // First, archive any existing active relationship between these CIs
    const archiveQuery = `
      MATCH (source:ConfigurationItem {id: $from})-[r:${type}]->(target:ConfigurationItem {id: $to})
      WHERE r.status = 'ACTIVE'
        AND (r.validTo IS NULL OR r.validTo > datetime())
      SET r.status = 'ARCHIVED',
          r.validTo = $now
      RETURN r.version AS archivedVersion
    `;

    const archiveResult = await session.run(archiveQuery, {
      from,
      to,
      now: neo4j.DateTime.fromStandardDate(new Date())
    });

    const previousVersion = archiveResult.records.length > 0
      ? archiveResult.records[0].get('archivedVersion')
      : 0;

    // Create new versioned relationship
    const createQuery = `
      MATCH (source:ConfigurationItem {id: $from})
      MATCH (target:ConfigurationItem {id: $to})
      CREATE (source)-[r:${type}]->(target)
      SET r.validFrom = $validFrom,
          r.validTo = $validTo,
          r.createdAt = $now,
          r.createdBy = $createdBy,
          r.lastModified = $now,
          r.modifiedBy = $createdBy,
          r.version = $newVersion,
          r.previousVersion = $previousVersion,
          r.status = 'ACTIVE',
          r.changeReason = $changeReason,
          r += $properties
      RETURN r, id(r) AS relId, source.name AS sourceName, target.name AS targetName
    `;

    const result = await session.run(createQuery, {
      from,
      to,
      validFrom: validTo !== null
        ? neo4j.DateTime.fromStandardDate(validFrom)
        : neo4j.DateTime.fromStandardDate(new Date()),
      validTo: validTo !== null ? neo4j.DateTime.fromStandardDate(validTo) : null,
      now: neo4j.DateTime.fromStandardDate(new Date()),
      createdBy,
      changeReason,
      newVersion: previousVersion + 1,
      previousVersion,
      properties
    });

    if (result.records.length === 0) {
      throw new Error(`Could not create relationship: CIs not found (${from}, ${to})`);
    }

    const record = result.records[0];
    const relationship = record.get('r');

    return {
      id: record.get('relId').toString(),
      type,
      from,
      to,
      sourceName: record.get('sourceName'),
      targetName: record.get('targetName'),
      version: relationship.properties.version,
      previousVersion: relationship.properties.previousVersion,
      properties: relationship.properties,
      validFrom: relationship.properties.validFrom,
      validTo: relationship.properties.validTo,
      status: relationship.properties.status,
      changeReason: relationship.properties.changeReason,
      createdBy: relationship.properties.createdBy,
      createdAt: relationship.properties.createdAt
    };

  } finally {
    await session.close();
  }
}

/**
 * Get topology as it existed at a specific point in time
 * "Time-travel" query capability
 *
 * @param {Date} targetDate - The date to query topology for
 * @param {Object} options - Query options
 * @param {string} options.ciId - Optional: specific CI to query from
 * @param {number} options.maxDepth - Maximum relationship depth (default: 3)
 * @param {Array<string>} options.relationshipTypes - Filter by relationship types
 * @returns {Promise<Object>} Topology snapshot at target date
 */
async function getTopologyAtDate(targetDate, options = {}) {
  const {
    ciId = null,
    maxDepth = 3,
    relationshipTypes = []
  } = options;

  const driver = getDriver();
  const session = driver.session();

  try {
    const targetDateTime = neo4j.DateTime.fromStandardDate(targetDate);

    // Build relationship type filter
    const relTypeFilter = relationshipTypes.length > 0
      ? relationshipTypes.map(t => `:${t}`).join('|')
      : '';

    // Query for relationships that were active at the target date
    const query = ciId
      ? `
        MATCH (start:ConfigurationItem {id: $ciId})
        MATCH path = (start)-[r${relTypeFilter}*1..${maxDepth}]-(connected)
        WHERE ALL(rel IN relationships(path) WHERE
          rel.validFrom <= $targetDate
          AND (rel.validTo IS NULL OR rel.validTo >= $targetDate)
          AND rel.status IN ['ACTIVE', 'ARCHIVED']
        )
        WITH DISTINCT connected, relationships(path) AS rels
        RETURN
          connected.id AS id,
          connected.name AS name,
          connected.type AS type,
          connected.status AS status,
          collect(DISTINCT {
            type: type(rels[0]),
            source: startNode(rels[0]).id,
            target: endNode(rels[0]).id,
            properties: properties(rels[0])
          }) AS relationships
      `
      : `
        MATCH (ci:ConfigurationItem)
        OPTIONAL MATCH (ci)-[r${relTypeFilter}]-(connected)
        WHERE r.validFrom <= $targetDate
          AND (r.validTo IS NULL OR r.validTo >= $targetDate)
          AND r.status IN ['ACTIVE', 'ARCHIVED']
        RETURN
          ci.id AS id,
          ci.name AS name,
          ci.type AS type,
          ci.status AS status,
          collect(DISTINCT {
            type: type(r),
            source: startNode(r).id,
            target: endNode(r).id,
            properties: properties(r)
          }) AS relationships
      `;

    const result = await session.run(query, {
      ciId,
      targetDate: targetDateTime
    });

    const nodes = [];
    const edges = [];
    const nodeIds = new Set();

    for (const record of result.records) {
      const nodeId = record.get('id');

      if (!nodeIds.has(nodeId)) {
        nodes.push({
          id: nodeId,
          name: record.get('name'),
          type: record.get('type'),
          status: record.get('status')
        });
        nodeIds.add(nodeId);
      }

      const relationships = record.get('relationships');
      for (const rel of relationships) {
        if (rel.source && rel.target) {
          edges.push({
            type: rel.type,
            source: rel.source,
            target: rel.target,
            properties: rel.properties
          });
        }
      }
    }

    return {
      targetDate: targetDate.toISOString(),
      nodes,
      edges,
      nodeCount: nodes.length,
      edgeCount: edges.length
    };

  } finally {
    await session.close();
  }
}

/**
 * Get complete version history for a specific relationship
 *
 * @param {string} fromId - Source CI ID
 * @param {string} toId - Target CI ID
 * @param {string} relType - Relationship type
 * @returns {Promise<Array>} All versions of this relationship
 */
async function getRelationshipHistory(fromId, toId, relType) {
  const driver = getDriver();
  const session = driver.session();

  try {
    const query = `
      MATCH (source:ConfigurationItem {id: $fromId})-[r:${relType}]->(target:ConfigurationItem {id: $toId})
      WHERE r.status IN ['ACTIVE', 'ARCHIVED']
      RETURN
        r.version AS version,
        r.validFrom AS validFrom,
        r.validTo AS validTo,
        r.status AS status,
        r.changeReason AS changeReason,
        r.createdBy AS createdBy,
        r.createdAt AS createdAt,
        r.modifiedBy AS modifiedBy,
        r.lastModified AS lastModified,
        properties(r) AS properties
      ORDER BY r.version DESC
    `;

    const result = await session.run(query, { fromId, toId });

    return result.records.map(record => ({
      version: record.get('version'),
      validFrom: record.get('validFrom'),
      validTo: record.get('validTo'),
      status: record.get('status'),
      changeReason: record.get('changeReason'),
      createdBy: record.get('createdBy'),
      createdAt: record.get('createdAt'),
      modifiedBy: record.get('modifiedBy'),
      lastModified: record.get('lastModified'),
      properties: record.get('properties')
    }));

  } finally {
    await session.close();
  }
}

/**
 * Update relationship weight and track in history
 * Maintains weightHistory array for trend analysis
 *
 * @param {string} relationshipId - Neo4j relationship ID
 * @param {Object} updates - Properties to update
 * @returns {Promise<Object>} Updated relationship
 */
async function updateRelationshipWithHistory(relationshipId, updates) {
  const driver = getDriver();
  const session = driver.session();

  try {
    const query = `
      MATCH ()-[r]->()
      WHERE id(r) = $relId
      SET r.weightHistory = coalesce(r.weightHistory, []) + [{
        timestamp: $now,
        weight: coalesce($weight, r.weight),
        criticalityScore: coalesce($criticalityScore, r.criticalityScore),
        loadFactor: coalesce($loadFactor, r.loadFactor),
        source: $source
      }],
      r.weight = coalesce($weight, r.weight),
      r.criticalityScore = coalesce($criticalityScore, r.criticalityScore),
      r.loadFactor = coalesce($loadFactor, r.loadFactor),
      r.lastModified = $now,
      r.modifiedBy = $modifiedBy
      RETURN r, properties(r) AS properties
    `;

    const result = await session.run(query, {
      relId: neo4j.int(relationshipId),
      now: neo4j.DateTime.fromStandardDate(new Date()),
      weight: updates.weight || null,
      criticalityScore: updates.criticalityScore || null,
      loadFactor: updates.loadFactor || null,
      source: updates.source || 'manual',
      modifiedBy: updates.modifiedBy || 'system'
    });

    if (result.records.length === 0) {
      throw new Error(`Relationship not found: ${relationshipId}`);
    }

    return {
      id: relationshipId,
      properties: result.records[0].get('properties'),
      updated: true
    };

  } finally {
    await session.close();
  }
}

/**
 * Handle auto-scaling events and update relationship weights temporally
 *
 * @param {Object} event - Scaling event
 * @param {string} event.ciId - CI being scaled
 * @param {number} event.currentLoad - Current load percentage
 * @param {string} event.scalingAction - 'scale-up' or 'scale-down'
 * @param {Date} event.timestamp - Event timestamp
 * @returns {Promise<Array>} Updated relationships
 */
async function handleScalingEvent(event) {
  const { ciId, currentLoad, scalingAction, timestamp = new Date() } = event;

  const driver = getDriver();
  const session = driver.session();

  try {
    // Find relationships affected by scaling
    const query = `
      MATCH (ci:ConfigurationItem {id: $ciId})-[r:DEPENDS_ON|SCALES_TO]-(connected)
      WHERE r.status = 'ACTIVE'
        AND r.activationCondition IS NOT NULL
      RETURN r, id(r) AS relId, type(r) AS relType
    `;

    const result = await session.run(query, { ciId });
    const updates = [];

    for (const record of result.records) {
      const rel = record.get('r');
      const relId = record.get('relId').toString();
      const threshold = rel.properties.activationThreshold || 0.8;

      let newLoadFactor = rel.properties.loadFactor || 50;

      if (currentLoad >= threshold * 100 && scalingAction === 'scale-up') {
        // Increase load factor
        newLoadFactor = Math.min(newLoadFactor * 1.2, 100);
      } else if (currentLoad < threshold * 100 && scalingAction === 'scale-down') {
        // Decrease load factor
        newLoadFactor = Math.max(newLoadFactor * 0.8, 0);
      }

      // Update relationship with history
      await updateRelationshipWithHistory(relId, {
        loadFactor: newLoadFactor,
        source: 'auto-scaling',
        modifiedBy: 'scaling-service'
      });

      updates.push({
        relationshipId: relId,
        oldLoadFactor: rel.properties.loadFactor,
        newLoadFactor,
        timestamp
      });
    }

    return updates;

  } finally {
    await session.close();
  }
}

/**
 * Find relationships expiring soon (for proactive management)
 *
 * @param {number} daysAhead - Look ahead this many days (default: 7)
 * @returns {Promise<Array>} Relationships expiring within timeframe
 */
async function findExpiringRelationships(daysAhead = 7) {
  const driver = getDriver();
  const session = driver.session();

  try {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const query = `
      MATCH (source)-[r]->(target)
      WHERE r.validTo IS NOT NULL
        AND r.validTo > $now
        AND r.validTo < $futureDate
        AND r.status = 'ACTIVE'
      RETURN
        source.id AS sourceId,
        source.name AS sourceName,
        target.id AS targetId,
        target.name AS targetName,
        type(r) AS relType,
        r.validTo AS expiresAt,
        r.version AS version,
        r.changeReason AS changeReason,
        duration.inDays($now, r.validTo).days AS daysUntilExpiry
      ORDER BY r.validTo ASC
    `;

    const result = await session.run(query, {
      now: neo4j.DateTime.fromStandardDate(now),
      futureDate: neo4j.DateTime.fromStandardDate(futureDate)
    });

    return result.records.map(record => ({
      sourceId: record.get('sourceId'),
      sourceName: record.get('sourceName'),
      targetId: record.get('targetId'),
      targetName: record.get('targetName'),
      relationshipType: record.get('relType'),
      expiresAt: record.get('expiresAt'),
      daysUntilExpiry: record.get('daysUntilExpiry'),
      version: record.get('version'),
      changeReason: record.get('changeReason')
    }));

  } finally {
    await session.close();
  }
}

/**
 * Get weight trend data for a relationship
 * Useful for analytics and forecasting
 *
 * @param {string} fromId - Source CI ID
 * @param {string} toId - Target CI ID
 * @param {string} relType - Relationship type
 * @returns {Promise<Object>} Weight trend analysis
 */
async function getWeightTrend(fromId, toId, relType) {
  const driver = getDriver();
  const session = driver.session();

  try {
    const query = `
      MATCH (source:ConfigurationItem {id: $fromId})-[r:${relType}]->(target:ConfigurationItem {id: $toId})
      WHERE r.status = 'ACTIVE'
        AND r.weightHistory IS NOT NULL
      RETURN r.weightHistory AS history,
             r.weight AS currentWeight,
             r.criticalityScore AS currentCriticality,
             r.loadFactor AS currentLoad
    `;

    const result = await session.run(query, { fromId, toId });

    if (result.records.length === 0) {
      return {
        found: false,
        message: 'Relationship not found or has no history'
      };
    }

    const record = result.records[0];
    const history = record.get('history');
    const currentWeight = record.get('currentWeight');

    // Calculate trend statistics
    const weights = history.map(h => h.weight);
    const avgWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);

    // Simple trend direction
    const recentWeights = weights.slice(-5);
    const trend = recentWeights[recentWeights.length - 1] > recentWeights[0]
      ? 'increasing'
      : recentWeights[recentWeights.length - 1] < recentWeights[0]
        ? 'decreasing'
        : 'stable';

    return {
      found: true,
      currentWeight,
      currentCriticality: record.get('currentCriticality'),
      currentLoad: record.get('currentLoad'),
      history,
      statistics: {
        average: avgWeight,
        minimum: minWeight,
        maximum: maxWeight,
        dataPoints: weights.length,
        trend
      }
    };

  } finally {
    await session.close();
  }
}

module.exports = {
  createTemporalRelationship,
  getTopologyAtDate,
  getRelationshipHistory,
  updateRelationshipWithHistory,
  handleScalingEvent,
  findExpiringRelationships,
  getWeightTrend
};
