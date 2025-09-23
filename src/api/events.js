const express = require('express');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const neo4j = require('neo4j-driver');
const { runReadQuery, runWriteQuery } = require('../services/neo4j');

const router = express.Router();

// Get all events
router.get('/', async (req, res) => {
  try {
    const { severity, limit = 100, since } = req.query;
    let cypher = 'MATCH (e:Event)';
    let params = { limit: neo4j.int(Math.floor(parseInt(limit, 10)) || 100) };

    const conditions = [];
    if (severity) {
      conditions.push('e.severity = $severity');
      params.severity = severity;
    }
    if (since) {
      conditions.push('e.timestamp >= datetime($since)');
      params.since = since;
    }

    if (conditions.length > 0) {
      cypher += ' WHERE ' + conditions.join(' AND ');
    }

    cypher += ' RETURN e ORDER BY e.timestamp DESC LIMIT $limit';

    const events = await runReadQuery(cypher, params);
    res.json(events.map(event => event.e.properties));
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Create new event
router.post('/', async (req, res) => {
  try {
    const {
      source,
      message,
      severity = 'INFO',
      ciId,
      eventType = 'ALERT',
      metadata = {}
    } = req.body;

    if (!source || !message) {
      return res.status(400).json({ error: 'Source and message are required' });
    }

    const id = uuidv4();
    const timestamp = new Date().toISOString();

    const eventData = {
      id,
      source,
      message,
      severity,
      eventType,
      timestamp,
      status: 'OPEN',
      metadata: typeof metadata === 'object' ? JSON.stringify(metadata) : metadata,
      correlationScore: 0.0
    };

    let cypher = 'CREATE (e:Event $eventData)';
    let params = { eventData };

    // Link to CI if provided
    if (ciId) {
      cypher = `
        MATCH (ci:ConfigurationItem {id: $ciId})
        CREATE (e:Event $eventData)
        CREATE (e)-[:AFFECTS]->(ci)
        RETURN e, ci.name as ciName
      `;
      params.ciId = ciId;
    } else {
      cypher += ' RETURN e';
    }

    const result = await runWriteQuery(cypher, params);

    const response = {
      ...result[0].e.properties,
      affectedCI: result[0].ciName || null
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Get events affecting specific CI
router.get('/ci/:ciId', async (req, res) => {
  try {
    const { ciId } = req.params;
    const { limit = 50 } = req.query;

    const cypher = `
      MATCH (ci:ConfigurationItem {id: $ciId})
      MATCH (e:Event)-[:AFFECTS]->(ci)
      RETURN e, ci.name as ciName
      ORDER BY e.timestamp DESC
      LIMIT $limit
    `;

    const result = await runReadQuery(cypher, { ciId, limit: Math.floor(parseInt(limit, 10)) || 50 });

    res.json(result.map(item => ({
      ...item.e.properties,
      affectedCI: item.ciName
    })));
  } catch (error) {
    console.error('Error fetching CI events:', error);
    res.status(500).json({ error: 'Failed to fetch events for CI' });
  }
});

// Update event status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const cypher = `
      MATCH (e:Event {id: $id})
      SET e.status = $status,
          e.updatedAt = datetime()
      ${notes ? ', e.notes = $notes' : ''}
      RETURN e
    `;

    const params = { id, status };
    if (notes) params.notes = notes;

    const result = await runWriteQuery(cypher, params);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(result[0].e.properties);
  } catch (error) {
    console.error('Error updating event status:', error);
    res.status(500).json({ error: 'Failed to update event status' });
  }
});

// Get event statistics
router.get('/stats', async (req, res) => {
  try {
    const { period = '24h' } = req.query;

    let timeFilter = '';
    switch (period) {
      case '1h':
        timeFilter = 'datetime() - duration("PT1H")';
        break;
      case '24h':
        timeFilter = 'datetime() - duration("P1D")';
        break;
      case '7d':
        timeFilter = 'datetime() - duration("P7D")';
        break;
      default:
        timeFilter = 'datetime() - duration("P1D")';
    }

    const cypher = `
      MATCH (e:Event)
      WHERE datetime(e.timestamp) >= ${timeFilter}
      RETURN
        count(e) as totalEvents,
        count(CASE WHEN e.severity = 'CRITICAL' THEN 1 END) as critical,
        count(CASE WHEN e.severity = 'HIGH' THEN 1 END) as high,
        count(CASE WHEN e.severity = 'MEDIUM' THEN 1 END) as medium,
        count(CASE WHEN e.severity = 'LOW' THEN 1 END) as low,
        count(CASE WHEN e.severity = 'INFO' THEN 1 END) as info,
        count(CASE WHEN e.status = 'OPEN' THEN 1 END) as open,
        count(CASE WHEN e.status = 'ACKNOWLEDGED' THEN 1 END) as acknowledged,
        count(CASE WHEN e.status = 'RESOLVED' THEN 1 END) as resolved
    `;

    const result = await runReadQuery(cypher);
    const stats = result[0] || {};

    // Convert Neo4j integers to regular numbers
    const convertedStats = {};
    for (const [key, value] of Object.entries(stats)) {
      if (value && typeof value === 'object' && 'low' in value) {
        convertedStats[key] = value.low; // Convert Neo4j integer to JavaScript number
      } else {
        convertedStats[key] = value;
      }
    }

    res.json(convertedStats);
  } catch (error) {
    console.error('Error fetching event statistics:', error);
    res.status(500).json({ error: 'Failed to fetch event statistics' });
  }
});

// Simulate real-time events for demo
router.post('/simulate', async (req, res) => {
  try {
    const eventTemplates = [
      {
        source: 'monitoring.cpu',
        message: 'High CPU utilization detected',
        severity: 'HIGH',
        eventType: 'PERFORMANCE'
      },
      {
        source: 'monitoring.memory',
        message: 'Memory usage threshold exceeded',
        severity: 'MEDIUM',
        eventType: 'PERFORMANCE'
      },
      {
        source: 'network.switch',
        message: 'Network interface down',
        severity: 'CRITICAL',
        eventType: 'AVAILABILITY'
      },
      {
        source: 'database.mysql',
        message: 'Slow query detected',
        severity: 'MEDIUM',
        eventType: 'PERFORMANCE'
      },
      {
        source: 'application.api',
        message: 'API response time degraded',
        severity: 'HIGH',
        eventType: 'PERFORMANCE'
      }
    ];

    const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];

    // Get random CI to associate with event
    const ciResult = await runReadQuery(`
      MATCH (ci:ConfigurationItem)
      RETURN ci.id as id
      ORDER BY rand()
      LIMIT 1
    `);

    const eventData = {
      ...template,
      ciId: ciResult.length > 0 ? ciResult[0].id : null
    };

    // Create the event using the existing POST endpoint logic
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    const fullEventData = {
      id,
      ...eventData,
      timestamp,
      status: 'OPEN',
      metadata: JSON.stringify({ simulated: true }),
      correlationScore: Math.random()
    };

    let cypher = 'CREATE (e:Event $eventData)';
    let params = { eventData: fullEventData };

    if (eventData.ciId) {
      cypher = `
        MATCH (ci:ConfigurationItem {id: $ciId})
        CREATE (e:Event $eventData)
        CREATE (e)-[:AFFECTS]->(ci)
        RETURN e, ci.name as ciName
      `;
      params.ciId = eventData.ciId;
    } else {
      cypher += ' RETURN e';
    }

    const result = await runWriteQuery(cypher, params);

    res.status(201).json({
      ...result[0].e.properties,
      affectedCI: result[0].ciName || null
    });
  } catch (error) {
    console.error('Error simulating event:', error);
    res.status(500).json({ error: 'Failed to simulate event' });
  }
});

// Clear all events (for demo purposes)
router.delete('/clear', async (req, res) => {
  try {
    const cypher = 'MATCH (e:Event) DETACH DELETE e';
    await runWriteQuery(cypher);

    res.json({
      message: 'All events cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing events:', error);
    res.status(500).json({ error: 'Failed to clear events' });
  }
});

module.exports = router;