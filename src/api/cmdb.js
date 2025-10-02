const express = require('express');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const neo4j = require('neo4j-driver');
const rateLimit = require('express-rate-limit');
const { runReadQuery, runWriteQuery, initializeDatabase } = require('../services/neo4j');

const router = express.Router();

// Rate limiters for different operation types
// Standard rate limiter for read operations (100 requests per 15 minutes)
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many read requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter rate limiter for write operations (20 requests per 15 minutes)
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 write requests per windowMs
  message: 'Too many write requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Very strict rate limiter for expensive operations like topology and impact analysis (30 requests per 15 minutes)
const expensiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 expensive requests per windowMs
  message: 'Too many expensive requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Extra strict rate limiter for destructive operations (5 requests per 15 minutes)
const destructiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 destructive requests per windowMs
  message: 'Too many destructive requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Initialize database on first load
let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await initializeDatabase();
    initialized = true;
  }
}

// Get comprehensive database statistics
router.get('/database/stats', readLimiter, async (req, res) => {
  try {
    await ensureInitialized();

    // Get comprehensive database metrics in parallel
    const queries = [
      // Node counts by type
      'MATCH (ci:ConfigurationItem) RETURN count(ci) as configItems',
      'MATCH (e:Event) RETURN count(e) as events',
      'MATCH (s:Service) RETURN count(s) as services',

      // Relationship counts
      'MATCH ()-[r]->() RETURN count(r) as totalRelationships',
      'MATCH (ci:ConfigurationItem)-[r]-(connected:ConfigurationItem) RETURN count(DISTINCT r) as ciRelationships',

      // Node type breakdown
      'MATCH (ci:ConfigurationItem) RETURN ci.type as nodeType, count(ci) as count ORDER BY count DESC',

      // Relationship type breakdown
      'MATCH ()-[r]->() RETURN type(r) as relType, count(r) as count ORDER BY count DESC LIMIT 10',

      // Database size approximation (node + relationship counts)
      'MATCH (n) RETURN count(n) as totalNodes',

      // Event statistics by severity
      'MATCH (e:Event) RETURN e.severity as severity, count(e) as count ORDER BY count DESC',

      // Recent activity
      'MATCH (e:Event) WHERE datetime(e.timestamp) >= datetime() - duration("PT1H") RETURN count(e) as recentEvents'
    ];

    const results = await Promise.all(
      queries.map(query => runReadQuery(query).catch(error => {
        console.error(`Query failed: ${query}`, error);
        return [];
      }))
    );

    // Helper function to convert Neo4j integers
    const convertNeo4jInt = (value) => {
      if (value && typeof value === 'object' && 'low' in value) {
        return value.low;
      }
      return value || 0;
    };

    // Process results
    const stats = {
      nodes: {
        configItems: convertNeo4jInt(results[0][0]?.configItems),
        events: convertNeo4jInt(results[1][0]?.events),
        services: convertNeo4jInt(results[2][0]?.services),
        total: convertNeo4jInt(results[7][0]?.totalNodes)
      },
      relationships: {
        total: convertNeo4jInt(results[3][0]?.totalRelationships),
        ciRelationships: convertNeo4jInt(results[4][0]?.ciRelationships)
      },
      nodeTypes: (results[5] || []).map(row => ({
        type: row.nodeType,
        count: convertNeo4jInt(row.count)
      })),
      relationshipTypes: (results[6] || []).map(row => ({
        type: row.relType,
        count: convertNeo4jInt(row.count)
      })),
      eventsBySeverity: (results[8] || []).map(row => ({
        severity: row.severity,
        count: convertNeo4jInt(row.count)
      })),
      activity: {
        recentEvents: convertNeo4jInt(results[9][0]?.recentEvents)
      },
      performance: {
        queryTime: Date.now(), // Will be calculated by client
        lastUpdated: new Date().toISOString()
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching database statistics:', error);
    res.status(500).json({ error: 'Failed to fetch database statistics' });
  }
});

// Clear all demo data
router.delete('/database/clear', destructiveLimiter, async (req, res) => {
  try {
    await ensureInitialized();

    const startTime = Date.now();

    // Clear all data in sequence to avoid constraint issues
    const clearQueries = [
      'MATCH (e:Event) DETACH DELETE e',
      'MATCH (s:Service) DETACH DELETE s',
      'MATCH (ci:ConfigurationItem) DETACH DELETE ci',
      'MATCH (n) DETACH DELETE n' // Clean up any remaining nodes
    ];

    let deletedCounts = {
      events: 0,
      services: 0,
      configItems: 0,
      totalNodes: 0
    };

    for (const query of clearQueries) {
      try {
        await runWriteQuery(query);
      } catch (error) {
        console.error(`Clear query failed: ${query}`, error);
      }
    }

    // Verify cleanup
    const verificationResult = await runReadQuery('MATCH (n) RETURN count(n) as remaining');
    const remaining = verificationResult[0]?.remaining || 0;

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      message: 'Database cleared successfully',
      duration: `${duration}ms`,
      remainingNodes: remaining.low || remaining,
      clearedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({ error: 'Failed to clear database', details: error.message });
  }
});

// Get count of Configuration Items
router.get('/items/count', readLimiter, async (req, res) => {
  try {
    await ensureInitialized();

    const { type } = req.query;
    let cypher = 'MATCH (ci:ConfigurationItem)';
    let params = {};

    if (type) {
      cypher += ' WHERE ci.type = $type';
      params.type = type;
    }

    cypher += ' RETURN count(ci) as total';

    const result = await runReadQuery(cypher, params);
    const count = result[0]?.total;

    // Convert Neo4j integer to regular number
    const totalCount = typeof count === 'object' && count.low !== undefined ? count.low : count;

    res.json({ total: totalCount || 0 });
  } catch (error) {
    console.error('Error fetching CI count:', error);
    res.status(500).json({ error: 'Failed to fetch configuration items count' });
  }
});

// Get all Configuration Items
router.get('/items', readLimiter, async (req, res) => {
  try {
    await ensureInitialized();

    const { type, limit = 50 } = req.query;
    let cypher = 'MATCH (ci:ConfigurationItem)';
    let params = { limit: neo4j.int(Math.floor(parseInt(limit, 10)) || 50) };

    if (type) {
      cypher += ' WHERE ci.type = $type';
      params.type = type;
    }

    cypher += ' RETURN ci ORDER BY ci.name LIMIT $limit';

    const items = await runReadQuery(cypher, params);
    res.json(items.map(item => item.ci.properties));
  } catch (error) {
    console.error('Error fetching CIs:', error);
    res.status(500).json({ error: 'Failed to fetch configuration items' });
  }
});

// Get specific Configuration Item with relationships
router.get('/items/:id', readLimiter, async (req, res) => {
  try {
    await ensureInitialized();

    const { id } = req.params;

    const cypher = `
      MATCH (ci:ConfigurationItem {id: $id})
      OPTIONAL MATCH (ci)-[r]-(related:ConfigurationItem)
      RETURN ci,
             collect(DISTINCT {
               relationship: type(r),
               direction: CASE
                 WHEN startNode(r) = ci THEN 'outgoing'
                 ELSE 'incoming'
               END,
               relatedItem: related.id,
               relatedName: related.name,
               relatedType: related.type
             }) as relationships
    `;

    const result = await runReadQuery(cypher, { id });

    if (result.length === 0) {
      return res.status(404).json({ error: 'Configuration item not found' });
    }

    const item = result[0];
    res.json({
      ...item.ci.properties,
      relationships: item.relationships.filter(rel => rel.relatedItem !== null)
    });
  } catch (error) {
    console.error('Error fetching CI details:', error);
    res.status(500).json({ error: 'Failed to fetch configuration item details' });
  }
});

// Create new Configuration Item
router.post('/items', writeLimiter, async (req, res) => {
  try {
    await ensureInitialized();

    const { name, type, properties = {} } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const ciData = {
      id,
      name,
      type,
      createdAt: now,
      updatedAt: now,
      ...properties
    };

    const cypher = `
      CREATE (ci:ConfigurationItem $ciData)
      RETURN ci
    `;

    const result = await runWriteQuery(cypher, { ciData });
    res.status(201).json(result[0].ci.properties);
  } catch (error) {
    console.error('Error creating CI:', error);
    res.status(500).json({ error: 'Failed to create configuration item' });
  }
});

// Update Configuration Item
router.put('/items/:id', writeLimiter, async (req, res) => {
  try {
    await ensureInitialized();

    const { id } = req.params;
    const updates = { ...req.body };
    delete updates.id; // Don't allow ID updates
    updates.updatedAt = new Date().toISOString();

    const setClause = Object.keys(updates)
      .map(key => `ci.${key} = $updates.${key}`)
      .join(', ');

    const cypher = `
      MATCH (ci:ConfigurationItem {id: $id})
      SET ${setClause}
      RETURN ci
    `;

    const result = await runWriteQuery(cypher, { id, updates });

    if (result.length === 0) {
      return res.status(404).json({ error: 'Configuration item not found' });
    }

    res.json(result[0].ci.properties);
  } catch (error) {
    console.error('Error updating CI:', error);
    res.status(500).json({ error: 'Failed to update configuration item' });
  }
});

// Delete Configuration Item
router.delete('/items/:id', writeLimiter, async (req, res) => {
  try {
    await ensureInitialized();

    const { id } = req.params;

    const cypher = `
      MATCH (ci:ConfigurationItem {id: $id})
      DETACH DELETE ci
      RETURN count(ci) as deleted
    `;

    const result = await runWriteQuery(cypher, { id });

    if (result[0].deleted === 0) {
      return res.status(404).json({ error: 'Configuration item not found' });
    }

    res.json({ message: 'Configuration item deleted successfully' });
  } catch (error) {
    console.error('Error deleting CI:', error);
    res.status(500).json({ error: 'Failed to delete configuration item' });
  }
});

// Create relationship between Configuration Items
router.post('/relationships', writeLimiter, async (req, res) => {
  try {
    await ensureInitialized();

    const { fromId, toId, relationshipType, properties = {} } = req.body;

    if (!fromId || !toId || !relationshipType) {
      return res.status(400).json({
        error: 'fromId, toId, and relationshipType are required'
      });
    }

    const cypher = `
      MATCH (from:ConfigurationItem {id: $fromId})
      MATCH (to:ConfigurationItem {id: $toId})
      CREATE (from)-[r:${relationshipType} $properties]->(to)
      RETURN from.name as fromName, to.name as toName, type(r) as relationship
    `;

    const result = await runWriteQuery(cypher, { fromId, toId, properties });

    if (result.length === 0) {
      return res.status(404).json({ error: 'One or both configuration items not found' });
    }

    res.status(201).json({
      message: 'Relationship created successfully',
      relationship: result[0]
    });
  } catch (error) {
    console.error('Error creating relationship:', error);
    res.status(500).json({ error: 'Failed to create relationship' });
  }
});

// Get topology/dependency graph
router.get('/topology', expensiveLimiter, async (req, res) => {
  try {
    await ensureInitialized();

    const { depth = 3, startNode, type, limit = 100 } = req.query;
    const nodeLimit = Math.min(parseInt(limit) || 100, 500); // Max 500 nodes for safety

    let cypher, params;

    if (startNode) {
      // Get all nodes within depth - use apoc.path.subgraphNodes for reliable traversal
      const depthParam = parseInt(depth);
      cypher = `
        MATCH (start:ConfigurationItem {id: $startNode})
        CALL apoc.path.subgraphNodes(start, {
          maxLevel: ${depthParam},
          relationshipFilter: null,
          labelFilter: 'ConfigurationItem'
        }) YIELD node
        WITH collect(DISTINCT node) as allNodes

        // Get all relationships between these nodes
        UNWIND allNodes as n1
        MATCH (n1)-[r]-(n2)
        WHERE n2 IN allNodes

        RETURN [n IN allNodes | {
          id: n.id,
          name: n.name,
          type: n.type,
          status: coalesce(n.status, 'unknown')
        }] as nodes,
        collect(DISTINCT {
          from: startNode(r).id,
          to: endNode(r).id,
          type: type(r)
        }) as relationships
      `;
      params = { startNode };
    } else {
      // Build base query with optional type filter
      let nodeQuery = 'MATCH (ci:ConfigurationItem)';
      params = { nodeLimit: neo4j.int(nodeLimit) };

      if (type) {
        nodeQuery += ' WHERE ci.type = $type';
        params.type = type;
      }

      // Get filtered nodes AND their connected nodes for proper topology
      cypher = `
        ${nodeQuery}
        WITH ci LIMIT $nodeLimit
        OPTIONAL MATCH (ci)-[r]-(connected:ConfigurationItem)
        WITH collect(DISTINCT ci) + collect(DISTINCT connected) as allNodes,
             collect(DISTINCT r) as allRelationships
        UNWIND allNodes as node
        WITH collect(DISTINCT node) as finalNodes, allRelationships
        RETURN [n IN finalNodes WHERE n IS NOT NULL | {
          id: n.id,
          name: n.name,
          type: n.type,
          status: coalesce(n.status, 'unknown')
        }] as nodes,
        [rel IN allRelationships WHERE rel IS NOT NULL | {
          from: startNode(rel).id,
          to: endNode(rel).id,
          type: type(rel)
        }] as relationships
      `;
    }

    const result = await runReadQuery(cypher, params);

    if (result.length === 0) {
      return res.json({ nodes: [], relationships: [] });
    }

    res.json({
      nodes: result[0].nodes || [],
      relationships: (result[0].relationships || []).filter(rel => rel.from && rel.to)
    });
  } catch (error) {
    console.error('Error fetching topology:', error);
    res.status(500).json({ error: 'Failed to fetch topology data' });
  }
});

// Get paginated Configuration Items with search and filter capabilities for browse view
router.get('/browse', readLimiter, async (req, res) => {
  try {
    await ensureInitialized();

    const {
      search = '',
      type = '',
      page = 1,
      limit = 200,
      sort = 'name',
      order = 'asc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10))); // Cap at 500 for safety
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE clause for filtering
    let whereClause = 'WHERE 1=1';
    let params = {
      limit: neo4j.int(limitNum),
      offset: neo4j.int(offset)
    };

    // Add type filter
    if (type) {
      whereClause += ' AND ci.type = $type';
      params.type = type;
    }

    // Add search filter (search in name and properties)
    if (search.trim()) {
      whereClause += ' AND (toLower(ci.name) CONTAINS toLower($search) OR ANY(prop IN keys(ci) WHERE toLower(toString(ci[prop])) CONTAINS toLower($search)))';
      params.search = search.trim();
    }

    // Build ORDER BY clause
    let orderClause = 'ORDER BY ';
    const validSortFields = ['name', 'type', 'status', 'updatedAt', 'createdAt'];
    const sortField = validSortFields.includes(sort) ? sort : 'name';
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
    orderClause += `ci.${sortField} ${sortOrder}`;

    // Get total count for pagination
    const countQuery = `
      MATCH (ci:ConfigurationItem)
      ${whereClause}
      RETURN count(ci) as total
    `;

    // Get paginated results with relationship counts
    const dataQuery = `
      MATCH (ci:ConfigurationItem)
      ${whereClause}
      OPTIONAL MATCH (ci)-[r]-(related:ConfigurationItem)
      WITH ci, count(DISTINCT r) as relationshipCount
      ${orderClause}
      SKIP $offset
      LIMIT $limit
      RETURN ci,
             relationshipCount,
             ci.id as id,
             ci.name as name,
             ci.type as type,
             ci.status as status,
             ci.createdAt as createdAt,
             ci.updatedAt as updatedAt
    `;

    // Execute both queries in parallel
    const [countResult, dataResult] = await Promise.all([
      runReadQuery(countQuery, params),
      runReadQuery(dataQuery, params)
    ]);

    // Convert Neo4j integers to regular numbers
    const convertNeo4jInt = (value) => {
      if (value && typeof value === 'object' && 'low' in value) {
        return value.low;
      }
      return value || 0;
    };

    const total = convertNeo4jInt(countResult[0]?.total);
    const totalPages = Math.ceil(total / limitNum);

    // Format the results
    const items = dataResult.map(record => ({
      id: record.id,
      name: record.name,
      type: record.type,
      status: record.status || 'unknown',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      relationshipCount: convertNeo4jInt(record.relationshipCount),
      // Include all properties from the CI node
      ...record.ci.properties
    }));

    res.json({
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      },
      filters: {
        search,
        type,
        sort,
        order
      }
    });

  } catch (error) {
    console.error('Error fetching browse data:', error);
    res.status(500).json({ error: 'Failed to fetch configuration items for browse view' });
  }
});

// Get relationship details for a specific CI (for expandable relationship view)
router.get('/items/:id/relationships', readLimiter, async (req, res) => {
  try {
    await ensureInitialized();

    const { id } = req.params;

    const cypher = `
      MATCH (ci:ConfigurationItem {id: $id})
      OPTIONAL MATCH (ci)-[r]-(related:ConfigurationItem)
      RETURN collect(DISTINCT {
        relationshipType: type(r),
        direction: CASE
          WHEN startNode(r) = ci THEN 'outgoing'
          ELSE 'incoming'
        END,
        relatedItem: {
          id: related.id,
          name: related.name,
          type: related.type,
          status: coalesce(related.status, 'unknown')
        }
      }) as relationships
    `;

    const result = await runReadQuery(cypher, { id });

    if (result.length === 0) {
      return res.status(404).json({ error: 'Configuration item not found' });
    }

    // Filter out null relationships (from OPTIONAL MATCH)
    const relationships = result[0].relationships.filter(rel => rel.relatedItem.id !== null);

    res.json({ relationships });
  } catch (error) {
    console.error('Error fetching CI relationships:', error);
    res.status(500).json({ error: 'Failed to fetch configuration item relationships' });
  }
});

// Get impact analysis for a CI
router.get('/impact/:id', expensiveLimiter, async (req, res) => {
  try {
    await ensureInitialized();

    const { id } = req.params;
    const { direction = 'both', depth = 3 } = req.query;

    let relationshipPattern;
    switch (direction) {
      case 'upstream':
        relationshipPattern = '<-[*1..' + depth + ']-';
        break;
      case 'downstream':
        relationshipPattern = '-[*1..' + depth + ']->';
        break;
      default:
        relationshipPattern = '-[*1..' + depth + ']-';
    }

    const cypher = `
      MATCH (source:ConfigurationItem {id: $id})
      MATCH (source)${relationshipPattern}(impacted:ConfigurationItem)
      RETURN DISTINCT impacted.id as id,
                      impacted.name as name,
                      impacted.type as type,
                      impacted.criticality as criticality,
                      shortestPath((source)-[*]-(impacted)) as path
      ORDER BY length(path), impacted.criticality DESC
    `;

    const result = await runReadQuery(cypher, { id });
    res.json(result.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      criticality: item.criticality || 'medium',
      distance: item.path ? item.path.length : 0
    })));
  } catch (error) {
    console.error('Error performing impact analysis:', error);
    res.status(500).json({ error: 'Failed to perform impact analysis' });
  }
});

// Get services status and environment information
router.get('/services/status', readLimiter, async (req, res) => {
  try {
    const startTime = Date.now();

    // Detect environment mode
    const environmentMode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    const isDockerEnvironment = !!process.env.RUNNING_IN_DOCKER;
    const isDemoMode = process.argv.includes('demo-app.js');

    // Get application info
    const packageInfo = require('../../package.json');
    const appInfo = {
      name: packageInfo.name,
      version: packageInfo.version,
      mode: isDemoMode ? 'demo' : (environmentMode === 'production' ? 'production' : 'development'),
      startTime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      memory: process.memoryUsage(),
      isDocker: isDockerEnvironment
    };

    // Initialize services status
    const services = [];

    // Neo4j Service Status
    let neo4jStatus = 'unknown';
    let neo4jInfo = {};
    try {
      const neo4jService = require('../services/neo4j');
      const testQuery = 'RETURN 1 as test';
      const result = await neo4jService.runReadQuery(testQuery);
      if (result && result.length > 0) {
        neo4jStatus = 'healthy';

        // Get Neo4j version and database info
        try {
          const versionResult = await neo4jService.runReadQuery('CALL dbms.components() YIELD name, versions, edition');
          const dbInfoResult = await neo4jService.runReadQuery('CALL db.info()');

          neo4jInfo = {
            version: versionResult[0]?.versions?.[0] || 'Unknown',
            edition: versionResult[0]?.edition || 'Community',
            databaseName: dbInfoResult[0]?.name || 'neo4j',
            storeSize: dbInfoResult[0]?.storeSize || 'Unknown'
          };
        } catch (infoError) {
          console.warn('Could not get Neo4j detailed info:', infoError.message);
        }
      }
    } catch (error) {
      neo4jStatus = 'error';
      neo4jInfo = { error: error.message };
    }

    services.push({
      name: 'Neo4j Database',
      type: 'database',
      status: neo4jStatus,
      url: process.env.NEO4J_URI || 'bolt://localhost:7687',
      browserUrl: 'http://localhost:7474',
      info: neo4jInfo,
      required: true
    });

    // Redis Service Status (if configured)
    let redisStatus = 'not-configured';
    let redisInfo = {};
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        // Try to connect to Redis if available
        const redis = require('redis');
        const client = redis.createClient({ url: redisUrl });
        await client.connect();
        await client.ping();
        redisStatus = 'healthy';
        redisInfo = {
          url: redisUrl,
          connected: true
        };
        await client.disconnect();
      } catch (error) {
        redisStatus = 'error';
        redisInfo = { error: error.message };
      }

      services.push({
        name: 'Redis Cache',
        type: 'cache',
        status: redisStatus,
        url: redisUrl,
        info: redisInfo,
        required: false
      });
    }

    // Socket.IO Status
    const socketStatus = global.io ? 'healthy' : 'not-initialized';
    services.push({
      name: 'WebSocket Server',
      type: 'websocket',
      status: socketStatus,
      info: {
        connectedClients: global.io?.engine?.clientsCount || 0,
        initialized: !!global.io
      },
      required: false
    });

    // API Service (self)
    services.push({
      name: 'CMDB API',
      type: 'api',
      status: 'healthy',
      url: `http://localhost:${process.env.PORT || 3000}`,
      info: {
        port: process.env.PORT || 3000,
        routes: ['cmdb', 'events', 'correlation', 'demo'],
        uptime: Math.floor(process.uptime())
      },
      required: true
    });

    // Overall system health
    const healthyServices = services.filter(s => s.status === 'healthy').length;
    const requiredServices = services.filter(s => s.required).length;
    const requiredHealthy = services.filter(s => s.required && s.status === 'healthy').length;

    const overallStatus = requiredHealthy === requiredServices ? 'healthy' : 'degraded';

    const responseTime = Date.now() - startTime;

    res.json({
      overall: {
        status: overallStatus,
        mode: appInfo.mode,
        environment: environmentMode,
        isDocker: isDockerEnvironment,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      },
      application: appInfo,
      services,
      summary: {
        total: services.length,
        healthy: healthyServices,
        required: requiredServices,
        requiredHealthy,
        optional: services.length - requiredServices
      },
      performance: {
        responseTime,
        uptime: Math.floor(process.uptime()),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024)
        },
        cpu: process.cpuUsage()
      }
    });

  } catch (error) {
    console.error('Error getting services status:', error);
    res.status(500).json({
      error: 'Failed to get services status',
      details: error.message,
      overall: {
        status: 'error',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;