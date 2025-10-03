/**
 * Temporal Relationships API Routes
 *
 * REST API for time-aware relationship management
 *
 * Endpoints:
 * - POST   /api/relationships/temporal              - Create versioned relationship
 * - GET    /api/relationships/temporal/:from/:to/:type/history - Get relationship history
 * - GET    /api/relationships/temporal/:from/:to/:type/trend   - Get weight trend
 * - GET    /api/cmdb/topology/temporal              - Get topology at specific date
 * - GET    /api/relationships/temporal/expiring     - Find expiring relationships
 * - POST   /api/relationships/temporal/scaling-event - Handle scaling event
 * - PUT    /api/relationships/temporal/:id/update   - Update with history tracking
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  createTemporalRelationship,
  getTopologyAtDate,
  getRelationshipHistory,
  updateRelationshipWithHistory,
  handleScalingEvent,
  findExpiringRelationships,
  getWeightTrend
} = require('../services/temporalRelationships');

// Rate limiters
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many read requests, please try again later'
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 writes per window
  message: 'Too many write requests, please try again later'
});

const expensiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 expensive queries per window
  message: 'Too many expensive requests, please try again later'
});

/**
 * POST /api/relationships/temporal
 * Create a new versioned temporal relationship
 *
 * Body:
 * {
 *   "from": "ci-123",
 *   "to": "ci-456",
 *   "type": "DEPENDS_ON",
 *   "properties": { "weight": 0.85, "criticalityScore": 0.9 },
 *   "validFrom": "2024-01-01T00:00:00Z",
 *   "validTo": null,
 *   "createdBy": "admin-user",
 *   "changeReason": "Database migration"
 * }
 */
router.post('/temporal', writeLimiter, async (req, res) => {
  try {
    const {
      from,
      to,
      type,
      properties = {},
      validFrom,
      validTo,
      createdBy = 'api-user',
      changeReason = 'API request'
    } = req.body;

    // Validation
    if (!from || !to || !type) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['from', 'to', 'type']
      });
    }

    // Validate relationship type
    const validTypes = [
      'DEPENDS_ON',
      'RUNS_ON',
      'HOSTED_IN',
      'SUPPORTS',
      'LOCATED_IN',
      'SCALES_TO',
      'FAILS_OVER_TO'
    ];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid relationship type',
        validTypes
      });
    }

    const relationship = await createTemporalRelationship({
      from,
      to,
      type,
      properties,
      validFrom: validFrom ? new Date(validFrom) : undefined,
      validTo: validTo ? new Date(validTo) : null,
      createdBy,
      changeReason
    });

    res.status(201).json({
      success: true,
      relationship,
      message: 'Temporal relationship created successfully'
    });

  } catch (error) {
    console.error('Error creating temporal relationship:', error);
    res.status(500).json({
      error: 'Failed to create temporal relationship',
      details: error.message
    });
  }
});

/**
 * GET /api/relationships/temporal/:from/:to/:type/history
 * Get complete version history for a relationship
 */
router.get('/temporal/:from/:to/:type/history', readLimiter, async (req, res) => {
  try {
    const { from, to, type } = req.params;

    const history = await getRelationshipHistory(from, to, type);

    res.json({
      from,
      to,
      type,
      versionCount: history.length,
      history
    });

  } catch (error) {
    console.error('Error fetching relationship history:', error);
    res.status(500).json({
      error: 'Failed to fetch relationship history',
      details: error.message
    });
  }
});

/**
 * GET /api/relationships/temporal/:from/:to/:type/trend
 * Get weight trend analysis for a relationship
 */
router.get('/temporal/:from/:to/:type/trend', readLimiter, async (req, res) => {
  try {
    const { from, to, type } = req.params;

    const trend = await getWeightTrend(from, to, type);

    if (!trend.found) {
      return res.status(404).json({
        error: 'Relationship not found or has no history',
        from,
        to,
        type
      });
    }

    res.json({
      from,
      to,
      type,
      trend
    });

  } catch (error) {
    console.error('Error fetching weight trend:', error);
    res.status(500).json({
      error: 'Failed to fetch weight trend',
      details: error.message
    });
  }
});

/**
 * GET /api/cmdb/topology/temporal
 * Query topology as it existed at a specific date (time-travel query)
 *
 * Query params:
 * - date: ISO date string (required)
 * - ciId: Optional starting CI
 * - maxDepth: Maximum relationship depth (default: 3)
 * - relationshipTypes: Comma-separated list of relationship types
 *
 * Example: /api/cmdb/topology/temporal?date=2024-06-01T00:00:00Z&maxDepth=5
 */
router.get('/temporal', expensiveLimiter, async (req, res) => {
  try {
    const { date, ciId, maxDepth, relationshipTypes } = req.query;

    if (!date) {
      return res.status(400).json({
        error: 'Missing required parameter: date',
        example: '/api/cmdb/topology/temporal?date=2024-06-01T00:00:00Z'
      });
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format',
        provided: date,
        expected: 'ISO 8601 format (e.g., 2024-06-01T00:00:00Z)'
      });
    }

    const options = {
      ciId: ciId || null,
      maxDepth: maxDepth ? parseInt(maxDepth) : 3,
      relationshipTypes: relationshipTypes
        ? relationshipTypes.split(',').map(t => t.trim())
        : []
    };

    const topology = await getTopologyAtDate(targetDate, options);

    res.json({
      success: true,
      query: {
        targetDate: date,
        options
      },
      topology
    });

  } catch (error) {
    console.error('Error fetching temporal topology:', error);
    res.status(500).json({
      error: 'Failed to fetch temporal topology',
      details: error.message
    });
  }
});

/**
 * GET /api/relationships/temporal/expiring
 * Find relationships expiring within specified timeframe
 *
 * Query params:
 * - daysAhead: Number of days to look ahead (default: 7)
 *
 * Example: /api/relationships/temporal/expiring?daysAhead=30
 */
router.get('/temporal/expiring', readLimiter, async (req, res) => {
  try {
    const daysAhead = req.query.daysAhead
      ? parseInt(req.query.daysAhead)
      : 7;

    if (daysAhead < 1 || daysAhead > 365) {
      return res.status(400).json({
        error: 'Invalid daysAhead parameter',
        provided: daysAhead,
        allowed: '1-365'
      });
    }

    const expiringRelationships = await findExpiringRelationships(daysAhead);

    res.json({
      daysAhead,
      count: expiringRelationships.length,
      relationships: expiringRelationships
    });

  } catch (error) {
    console.error('Error fetching expiring relationships:', error);
    res.status(500).json({
      error: 'Failed to fetch expiring relationships',
      details: error.message
    });
  }
});

/**
 * POST /api/relationships/temporal/scaling-event
 * Handle auto-scaling event and update relationship weights
 *
 * Body:
 * {
 *   "ciId": "app-123",
 *   "currentLoad": 85,
 *   "scalingAction": "scale-up",
 *   "timestamp": "2024-12-01T10:30:00Z"
 * }
 */
router.post('/temporal/scaling-event', writeLimiter, async (req, res) => {
  try {
    const {
      ciId,
      currentLoad,
      scalingAction,
      timestamp
    } = req.body;

    // Validation
    if (!ciId || currentLoad === undefined || !scalingAction) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['ciId', 'currentLoad', 'scalingAction']
      });
    }

    if (!['scale-up', 'scale-down'].includes(scalingAction)) {
      return res.status(400).json({
        error: 'Invalid scalingAction',
        provided: scalingAction,
        allowed: ['scale-up', 'scale-down']
      });
    }

    const updates = await handleScalingEvent({
      ciId,
      currentLoad,
      scalingAction,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });

    res.json({
      success: true,
      ciId,
      scalingAction,
      updatedRelationships: updates.length,
      updates
    });

  } catch (error) {
    console.error('Error handling scaling event:', error);
    res.status(500).json({
      error: 'Failed to handle scaling event',
      details: error.message
    });
  }
});

/**
 * PUT /api/relationships/temporal/:id/update
 * Update relationship weight with history tracking
 *
 * Body:
 * {
 *   "weight": 0.9,
 *   "criticalityScore": 0.95,
 *   "loadFactor": 80,
 *   "source": "manual",
 *   "modifiedBy": "admin-user"
 * }
 */
router.put('/temporal/:id/update', writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validation
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No updates provided',
        allowedFields: ['weight', 'criticalityScore', 'loadFactor', 'source', 'modifiedBy']
      });
    }

    const result = await updateRelationshipWithHistory(id, updates);

    res.json({
      success: true,
      relationshipId: id,
      result,
      message: 'Relationship updated with history tracking'
    });

  } catch (error) {
    console.error('Error updating relationship:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Relationship not found',
        relationshipId: req.params.id
      });
    }

    res.status(500).json({
      error: 'Failed to update relationship',
      details: error.message
    });
  }
});

/**
 * GET /api/relationships/temporal/stats
 * Get temporal relationship statistics
 */
router.get('/temporal/stats', readLimiter, async (req, res) => {
  try {
    const { getDriver } = require('../services/neo4j');
    const driver = getDriver();
    const session = driver.session();

    try {
      const query = `
        MATCH ()-[r]->()
        WHERE r.version IS NOT NULL
        RETURN
          count(r) AS totalVersionedRelationships,
          count(CASE WHEN r.status = 'ACTIVE' THEN 1 END) AS activeRelationships,
          count(CASE WHEN r.status = 'ARCHIVED' THEN 1 END) AS archivedRelationships,
          max(r.version) AS maxVersion,
          avg(r.version) AS avgVersion,
          count(CASE WHEN r.weightHistory IS NOT NULL THEN 1 END) AS relationshipsWithHistory
      `;

      const result = await session.run(query);
      const record = result.records[0];

      res.json({
        temporal: {
          totalVersionedRelationships: record.get('totalVersionedRelationships').toNumber(),
          activeRelationships: record.get('activeRelationships').toNumber(),
          archivedRelationships: record.get('archivedRelationships').toNumber(),
          maxVersion: record.get('maxVersion'),
          avgVersion: record.get('avgVersion'),
          relationshipsWithHistory: record.get('relationshipsWithHistory').toNumber()
        }
      });

    } finally {
      await session.close();
    }

  } catch (error) {
    console.error('Error fetching temporal stats:', error);
    res.status(500).json({
      error: 'Failed to fetch temporal statistics',
      details: error.message
    });
  }
});

module.exports = router;
