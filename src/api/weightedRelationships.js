/**
 * Weighted Relationships API
 *
 * REST API endpoints for managing and querying weighted relationships in the CMDB
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  calculateCriticalityScore,
  calculateLoadFactor,
  calculateRelationshipWeight,
  createWeightedRelationship,
  getWeightedRelationship,
  findShortestWeightedPath,
  findAllWeightedPaths,
  calculateCriticalityRankings,
  autoCalculateWeights,
  criticalityToScore,
  scoreToCriticality
} = require('../services/weightedRelationships');

const router = express.Router();

// Rate limiters
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many read requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many write requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const expensiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many expensive requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// ==================== Relationship CRUD Operations ====================

/**
 * POST /api/relationships/weighted
 * Create or update a weighted relationship
 */
router.post('/weighted', writeLimiter, async (req, res) => {
  try {
    const { from, to, type, properties = {} } = req.body;

    if (!from || !to || !type) {
      return res.status(400).json({
        error: 'Missing required fields: from, to, type'
      });
    }

    // Validate relationship type
    const validTypes = ['DEPENDS_ON', 'RUNS_ON', 'SUPPORTS', 'USES', 'HOSTED_IN', 'CONNECTS_TO'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid relationship type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const relationship = await createWeightedRelationship({
      fromId: from,
      toId: to,
      type,
      properties
    });

    res.status(201).json({
      message: 'Weighted relationship created successfully',
      relationship
    });

  } catch (error) {
    console.error('Error creating weighted relationship:', error);
    res.status(500).json({ error: error.message || 'Failed to create weighted relationship' });
  }
});

/**
 * GET /api/relationships/weighted/:fromId/:toId/:type
 * Get a specific weighted relationship
 */
router.get('/weighted/:fromId/:toId/:type', readLimiter, async (req, res) => {
  try {
    const { fromId, toId, type } = req.params;

    const relationship = await getWeightedRelationship(fromId, toId, type);

    if (!relationship) {
      return res.status(404).json({
        error: 'Relationship not found'
      });
    }

    res.json(relationship);

  } catch (error) {
    console.error('Error retrieving weighted relationship:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve relationship' });
  }
});

// ==================== Weight Calculation ====================

/**
 * POST /api/relationships/calculate-weight
 * Calculate relationship weight from component factors
 */
router.post('/calculate-weight', readLimiter, async (req, res) => {
  try {
    const {
      sourceCriticality,
      targetCriticality,
      businessImpact,
      redundancyLevel,
      historicalFailures,
      recoveryComplexity
    } = req.body;

    const criticalityScore = calculateCriticalityScore({
      sourceCriticality: sourceCriticality || criticalityToScore(req.body.sourceCriticalityLevel),
      targetCriticality: targetCriticality || criticalityToScore(req.body.targetCriticalityLevel),
      businessImpact,
      redundancyLevel,
      historicalFailures,
      recoveryComplexity
    });

    const loadFactor = calculateLoadFactor(req.body);

    const weight = calculateRelationshipWeight({
      criticalityScore,
      loadFactor,
      latencyMs: req.body.latencyMs,
      redundancyLevel
    });

    res.json({
      weight,
      criticalityScore,
      criticality: scoreToCriticality(criticalityScore),
      loadFactor,
      breakdown: {
        sourceCriticality: req.body.sourceCriticalityLevel,
        targetCriticality: req.body.targetCriticalityLevel,
        businessImpact,
        redundancyLevel,
        historicalFailures,
        recoveryComplexity
      }
    });

  } catch (error) {
    console.error('Error calculating weight:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate weight' });
  }
});

/**
 * POST /api/relationships/auto-calculate-weights
 * Automatically calculate weights for all relationships of a given type
 */
router.post('/auto-calculate-weights', writeLimiter, async (req, res) => {
  try {
    const { relationshipType = 'DEPENDS_ON' } = req.body;

    const result = await autoCalculateWeights(relationshipType);

    res.json({
      message: 'Weights calculated successfully',
      ...result
    });

  } catch (error) {
    console.error('Error auto-calculating weights:', error);
    res.status(500).json({ error: error.message || 'Failed to auto-calculate weights' });
  }
});

// ==================== Pathfinding & Analysis ====================

/**
 * GET /api/relationships/shortest-path/:startId/:endId
 * Find shortest weighted path between two CIs
 */
router.get('/shortest-path/:startId/:endId', expensiveLimiter, async (req, res) => {
  try {
    const { startId, endId } = req.params;
    const { weightProperty = 'criticalityScore', maxDepth = 10 } = req.query;

    const path = await findShortestWeightedPath(startId, endId, {
      weightProperty,
      maxDepth: parseInt(maxDepth)
    });

    if (!path) {
      return res.status(404).json({
        error: 'No path found between the specified CIs',
        start: startId,
        end: endId
      });
    }

    res.json({
      message: 'Shortest weighted path found',
      path
    });

  } catch (error) {
    console.error('Error finding shortest path:', error);
    res.status(500).json({ error: error.message || 'Failed to find shortest path' });
  }
});

/**
 * GET /api/relationships/all-paths/:startId/:endId
 * Find all weighted paths between two CIs, ranked by total weight
 */
router.get('/all-paths/:startId/:endId', expensiveLimiter, async (req, res) => {
  try {
    const { startId, endId } = req.params;
    const {
      maxDepth = 6,
      limit = 10,
      weightProperty = 'criticalityScore'
    } = req.query;

    const paths = await findAllWeightedPaths(startId, endId, {
      maxDepth: parseInt(maxDepth),
      limit: parseInt(limit),
      weightProperty
    });

    res.json({
      message: `Found ${paths.length} paths`,
      totalPaths: paths.length,
      paths
    });

  } catch (error) {
    console.error('Error finding all paths:', error);
    res.status(500).json({ error: error.message || 'Failed to find paths' });
  }
});

/**
 * GET /api/relationships/criticality-rankings
 * Get criticality rankings for all CIs based on weighted relationships
 */
router.get('/criticality-rankings', expensiveLimiter, async (req, res) => {
  try {
    const { limit = 20, weightProperty = 'criticalityScore' } = req.query;

    const rankings = await calculateCriticalityRankings({
      limit: parseInt(limit),
      weightProperty
    });

    res.json({
      message: `Top ${rankings.length} critical components`,
      totalComponents: rankings.length,
      rankings
    });

  } catch (error) {
    console.error('Error calculating criticality rankings:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate rankings' });
  }
});

// ==================== Batch Operations ====================

/**
 * POST /api/relationships/weighted/batch
 * Create multiple weighted relationships in a single request
 */
router.post('/weighted/batch', writeLimiter, async (req, res) => {
  try {
    const { relationships } = req.body;

    if (!Array.isArray(relationships) || relationships.length === 0) {
      return res.status(400).json({
        error: 'Invalid request: relationships must be a non-empty array'
      });
    }

    if (relationships.length > 100) {
      return res.status(400).json({
        error: 'Batch size too large: maximum 100 relationships per request'
      });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < relationships.length; i++) {
      const rel = relationships[i];
      try {
        const result = await createWeightedRelationship({
          fromId: rel.from,
          toId: rel.to,
          type: rel.type,
          properties: rel.properties || {}
        });
        results.push(result);
      } catch (error) {
        errors.push({
          index: i,
          relationship: rel,
          error: error.message
        });
      }
    }

    res.status(errors.length > 0 ? 207 : 201).json({
      message: `Processed ${relationships.length} relationships`,
      successful: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error creating batch relationships:', error);
    res.status(500).json({ error: error.message || 'Failed to create batch relationships' });
  }
});

// ==================== Utility Endpoints ====================

/**
 * GET /api/relationships/weight-info
 * Get information about weight calculation methods and formulas
 */
router.get('/weight-info', readLimiter, (req, res) => {
  res.json({
    weightCalculation: {
      description: 'Relationship weight is calculated from multiple factors',
      formula: 'weight = (criticalityScore * 0.4) + (normalizedLoad * 0.3) + (latencyFactor * 0.2) + (redundancyFactor * 0.1)',
      factors: {
        criticalityScore: {
          range: '0.0 - 1.0',
          description: 'Calculated from CI criticality, business impact, redundancy, reliability, and recovery complexity',
          weights: {
            ciCriticality: '30%',
            businessImpact: '25%',
            redundancy: '15% (inverse)',
            reliability: '20% (based on historical failures)',
            recovery: '10%'
          }
        },
        loadFactor: {
          range: '0 - 100',
          description: 'Percentage of traffic/load flowing through this relationship',
          formula: 'utilization * 0.5 + historicalPeak * 0.3 + manualWeight * 0.2'
        },
        latencyMs: {
          range: '0+',
          description: 'Network latency or processing delay in milliseconds'
        },
        redundancyLevel: {
          range: '1+',
          description: 'Number of alternative paths (higher = lower weight)'
        }
      }
    },
    criticalityLevels: {
      CRITICAL: 1.0,
      HIGH: 0.75,
      MEDIUM: 0.5,
      LOW: 0.25,
      INFO: 0.1
    },
    supportedRelationshipTypes: [
      'DEPENDS_ON',
      'RUNS_ON',
      'SUPPORTS',
      'USES',
      'HOSTED_IN',
      'CONNECTS_TO'
    ]
  });
});

/**
 * GET /api/relationships/stats
 * Get statistics about weighted relationships in the database
 */
router.get('/stats', readLimiter, async (req, res) => {
  try {
    const { runReadQuery } = require('../services/neo4j');

    const cypher = `
      MATCH ()-[r]->()
      WITH
        count(r) as totalRelationships,
        count(CASE WHEN r.weight IS NOT NULL THEN 1 END) as weightedRelationships,
        avg(r.criticalityScore) as avgCriticality,
        avg(r.loadFactor) as avgLoad,
        avg(r.latencyMs) as avgLatency
      RETURN
        totalRelationships,
        weightedRelationships,
        totalRelationships - weightedRelationships as unweightedRelationships,
        avgCriticality,
        avgLoad,
        avgLatency
    `;

    const result = await runReadQuery(cypher);

    if (result.length === 0) {
      return res.json({
        totalRelationships: 0,
        weightedRelationships: 0,
        unweightedRelationships: 0
      });
    }

    res.json({
      totalRelationships: result[0].totalRelationships,
      weightedRelationships: result[0].weightedRelationships,
      unweightedRelationships: result[0].unweightedRelationships,
      coveragePercentage: (result[0].weightedRelationships / result[0].totalRelationships * 100).toFixed(2),
      averages: {
        criticalityScore: result[0].avgCriticality,
        loadFactor: result[0].avgLoad,
        latencyMs: result[0].avgLatency
      }
    });

  } catch (error) {
    console.error('Error getting relationship stats:', error);
    res.status(500).json({ error: error.message || 'Failed to get statistics' });
  }
});

module.exports = router;
