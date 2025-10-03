/**
 * Conditional Relationships API Routes
 *
 * REST API for conditional dependency management
 *
 * Endpoints:
 * - POST   /api/relationships/conditional              - Create conditional relationship
 * - GET    /api/relationships/conditional/active       - Get active conditional relationships
 * - POST   /api/relationships/conditional/simulate     - Simulate what-if scenario
 * - GET    /api/cmdb/failover-plan/:ciId               - Get failover plan for CI
 * - POST   /api/relationships/conditional/:id/activate - Manually activate relationship
 * - POST   /api/relationships/conditional/:id/deactivate - Manually deactivate relationship
 * - GET    /api/relationships/conditional/stats        - Get conditional relationship statistics
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  createConditionalRelationship,
  getActiveConditionalRelationships,
  generateFailoverPlan,
  simulateConditionActivation,
  getEngine
} = require('../services/conditionalDependencies');

// Rate limiters
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many read requests, please try again later'
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many write requests, please try again later'
});

const expensiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many expensive requests, please try again later'
});

/**
 * POST /api/relationships/conditional
 * Create a new conditional relationship
 *
 * Body:
 * {
 *   "from": "db-primary-001",
 *   "to": "db-standby-001",
 *   "type": "FAILS_OVER_TO",
 *   "conditionType": "health-based",
 *   "activationCondition": {
 *     "primaryHealth": "FAILED",
 *     "failureThreshold": 3,
 *     "gracePeriodSeconds": 30
 *   },
 *   "priority": 1,
 *   "automaticFailover": true,
 *   "properties": {
 *     "rpoMinutes": 5,
 *     "rtoMinutes": 2
 *   }
 * }
 */
router.post('/conditional', writeLimiter, async (req, res) => {
  try {
    const {
      from,
      to,
      type,
      conditionType,
      activationCondition,
      priority = 1,
      automaticFailover = true,
      properties = {}
    } = req.body;

    // Validation
    if (!from || !to || !type || !conditionType || !activationCondition) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['from', 'to', 'type', 'conditionType', 'activationCondition']
      });
    }

    // Validate condition type
    const validConditionTypes = ['health-based', 'load-based', 'scheduled', 'manual'];
    if (!validConditionTypes.includes(conditionType)) {
      return res.status(400).json({
        error: 'Invalid condition type',
        provided: conditionType,
        valid: validConditionTypes
      });
    }

    // Validate relationship type for conditional
    const validTypes = ['FAILS_OVER_TO', 'SCALES_TO', 'DELEGATES_TO', 'DEPENDS_ON'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid conditional relationship type',
        provided: type,
        valid: validTypes
      });
    }

    const relationship = await createConditionalRelationship({
      from,
      to,
      type,
      conditionType,
      activationCondition,
      priority,
      automaticFailover,
      properties
    });

    res.status(201).json({
      success: true,
      relationship,
      message: 'Conditional relationship created successfully'
    });

  } catch (error) {
    console.error('Error creating conditional relationship:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'One or both CIs not found',
        details: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to create conditional relationship',
      details: error.message
    });
  }
});

/**
 * GET /api/relationships/conditional/active
 * Get all currently active conditional relationships
 */
router.get('/conditional/active', readLimiter, async (req, res) => {
  try {
    const activeRelationships = await getActiveConditionalRelationships();

    res.json({
      count: activeRelationships.length,
      relationships: activeRelationships
    });

  } catch (error) {
    console.error('Error fetching active conditional relationships:', error);
    res.status(500).json({
      error: 'Failed to fetch active relationships',
      details: error.message
    });
  }
});

/**
 * POST /api/relationships/conditional/simulate
 * Simulate what-if scenario for conditional activation
 *
 * Body:
 * {
 *   "ciId": "db-primary-001",
 *   "stateChanges": {
 *     "status": "FAILED",
 *     "currentLoad": 95
 *   }
 * }
 */
router.post('/conditional/simulate', expensiveLimiter, async (req, res) => {
  try {
    const { ciId, stateChanges } = req.body;

    if (!ciId || !stateChanges) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['ciId', 'stateChanges']
      });
    }

    const simulation = await simulateConditionActivation({
      ciId,
      stateChanges
    });

    res.json({
      success: true,
      simulation
    });

  } catch (error) {
    console.error('Error simulating condition activation:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'CI not found',
        details: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to simulate condition',
      details: error.message
    });
  }
});

/**
 * GET /api/cmdb/failover-plan/:ciId
 * Get failover plan for a specific CI
 */
router.get('/failover-plan/:ciId', expensiveLimiter, async (req, res) => {
  try {
    const { ciId } = req.params;

    const plan = await generateFailoverPlan(ciId);

    if (!plan.found) {
      return res.status(404).json({
        ciId,
        found: false,
        message: plan.message
      });
    }

    res.json({
      ciId,
      plan
    });

  } catch (error) {
    console.error('Error generating failover plan:', error);
    res.status(500).json({
      error: 'Failed to generate failover plan',
      details: error.message
    });
  }
});

/**
 * POST /api/relationships/conditional/:id/activate
 * Manually activate a conditional relationship
 */
router.post('/conditional/:id/activate', writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Manual activation' } = req.body;

    const engine = getEngine();
    await engine.activateRelationship(parseInt(id), {
      reason,
      manual: true
    });

    res.json({
      success: true,
      relationshipId: id,
      message: 'Relationship activated successfully'
    });

  } catch (error) {
    console.error('Error activating relationship:', error);
    res.status(500).json({
      error: 'Failed to activate relationship',
      details: error.message
    });
  }
});

/**
 * POST /api/relationships/conditional/:id/deactivate
 * Manually deactivate a conditional relationship
 */
router.post('/conditional/:id/deactivate', writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Manual deactivation' } = req.body;

    const engine = getEngine();
    await engine.deactivateRelationship(parseInt(id), reason);

    res.json({
      success: true,
      relationshipId: id,
      message: 'Relationship deactivated successfully'
    });

  } catch (error) {
    console.error('Error deactivating relationship:', error);
    res.status(500).json({
      error: 'Failed to deactivate relationship',
      details: error.message
    });
  }
});

/**
 * POST /api/relationships/conditional/evaluate
 * Trigger manual evaluation of all conditional dependencies
 */
router.post('/conditional/evaluate', writeLimiter, async (req, res) => {
  try {
    const engine = getEngine();
    const results = await engine.evaluateConditions();

    res.json({
      success: true,
      evaluation: results,
      message: 'Conditional dependencies evaluated'
    });

  } catch (error) {
    console.error('Error evaluating conditions:', error);
    res.status(500).json({
      error: 'Failed to evaluate conditions',
      details: error.message
    });
  }
});

/**
 * GET /api/relationships/conditional/stats
 * Get conditional relationship statistics
 */
router.get('/conditional/stats', readLimiter, async (req, res) => {
  try {
    const { getDriver } = require('../services/neo4j');
    const driver = getDriver();
    const session = driver.session();

    try {
      const query = `
        MATCH ()-[r]->()
        WHERE r.conditionType IS NOT NULL
        RETURN
          count(r) AS totalConditional,
          count(CASE WHEN r.isActive = true THEN 1 END) AS activeCount,
          count(CASE WHEN r.isActive = false THEN 1 END) AS inactiveCount,
          count(CASE WHEN r.conditionType = 'health-based' THEN 1 END) AS healthBased,
          count(CASE WHEN r.conditionType = 'load-based' THEN 1 END) AS loadBased,
          count(CASE WHEN r.conditionType = 'scheduled' THEN 1 END) AS scheduled,
          count(CASE WHEN r.conditionType = 'manual' THEN 1 END) AS manual,
          sum(coalesce(r.activationCount, 0)) AS totalActivations
      `;

      const result = await session.run(query);
      const record = result.records[0];

      res.json({
        conditional: {
          total: record.get('totalConditional').toNumber(),
          active: record.get('activeCount').toNumber(),
          inactive: record.get('inactiveCount').toNumber(),
          byType: {
            healthBased: record.get('healthBased').toNumber(),
            loadBased: record.get('loadBased').toNumber(),
            scheduled: record.get('scheduled').toNumber(),
            manual: record.get('manual').toNumber()
          },
          totalActivations: record.get('totalActivations').toNumber()
        }
      });

    } finally {
      await session.close();
    }

  } catch (error) {
    console.error('Error fetching conditional stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      details: error.message
    });
  }
});

/**
 * POST /api/relationships/conditional/engine/start
 * Start continuous evaluation engine
 */
router.post('/conditional/engine/start', writeLimiter, async (req, res) => {
  try {
    const { intervalMs = 30000 } = req.body;

    const engine = getEngine();
    engine.startEvaluation(intervalMs);

    res.json({
      success: true,
      message: 'Conditional dependency engine started',
      intervalMs
    });

  } catch (error) {
    console.error('Error starting engine:', error);
    res.status(500).json({
      error: 'Failed to start engine',
      details: error.message
    });
  }
});

/**
 * POST /api/relationships/conditional/engine/stop
 * Stop continuous evaluation engine
 */
router.post('/conditional/engine/stop', writeLimiter, async (req, res) => {
  try {
    const engine = getEngine();
    engine.stopEvaluation();

    res.json({
      success: true,
      message: 'Conditional dependency engine stopped'
    });

  } catch (error) {
    console.error('Error stopping engine:', error);
    res.status(500).json({
      error: 'Failed to stop engine',
      details: error.message
    });
  }
});

module.exports = router;
