const express = require('express');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');
const uuidv4 = () => crypto.randomUUID();

// Helper function to make internal HTTP requests
function makeInternalRequest(path, method = 'POST', body = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          resolve({ message: data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory demo data for the concept
let demoData = {
  configurationItems: [
    { id: 'ci-1', name: 'Web Server 1', type: 'Server', status: 'OPERATIONAL' },
    { id: 'ci-2', name: 'Database Server', type: 'DatabaseServer', status: 'OPERATIONAL' },
    { id: 'ci-3', name: 'Load Balancer', type: 'LoadBalancer', status: 'OPERATIONAL' },
    { id: 'ci-4', name: 'E-Commerce App', type: 'Application', status: 'OPERATIONAL' }
  ],
  events: [
    {
      id: 'evt-1',
      message: 'High CPU utilization detected',
      severity: 'HIGH',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      status: 'OPEN',
      ciId: 'ci-1'
    },
    {
      id: 'evt-2',
      message: 'Database connection slow',
      severity: 'MEDIUM',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      status: 'ACKNOWLEDGED',
      ciId: 'ci-2'
    }
  ],
  relationships: [
    { from: 'ci-4', to: 'ci-1', type: 'RUNS_ON' },
    { from: 'ci-4', to: 'ci-2', type: 'DEPENDS_ON' },
    { from: 'ci-3', to: 'ci-1', type: 'BALANCES_TO' }
  ]
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/demo/scenarios', (req, res) => {
  const demoScenarios = [
    {
      id: 'database-cascade-failure',
      title: 'Database Cascade Failure Analysis',
      description: 'Shows impact from database server failure to application services',
      componentId: 'ci-2',
      expectedHops: 3,
      expectedImpact: 'Critical - affects E-Commerce application functionality',
      revenueAtRisk: '$25,000/hour',
      graphAdvantage: 'Single graph query vs multiple SQL joins'
    },
    {
      id: 'application-dependency-analysis',
      title: 'Application Dependency Analysis',
      description: 'Analyze dependencies of E-Commerce application',
      componentId: 'ci-4',
      expectedHops: 2,
      expectedImpact: 'Medium - affects web server availability',
      revenueAtRisk: '$10,000/hour',
      graphAdvantage: 'Immediate graph traversal vs multiple table lookups'
    }
  ];

  res.json({
    demoScenarios,
    totalScenarios: demoScenarios.length,
    message: 'Demo scenarios loaded for graph database advantages demonstration'
  });
});

// Queue/Job management endpoints for data generation UI
app.get('/api/queue/scales', (req, res) => {
  const scales = [
    { id: 'small', name: 'Small', description: 'Generate ~100 CIs for testing', estimatedTime: '< 1 min', estimatedDuration: '< 1 min', totalCIs: 100, complexity: 'Low' },
    { id: 'medium', name: 'Medium', description: 'Generate ~500 CIs for demos', estimatedTime: '< 2 min', estimatedDuration: '< 2 min', totalCIs: 500, complexity: 'Medium' },
    { id: 'large', name: 'Large', description: 'Generate ~1,000 CIs for development', estimatedTime: '< 5 min', estimatedDuration: '< 5 min', totalCIs: 1000, complexity: 'High' },
    { id: 'enterprise', name: 'Enterprise', description: 'Generate ~5,000 CIs for testing', estimatedTime: '< 10 min', estimatedDuration: '< 10 min', totalCIs: 5000, complexity: 'Very High' }
  ];
  res.json(scales);
});

app.get('/api/queue/stats', (req, res) => {
  res.json({
    queue: { pending: 0, active: 0, completed: 1, failed: 0 },
    workers: { active: 0, total: 0 }
  });
});

app.get('/api/jobs', (req, res) => {
  // Organize jobs by status for the frontend
  const jobs = {
    active: jobHistory.filter(job => job.status === 'active'),
    waiting: jobHistory.filter(job => job.status === 'waiting' || job.status === 'pending'),
    completed: jobHistory.filter(job => job.status === 'completed'),
    failed: jobHistory.filter(job => job.status === 'failed')
  };

  res.json(jobs);
});

// Job history storage (in memory for demo)
let jobHistory = [];

app.post('/api/jobs', async (req, res) => {
  const { scale, customConfig } = req.body;
  const clearExisting = customConfig?.clearExisting || false;
  const jobId = `job-${Date.now()}`;

  try {
    console.log(`Starting data generation job: ${jobId}, scale: ${scale}, clearExisting: ${clearExisting}`);

    let result;

    // Actually call the data generation endpoints using internal HTTP requests
    if (scale === 'enterprise' || scale === 'large') {
      console.log('Calling enterprise data generation endpoint...');
      result = await makeInternalRequest('/api/demo/enterprise-data', 'POST', { clearExisting });
    } else {
      console.log('Calling sample data generation endpoint...');
      result = await makeInternalRequest('/api/demo/sample-data', 'POST', { clearExisting });
    }

    console.log('Data generation completed:', result);

    // Create job record
    const job = {
      jobId,
      data: {
        scale,
        config: {
          name: `${scale.charAt(0).toUpperCase() + scale.slice(1)} Data Generation`,
          totalCIs: result.totalCIs || 'Unknown',
          estimatedDuration: scale === 'enterprise' || scale === 'large' ? '2-3 minutes' : '< 1 minute'
        }
      },
      status: 'completed',
      progress: 100,
      message: `${scale.charAt(0).toUpperCase() + scale.slice(1)} data generation completed successfully`,
      result: {
        totalCIs: result.totalCIs || 'Unknown',
        totalEvents: result.totalEvents || 'Unknown'
      },
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };

    // Store in job history
    jobHistory.unshift(job);

    // Keep only last 10 jobs to prevent memory bloat
    if (jobHistory.length > 10) {
      jobHistory = jobHistory.slice(0, 10);
    }

    // Emit job completion event via Socket.IO
    io.emit('job-completed', { jobId: job.jobId });

    console.log('Job completed successfully:', job.jobId);
    res.json(job);
  } catch (error) {
    console.error('Data generation failed:', error);
    const job = {
      jobId,
      data: {
        scale,
        config: {
          name: `${scale.charAt(0).toUpperCase() + scale.slice(1)} Data Generation`,
          totalCIs: 0
        }
      },
      status: 'failed',
      progress: 0,
      message: `Data generation failed: ${error.message}`,
      result: { error: error.message },
      createdAt: new Date().toISOString(),
      failedAt: new Date().toISOString()
    };

    jobHistory.unshift(job);

    // Emit job failure event via Socket.IO
    io.emit('job-failed', { jobId: job.jobId, error: error.message });

    res.status(500).json(job);
  }
});

// Cancel job endpoint
app.delete('/api/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;

  console.log(`Cancelling job: ${jobId}`);

  // Since we don't have active jobs in demo mode, just return success
  // In a real implementation, this would cancel the actual job

  // Emit job cancellation event via Socket.IO
  io.emit('job-cancelled', { jobId });

  res.json({ message: 'Job cancelled successfully', jobId });
});

app.get('/debug', (req, res) => {
  res.json({ message: 'Debug route working' });
});

// Test route to debug routing issues
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route working' });
});

// Demo scenarios for the frontend (moved here to ensure it works)
app.get('/api/demo/scenarios', (req, res) => {
  const demoScenarios = [
    {
      id: 'database-cascade-failure',
      title: 'Database Cascade Failure Analysis',
      description: 'Shows impact from database server failure to application services',
      componentId: 'ci-2',
      expectedHops: 3,
      expectedImpact: 'Critical - affects E-Commerce application functionality',
      revenueAtRisk: '$25,000/hour',
      graphAdvantage: 'Single graph query vs multiple SQL joins'
    },
    {
      id: 'application-dependency-analysis',
      title: 'Application Dependency Analysis',
      description: 'Analyze dependencies of E-Commerce application',
      componentId: 'ci-4',
      expectedHops: 2,
      expectedImpact: 'Medium - affects web server availability',
      revenueAtRisk: '$10,000/hour',
      graphAdvantage: 'Immediate graph traversal vs multiple table lookups'
    }
  ];

  res.json({
    demoScenarios,
    totalScenarios: demoScenarios.length,
    message: 'Demo scenarios loaded for graph database advantages demonstration'
  });
});

// Configuration Items API
app.get('/api/cmdb/items', (req, res) => {
  res.json(demoData.configurationItems);
});

app.get('/api/cmdb/topology', (req, res) => {
  res.json({
    nodes: demoData.configurationItems,
    relationships: demoData.relationships
  });
});

// Browse API for paginated CI listing
app.get('/api/cmdb/browse', (req, res) => {
  const {
    search = '',
    type = '',
    page = 1,
    limit = 200,
    sort = 'name',
    order = 'asc'
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10)));

  // Filter items
  let filteredItems = [...demoData.configurationItems];

  // Apply type filter
  if (type) {
    filteredItems = filteredItems.filter(item => item.type === type);
  }

  // Apply search filter
  if (search.trim()) {
    const searchLower = search.toLowerCase();
    filteredItems = filteredItems.filter(item =>
      item.name.toLowerCase().includes(searchLower) ||
      item.type.toLowerCase().includes(searchLower) ||
      item.id.toLowerCase().includes(searchLower)
    );
  }

  // Apply sorting
  filteredItems.sort((a, b) => {
    let aVal = a[sort] || '';
    let bVal = b[sort] || '';

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (order === 'desc') {
      return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
    }
    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
  });

  // Apply pagination
  const total = filteredItems.length;
  const totalPages = Math.ceil(total / limitNum);
  const offset = (pageNum - 1) * limitNum;
  const paginatedItems = filteredItems.slice(offset, offset + limitNum);

  // Add relationship counts and format items
  const items = paginatedItems.map(item => {
    const relationshipCount = demoData.relationships.filter(rel =>
      rel.from === item.id || rel.to === item.id
    ).length;

    return {
      ...item,
      relationshipCount,
      status: item.status || 'unknown',
      createdAt: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
      updatedAt: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString()
    };
  });

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
});

// Get relationship details for a specific CI
app.get('/api/cmdb/items/:id/relationships', (req, res) => {
  const { id } = req.params;

  const ci = demoData.configurationItems.find(item => item.id === id);
  if (!ci) {
    return res.status(404).json({ error: 'Configuration item not found' });
  }

  const relationships = demoData.relationships
    .filter(rel => rel.from === id || rel.to === id)
    .map(rel => {
      const isOutgoing = rel.from === id;
      const relatedId = isOutgoing ? rel.to : rel.from;
      const relatedItem = demoData.configurationItems.find(item => item.id === relatedId);

      return {
        relationshipType: rel.type,
        direction: isOutgoing ? 'outgoing' : 'incoming',
        relatedItem: relatedItem ? {
          id: relatedItem.id,
          name: relatedItem.name,
          type: relatedItem.type,
          status: relatedItem.status || 'unknown'
        } : null
      };
    })
    .filter(rel => rel.relatedItem !== null);

  res.json({ relationships });
});

// Events API
app.get('/api/events', (req, res) => {
  res.json(demoData.events);
});

app.get('/api/events/stats', (req, res) => {
  const stats = {
    totalEvents: demoData.events.length,
    critical: demoData.events.filter(e => e.severity === 'CRITICAL').length,
    high: demoData.events.filter(e => e.severity === 'HIGH').length,
    medium: demoData.events.filter(e => e.severity === 'MEDIUM').length,
    low: demoData.events.filter(e => e.severity === 'LOW').length,
    info: demoData.events.filter(e => e.severity === 'INFO').length,
    open: demoData.events.filter(e => e.status === 'OPEN').length,
    acknowledged: demoData.events.filter(e => e.status === 'ACKNOWLEDGED').length,
    resolved: demoData.events.filter(e => e.status === 'RESOLVED').length
  };
  res.json(stats);
});

app.post('/api/events/simulate', (req, res) => {
  const templates = [
    { message: 'CPU spike detected', severity: 'HIGH', type: 'PERFORMANCE' },
    { message: 'Memory threshold exceeded', severity: 'MEDIUM', type: 'PERFORMANCE' },
    { message: 'Network interface down', severity: 'CRITICAL', type: 'AVAILABILITY' },
    { message: 'Disk space running low', severity: 'MEDIUM', type: 'CAPACITY' }
  ];

  const template = templates[Math.floor(Math.random() * templates.length)];
  const randomCI = demoData.configurationItems[Math.floor(Math.random() * demoData.configurationItems.length)];

  const newEvent = {
    id: uuidv4(),
    message: `${template.message} on ${randomCI.name}`,
    severity: template.severity,
    timestamp: new Date().toISOString(),
    status: 'OPEN',
    ciId: randomCI.id,
    type: template.type
  };

  demoData.events.unshift(newEvent);
  res.status(201).json(newEvent);
});

// Demo sample data
app.post('/api/demo/sample-data', (req, res) => {
  // Add more sample data
  const additionalCIs = [
    { id: 'ci-5', name: 'Core Switch 1', type: 'NetworkSwitch', status: 'OPERATIONAL' },
    { id: 'ci-6', name: 'Firewall', type: 'Firewall', status: 'OPERATIONAL' },
    { id: 'ci-7', name: 'CRM Application', type: 'Application', status: 'OPERATIONAL' }
  ];

  const additionalEvents = [
    {
      id: uuidv4(),
      message: 'Application performance degraded',
      severity: 'HIGH',
      timestamp: new Date(Date.now() - 900000).toISOString(),
      status: 'OPEN',
      ciId: 'ci-7'
    },
    {
      id: uuidv4(),
      message: 'Network latency increased',
      severity: 'MEDIUM',
      timestamp: new Date(Date.now() - 1200000).toISOString(),
      status: 'RESOLVED',
      ciId: 'ci-5'
    }
  ];

  const additionalRelationships = [
    { from: 'ci-7', to: 'ci-2', type: 'DEPENDS_ON' },
    { from: 'ci-1', to: 'ci-5', type: 'CONNECTS_TO' },
    { from: 'ci-6', to: 'ci-5', type: 'PROTECTS' }
  ];

  demoData.configurationItems.push(...additionalCIs);
  demoData.events.push(...additionalEvents);
  demoData.relationships.push(...additionalRelationships);

  res.json({ message: 'Sample data loaded successfully',
            totalCIs: demoData.configurationItems.length,
            totalEvents: demoData.events.length });
});


// Test route to check if routes work here
app.get('/api/demo/test-here', (req, res) => {
  res.json({ message: 'Test route at this position working' });
});

// Demo scenarios API for graph advantages demo
app.get('/api/demo/graph-advantage-examples', (req, res) => {
  const demoScenarios = [
    {
      id: 'database-cascade-failure',
      title: 'Database Cascade Failure Analysis',
      description: 'Shows impact from database server failure to application services',
      componentId: 'ci-2',
      expectedHops: 3,
      expectedImpact: 'Critical - affects E-Commerce application functionality',
      revenueAtRisk: '$25,000/hour',
      graphAdvantage: 'Single graph query vs multiple SQL joins'
    },
    {
      id: 'application-dependency-analysis',
      title: 'Application Dependency Analysis',
      description: 'Analyze dependencies of E-Commerce application',
      componentId: 'ci-4',
      expectedHops: 2,
      expectedImpact: 'High - affects web services and database connections',
      revenueAtRisk: '$15,000/hour',
      graphAdvantage: 'Direct relationship traversal vs complex SQL CTEs'
    },
    {
      id: 'load-balancer-impact',
      title: 'Load Balancer Impact Assessment',
      description: 'Evaluate impact of load balancer failure on web services',
      componentId: 'ci-3',
      expectedHops: 2,
      expectedImpact: 'Medium - affects web server availability',
      revenueAtRisk: '$10,000/hour',
      graphAdvantage: 'Immediate graph traversal vs multiple table lookups'
    }
  ];

  res.json({
    demoScenarios,
    totalScenarios: demoScenarios.length,
    message: 'Demo scenarios loaded for graph database advantages demonstration'
  });
});

// Demo impact analysis (original endpoint)
app.get('/api/demo/impact/:componentId', (req, res) => {
  const { componentId } = req.params;
  const { direction = 'both', depth = 3 } = req.query;

  // Find the component
  const component = demoData.configurationItems.find(item => item.id === componentId);
  if (!component) {
    return res.status(404).json({ error: 'Component not found' });
  }

  // Simple impact analysis using demo data relationships
  const findImpacted = (startId, visited = new Set()) => {
    if (visited.has(startId)) return [];
    visited.add(startId);

    const impacted = [];
    demoData.relationships.forEach(rel => {
      if (rel.from === startId && !visited.has(rel.to)) {
        const relatedItem = demoData.configurationItems.find(item => item.id === rel.to);
        if (relatedItem) {
          impacted.push({
            id: relatedItem.id,
            name: relatedItem.name,
            type: relatedItem.type,
            criticality: 'medium',
            distance: 1,
            relationshipType: rel.type
          });
          // Recursively find further impacts (up to depth)
          if (depth > 1) {
            impacted.push(...findImpacted(rel.to, new Set(visited)));
          }
        }
      }
    });
    return impacted;
  };

  const impactedItems = findImpacted(componentId);

  // Calculate business impact
  const revenueImpact = {
    'ci-2': 25000, // Database Server
    'ci-4': 15000, // E-Commerce App
    'ci-3': 10000, // Load Balancer
    'ci-1': 8000   // Web Server
  };

  const businessImpact = {
    totalRevenue: revenueImpact[componentId] || 5000,
    affectedServices: impactedItems.filter(item => item.type === 'Application').length,
    criticalComponents: impactedItems.filter(item => item.criticality === 'high').length
  };

  res.json({
    sourceComponent: component,
    impactedItems,
    businessImpact,
    analysisDetails: {
      direction,
      depth: parseInt(depth),
      queryTime: '< 1ms',
      totalAffected: impactedItems.length
    }
  });
});

// Demo impact analysis (frontend-expected endpoint)
app.get('/api/demo/impact-analysis/:componentId', (req, res) => {
  const { componentId } = req.params;
  const { maxDepth = 3, direction = 'downstream' } = req.query;

  // Find the component
  const component = demoData.configurationItems.find(item => item.id === componentId);
  if (!component) {
    return res.status(404).json({ error: 'Component not found' });
  }

  // Enhanced impact analysis with proper data structure for frontend
  const findImpacted = (startId, currentDepth = 0, visited = new Set()) => {
    if (currentDepth >= parseInt(maxDepth) || visited.has(startId)) return [];
    visited.add(startId);

    const impacted = [];
    demoData.relationships.forEach(rel => {
      let targetId = null;
      let relationshipType = rel.type;

      if (direction === 'downstream' && rel.from === startId) {
        targetId = rel.to;
      } else if (direction === 'upstream' && rel.to === startId) {
        targetId = rel.from;
      } else if (direction === 'both' && (rel.from === startId || rel.to === startId)) {
        targetId = rel.from === startId ? rel.to : rel.from;
      }

      if (targetId && !visited.has(targetId)) {
        const relatedItem = demoData.configurationItems.find(item => item.id === targetId);
        if (relatedItem) {
          const hopDistance = currentDepth + 1;
          const riskLevel = hopDistance === 1 ? 'HIGH_RISK' :
                           hopDistance === 2 ? 'MEDIUM_RISK' : 'LOW_RISK';

          const impactItem = {
            componentId: relatedItem.id,
            componentName: relatedItem.name,
            componentType: relatedItem.type,
            hopDistance,
            riskLevel,
            impactScore: Math.round((100 - hopDistance * 20) * Math.random()),
            dependencyPath: [
              { id: startId, name: component.name, type: component.type },
              { id: relatedItem.id, name: relatedItem.name, type: relatedItem.type }
            ],
            relationshipType,
            affectedBusinessService: relatedItem.type === 'BusinessService' ? relatedItem.name :
                                   relatedItem.type.includes('Application') ? 'E-Commerce Platform' : null,
            hourlyRevenueAtRisk: relatedItem.type === 'BusinessService' ? 25000 :
                               relatedItem.type.includes('Application') ? 15000 :
                               relatedItem.type === 'Database' ? 20000 : 5000
          };

          impacted.push(impactItem);

          // Recursively find further impacts
          const furtherImpacts = findImpacted(targetId, currentDepth + 1, new Set(visited));
          impacted.push(...furtherImpacts);
        }
      }
    });
    return impacted;
  };

  const impactDetails = findImpacted(componentId);

  // Calculate summary metrics
  const totalAffectedComponents = impactDetails.length;
  const criticalImpacts = impactDetails.filter(item => item.riskLevel === 'HIGH_RISK').length;
  const totalHourlyRevenueAtRisk = impactDetails.reduce((sum, item) => sum + item.hourlyRevenueAtRisk, 0);
  const executionTimeMs = Math.floor(Math.random() * 50) + 10; // Simulate realistic query time

  // Graph advantage information
  const graphAdvantage = {
    cypherComplexity: 'Simple',
    sqlEquivalent: 'Complex recursive CTEs',
    performanceAdvantage: `${executionTimeMs}ms vs 500-2000ms in SQL`
  };

  const impactSummary = {
    totalAffectedComponents,
    criticalImpacts,
    totalHourlyRevenueAtRisk,
    executionTimeMs
  };

  res.json({
    impactSummary,
    impactDetails,
    graphAdvantage,
    analysisMetadata: {
      componentId,
      direction,
      maxDepth: parseInt(maxDepth),
      analysisTimestamp: new Date().toISOString()
    }
  });
});

// Query comparison for graph advantage demo
app.get('/api/demo/query-comparison/:componentId', (req, res) => {
  const { componentId } = req.params;
  const { depth = 3 } = req.query;

  const cypherQuery = `
MATCH (source:ConfigurationItem {id: $componentId})
MATCH (source)-[*1..${depth}]-(impacted:ConfigurationItem)
RETURN DISTINCT impacted.id as id,
                impacted.name as name,
                impacted.type as type,
                shortestPath((source)-[*]-(impacted)) as path
ORDER BY length(path), impacted.type`;

  const sqlQuery = `
WITH RECURSIVE dependency_tree AS (
  -- Base case: start with the source component
  SELECT id, name, type, 0 as depth, ARRAY[id] as path
  FROM configuration_items
  WHERE id = '${componentId}'

  UNION ALL

  -- Recursive case: find all connected components
  SELECT ci.id, ci.name, ci.type, dt.depth + 1,
         dt.path || ci.id
  FROM configuration_items ci
  JOIN relationships r ON (r.from_id = dt.id OR r.to_id = dt.id)
  JOIN dependency_tree dt ON (dt.id = r.from_id OR dt.id = r.to_id)
  WHERE ci.id != dt.id
    AND NOT ci.id = ANY(dt.path)
    AND dt.depth < ${depth}
)
SELECT DISTINCT id, name, type, depth
FROM dependency_tree
WHERE depth > 0
ORDER BY depth, type;`;

  const comparison = {
    cypher: {
      query: cypherQuery.trim(),
      linesOfCode: cypherQuery.trim().split('\n').length,
      complexity: 'Low',
      advantages: [
        'Native graph traversal',
        'Built-in path finding',
        'No recursive complexity',
        'Consistent performance'
      ]
    },
    sql: {
      query: sqlQuery.trim(),
      linesOfCode: sqlQuery.trim().split('\n').length,
      complexity: 'High',
      disadvantages: [
        'Complex recursive CTEs',
        'Performance degrades with depth',
        'Manual path tracking',
        'Difficult to maintain'
      ]
    },
    advantages: [
      {
        aspect: 'Query Simplicity',
        cypher: 'Intuitive graph traversal with MATCH patterns',
        sql: 'Complex recursive CTEs with manual path tracking'
      },
      {
        aspect: 'Performance',
        cypher: 'Consistent performance regardless of depth',
        sql: 'Performance degrades exponentially with depth'
      },
      {
        aspect: 'Flexibility',
        cypher: 'Easy to change traversal depth with parameter',
        sql: 'Requires query rewriting for different depths'
      },
      {
        aspect: 'Maintainability',
        cypher: 'Concise, readable graph patterns',
        sql: 'Verbose, complex recursive logic'
      }
    ]
  };

  res.json(comparison);
});

// Enterprise data demo (in-memory simulation)
app.post('/api/demo/enterprise-data', (req, res) => {
  // Generate enterprise-scale demo data
  console.log('🏢 Generating enterprise-scale demo data...');

  // Clear existing data
  demoData.configurationItems = [];
  demoData.events = [];
  demoData.relationships = [];

  // Generate regions
  const regions = [
    { id: 'us-east-1', name: 'US East', type: 'Region', status: 'OPERATIONAL' },
    { id: 'us-west-1', name: 'US West', type: 'Region', status: 'OPERATIONAL' },
    { id: 'eu-west-1', name: 'Europe', type: 'Region', status: 'OPERATIONAL' }
  ];

  // Generate datacenters
  const datacenters = [];
  regions.forEach((region, regionIdx) => {
    for (let i = 1; i <= 3; i++) {
      const dc = {
        id: `dc-${region.id}-${i.toString().padStart(2, '0')}`,
        name: `${region.name} Datacenter ${i}`,
        type: 'DataCenter',
        status: 'OPERATIONAL'
      };
      datacenters.push(dc);
      demoData.relationships.push({ from: dc.id, to: region.id, type: 'LOCATED_IN' });
    }
  });

  // Generate servers (200 total)
  const servers = [];
  datacenters.forEach((dc, dcIdx) => {
    for (let i = 1; i <= 25; i++) {
      const server = {
        id: `srv-${dc.id}-${i.toString().padStart(3, '0')}`,
        name: `Server ${i} - ${dc.name}`,
        type: 'Server',
        serverType: ['Web', 'App', 'DB', 'Cache'][i % 4],
        status: Math.random() > 0.05 ? 'OPERATIONAL' : 'MAINTENANCE'
      };
      servers.push(server);
      demoData.relationships.push({ from: server.id, to: dc.id, type: 'HOSTED_IN' });
    }
  });

  // Generate applications (100 total)
  const applications = [];
  const appTypes = ['WebApplication', 'APIService', 'Microservice', 'BackgroundService'];
  for (let i = 1; i <= 100; i++) {
    const app = {
      id: `app-${i.toString().padStart(3, '0')}`,
      name: `Application ${i}`,
      type: appTypes[i % appTypes.length],
      status: 'OPERATIONAL'
    };
    applications.push(app);

    // Connect apps to servers
    const randomServer = servers[Math.floor(Math.random() * servers.length)];
    demoData.relationships.push({ from: app.id, to: randomServer.id, type: 'RUNS_ON' });
  }

  // Generate databases (50 total)
  const databases = [];
  const dbTypes = ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis'];
  for (let i = 1; i <= 50; i++) {
    const db = {
      id: `db-${i.toString().padStart(3, '0')}`,
      name: `Database ${i}`,
      type: 'Database',
      dbType: dbTypes[i % dbTypes.length],
      status: 'OPERATIONAL'
    };
    databases.push(db);

    // Connect dbs to servers
    const dbServer = servers.find(s => s.serverType === 'DB') || servers[0];
    demoData.relationships.push({ from: db.id, to: dbServer.id, type: 'HOSTED_ON' });
  }

  // Generate business services
  const businessServices = [
    'E-Commerce Platform', 'Payment Processing', 'User Authentication',
    'Customer Portal', 'Analytics Platform', 'Notification Service'
  ];

  businessServices.forEach((serviceName, idx) => {
    const service = {
      id: `biz-svc-${idx.toString().padStart(2, '0')}`,
      name: serviceName,
      type: 'BusinessService',
      status: 'OPERATIONAL'
    };
    demoData.configurationItems.push(service);

    // Connect business services to applications
    const relatedApps = applications.slice(idx * 3, (idx + 1) * 3);
    relatedApps.forEach(app => {
      demoData.relationships.push({ from: app.id, to: service.id, type: 'SUPPORTS' });
    });
  });

  // Add app dependencies on databases
  applications.forEach((app, idx) => {
    if (idx < databases.length) {
      demoData.relationships.push({ from: app.id, to: databases[idx % databases.length].id, type: 'DEPENDS_ON' });
    }
  });

  // Compile all CIs
  demoData.configurationItems = [...regions, ...datacenters, ...servers, ...applications, ...databases];

  // Generate enterprise-scale events (200 events)
  const eventTemplates = [
    { message: 'High CPU utilization detected', severity: 'HIGH', type: 'PERFORMANCE' },
    { message: 'Memory usage critical', severity: 'HIGH', type: 'PERFORMANCE' },
    { message: 'API response time degraded', severity: 'MEDIUM', type: 'PERFORMANCE' },
    { message: 'Database connection pool exhausted', severity: 'CRITICAL', type: 'DATABASE' },
    { message: 'Application error rate spike', severity: 'HIGH', type: 'APPLICATION' },
    { message: 'Network latency increased', severity: 'MEDIUM', type: 'NETWORK' },
    { message: 'Disk space running low', severity: 'MEDIUM', type: 'CAPACITY' },
    { message: 'Service unavailable', severity: 'CRITICAL', type: 'AVAILABILITY' }
  ];

  const baseTime = new Date();
  const timeRange = 6 * 60 * 60 * 1000; // 6 hours

  for (let i = 0; i < 200; i++) {
    const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];
    const randomCI = demoData.configurationItems[Math.floor(Math.random() * demoData.configurationItems.length)];
    const eventTime = new Date(baseTime.getTime() - Math.random() * timeRange);

    const event = {
      id: uuidv4(),
      message: `${template.message} on ${randomCI.name}`,
      severity: template.severity,
      eventType: template.type,
      timestamp: eventTime.toISOString(),
      status: Math.random() > 0.7 ? 'RESOLVED' : 'OPEN',
      ciId: randomCI.id
    };

    demoData.events.push(event);
  }

  console.log(`✅ Enterprise demo data generated successfully!`);
  console.log(`   📊 Total CIs: ${demoData.configurationItems.length.toLocaleString()}`);
  console.log(`   🔗 Total Relationships: ${demoData.relationships.length.toLocaleString()}`);
  console.log(`   ⚡ Total Events: ${demoData.events.length.toLocaleString()}`);

  res.json({
    message: 'Enterprise-scale CMDB data generated successfully',
    totalCIs: demoData.configurationItems.length,
    totalRelationships: demoData.relationships.length,
    totalEvents: demoData.events.length,
    scale: 'enterprise',
    generatedAt: new Date().toISOString()
  });
});

// Advanced Correlation API with multi-hop analysis
app.get('/api/correlation/analyze', (req, res) => {
  const { timeWindowHours = 1, maxHops = 3, minConfidence = 0.5 } = req.query;

  console.log(`🔗 Running advanced correlation analysis...`);

  // Multi-hop relationship discovery
  function findRelationshipPath(fromCI, toCI, maxDepth = 3, visited = new Set()) {
    if (fromCI === toCI) return [fromCI];
    if (maxDepth <= 0 || visited.has(fromCI)) return null;

    visited.add(fromCI);

    // Find direct relationships
    for (const rel of demoData.relationships) {
      let nextCI = null;
      if (rel.from === fromCI) nextCI = rel.to;
      else if (rel.to === fromCI) nextCI = rel.from;

      if (nextCI && !visited.has(nextCI)) {
        if (nextCI === toCI) {
          return [fromCI, nextCI];
        }

        const path = findRelationshipPath(nextCI, toCI, maxDepth - 1, new Set(visited));
        if (path) {
          return [fromCI, ...path];
        }
      }
    }

    return null;
  }

  // Calculate correlation confidence based on multiple factors
  function calculateCorrelationConfidence(event1, event2, relationshipPath) {
    const timeDiff = Math.abs(new Date(event1.timestamp) - new Date(event2.timestamp));
    const timeWindowMs = timeWindowHours * 60 * 60 * 1000;

    // Time proximity score (closer in time = higher score)
    const timeScore = Math.max(0, (timeWindowMs - timeDiff) / timeWindowMs);

    // Relationship distance score (closer relationships = higher score)
    const distanceScore = Math.max(0, 1 - (relationshipPath.length - 2) * 0.2);

    // Severity correlation score (similar severities = higher score)
    const severityWeight = {
      'CRITICAL': 1.0, 'HIGH': 0.8, 'MEDIUM': 0.6, 'LOW': 0.4, 'INFO': 0.2
    };
    const sev1 = severityWeight[event1.severity] || 0.5;
    const sev2 = severityWeight[event2.severity] || 0.5;
    const severityScore = 1 - Math.abs(sev1 - sev2);

    // Event type correlation (related types = higher score)
    const typeScore = event1.eventType === event2.eventType ? 0.8 : 0.6;

    // Weighted average
    return (timeScore * 0.4 + distanceScore * 0.3 + severityScore * 0.2 + typeScore * 0.1);
  }

  const correlations = [];
  const processedPairs = new Set();

  // Analyze all event pairs
  demoData.events.forEach(event1 => {
    demoData.events.forEach(event2 => {
      if (event1.id === event2.id) return;

      const pairKey = [event1.id, event2.id].sort().join('-');
      if (processedPairs.has(pairKey)) return;
      processedPairs.add(pairKey);

      // Find relationship path between CIs
      const relationshipPath = findRelationshipPath(event1.ciId, event2.ciId, parseInt(maxHops));

      if (relationshipPath && relationshipPath.length > 1) {
        const confidence = calculateCorrelationConfidence(event1, event2, relationshipPath);

        if (confidence >= parseFloat(minConfidence)) {
          const ci1 = demoData.configurationItems.find(ci => ci.id === event1.ciId);
          const ci2 = demoData.configurationItems.find(ci => ci.id === event2.ciId);

          // Build relationship chain description
          const relationshipChain = [];
          for (let i = 0; i < relationshipPath.length - 1; i++) {
            const rel = demoData.relationships.find(r =>
              (r.from === relationshipPath[i] && r.to === relationshipPath[i + 1]) ||
              (r.to === relationshipPath[i] && r.from === relationshipPath[i + 1])
            );
            relationshipChain.push(rel?.type || 'RELATED');
          }

          correlations.push({
            correlationId: uuidv4(),
            correlationScore: Math.round(confidence * 1000) / 1000,
            relationshipDistance: relationshipPath.length - 1,
            relationshipPath: relationshipPath.map(ciId => {
              const ci = demoData.configurationItems.find(c => c.id === ciId);
              return { id: ciId, name: ci?.name || 'Unknown', type: ci?.type || 'Unknown' };
            }),
            relationshipChain,
            event1: {
              id: event1.id,
              message: event1.message,
              severity: event1.severity,
              eventType: event1.eventType,
              timestamp: event1.timestamp,
              ci: { id: ci1?.id, name: ci1?.name, type: ci1?.type }
            },
            event2: {
              id: event2.id,
              message: event2.message,
              severity: event2.severity,
              eventType: event2.eventType,
              timestamp: event2.timestamp,
              ci: { id: ci2?.id, name: ci2?.name, type: ci2?.type }
            },
            temporalProximity: Math.abs(new Date(event1.timestamp) - new Date(event2.timestamp)) / (1000 * 60), // minutes
            analysisMetadata: {
              timeWindowHours: parseFloat(timeWindowHours),
              maxHops: parseInt(maxHops),
              analysisTimestamp: new Date().toISOString()
            }
          });
        }
      }
    });
  });

  // Sort by correlation score descending
  correlations.sort((a, b) => b.correlationScore - a.correlationScore);

  console.log(`✅ Found ${correlations.length} correlations`);

  res.json({
    correlations: correlations.slice(0, 20), // Top 20 correlations
    summary: {
      totalCorrelations: correlations.length,
      highConfidence: correlations.filter(c => c.correlationScore >= 0.8).length,
      mediumConfidence: correlations.filter(c => c.correlationScore >= 0.6 && c.correlationScore < 0.8).length,
      lowConfidence: correlations.filter(c => c.correlationScore < 0.6).length,
      analysisParameters: {
        timeWindowHours: parseFloat(timeWindowHours),
        maxHops: parseInt(maxHops),
        minConfidence: parseFloat(minConfidence)
      }
    }
  });
});

app.get('/api/correlation/business-impact', (req, res) => {
  console.log(`💼 Calculating business impact analysis...`);

  // Enhanced business impact calculation with revenue modeling
  const businessServiceRevenue = {
    'E-Commerce Platform': { hourlyRevenue: 75000, criticalityMultiplier: 1.5 },
    'Payment Processing': { hourlyRevenue: 50000, criticalityMultiplier: 2.0 },
    'User Authentication': { hourlyRevenue: 30000, criticalityMultiplier: 1.8 },
    'Customer Portal': { hourlyRevenue: 25000, criticalityMultiplier: 1.3 },
    'Analytics Platform': { hourlyRevenue: 15000, criticalityMultiplier: 1.0 },
    'Notification Service': { hourlyRevenue: 10000, criticalityMultiplier: 1.2 }
  };

  const impacts = demoData.events.map(event => {
    const ci = demoData.configurationItems.find(c => c.id === event.ciId);

    // Base impact scoring
    let baseImpactScore = 0.3;
    if (event.severity === 'CRITICAL') baseImpactScore = 1.0;
    else if (event.severity === 'HIGH') baseImpactScore = 0.8;
    else if (event.severity === 'MEDIUM') baseImpactScore = 0.5;
    else if (event.severity === 'LOW') baseImpactScore = 0.3;

    // Find connected business services through relationship analysis
    const connectedBusinessServices = [];

    // Direct business service impact
    if (ci?.type === 'BusinessService') {
      connectedBusinessServices.push(ci);
    } else {
      // Find business services that depend on this CI (multi-hop)
      const findConnectedServices = (startCI, depth = 0, visited = new Set()) => {
        if (depth > 3 || visited.has(startCI)) return;
        visited.add(startCI);

        demoData.relationships.forEach(rel => {
          let connectedCI = null;
          if (rel.to === startCI) {
            connectedCI = demoData.configurationItems.find(c => c.id === rel.from);
          } else if (rel.from === startCI && ['SUPPORTS', 'ENABLES'].includes(rel.type)) {
            connectedCI = demoData.configurationItems.find(c => c.id === rel.to);
          }

          if (connectedCI) {
            if (connectedCI.type === 'BusinessService') {
              connectedBusinessServices.push(connectedCI);
            } else {
              findConnectedServices(connectedCI.id, depth + 1, visited);
            }
          }
        });
      };

      findConnectedServices(ci?.id);
    }

    // Calculate revenue impact
    let totalRevenueAtRisk = 0;
    let primaryBusinessService = null;

    if (connectedBusinessServices.length > 0) {
      primaryBusinessService = connectedBusinessServices[0];
      const serviceConfig = businessServiceRevenue[primaryBusinessService.name] ||
                          { hourlyRevenue: 20000, criticalityMultiplier: 1.0 };

      totalRevenueAtRisk = serviceConfig.hourlyRevenue *
                          serviceConfig.criticalityMultiplier *
                          baseImpactScore;
    }

    // CI type impact multipliers
    const ciTypeMultipliers = {
      'Database': 1.8,
      'APIService': 1.6,
      'WebApplication': 1.4,
      'BusinessService': 2.0,
      'Server': 1.2,
      'NetworkSwitch': 1.5,
      'Microservice': 1.3
    };

    const typeMultiplier = ciTypeMultipliers[ci?.type] || 1.0;
    const finalImpactScore = Math.min(1.0, baseImpactScore * typeMultiplier);

    // Customer impact estimation
    const customerImpact = {
      affectedCustomers: Math.round(totalRevenueAtRisk / 50), // Estimate based on revenue
      impactDuration: event.severity === 'CRITICAL' ? '2-4 hours' :
                     event.severity === 'HIGH' ? '30-120 minutes' : '15-60 minutes',
      serviceAvailability: Math.round((1 - finalImpactScore) * 100) + '%'
    };

    return {
      eventId: event.id,
      event: {
        id: event.id,
        message: event.message,
        severity: event.severity,
        eventType: event.eventType,
        timestamp: event.timestamp,
        status: event.status
      },
      affectedCI: {
        id: ci?.id || 'unknown',
        name: ci?.name || 'Unknown',
        type: ci?.type || 'Unknown'
      },
      primaryBusinessService: primaryBusinessService ? {
        id: primaryBusinessService.id,
        name: primaryBusinessService.name,
        criticality: primaryBusinessService.name.includes('Payment') ||
                    primaryBusinessService.name.includes('E-Commerce') ? 'CRITICAL' : 'HIGH'
      } : null,
      businessImpactScore: Math.round(finalImpactScore * 1000) / 1000,
      revenueImpact: {
        hourlyRevenueAtRisk: Math.round(totalRevenueAtRisk),
        estimatedLoss4Hours: Math.round(totalRevenueAtRisk * 4),
        currency: 'USD'
      },
      customerImpact,
      riskLevel: finalImpactScore >= 0.8 ? 'CRITICAL' :
                finalImpactScore >= 0.6 ? 'HIGH' :
                finalImpactScore >= 0.4 ? 'MEDIUM' : 'LOW',
      recommendations: [
        finalImpactScore >= 0.8 ? 'Immediate escalation required' :
        finalImpactScore >= 0.6 ? 'Priority investigation needed' : 'Monitor and assess',
        connectedBusinessServices.length > 0 ? 'Notify business stakeholders' : 'Technical team assessment',
        totalRevenueAtRisk > 50000 ? 'Activate emergency response procedures' : 'Standard incident response'
      ].filter(Boolean),
      analysisTimestamp: new Date().toISOString()
    };
  });

  // Sort by business impact score and revenue risk
  impacts.sort((a, b) => {
    const scoreA = a.businessImpactScore + (a.revenueImpact.hourlyRevenueAtRisk / 100000);
    const scoreB = b.businessImpactScore + (b.revenueImpact.hourlyRevenueAtRisk / 100000);
    return scoreB - scoreA;
  });

  const summary = {
    totalEvents: impacts.length,
    criticalImpacts: impacts.filter(i => i.riskLevel === 'CRITICAL').length,
    highImpacts: impacts.filter(i => i.riskLevel === 'HIGH').length,
    totalRevenueAtRisk: impacts.reduce((sum, i) => sum + i.revenueImpact.hourlyRevenueAtRisk, 0),
    mostImpactedServices: [...new Set(impacts
      .filter(i => i.primaryBusinessService)
      .map(i => i.primaryBusinessService.name))].slice(0, 5)
  };

  console.log(`✅ Business impact analysis completed: ${summary.criticalImpacts} critical impacts, $${summary.totalRevenueAtRisk.toLocaleString()}/hour at risk`);

  res.json({
    impacts: impacts.slice(0, 15), // Top 15 impacts
    summary
  });
});

app.get('/api/correlation/patterns', (req, res) => {
  const patterns = [];

  // Group events by CI
  const eventsByCi = {};
  demoData.events.forEach(event => {
    if (!eventsByCi[event.ciId]) {
      eventsByCi[event.ciId] = [];
    }
    eventsByCi[event.ciId].push(event);
  });

  Object.keys(eventsByCi).forEach(ciId => {
    const events = eventsByCi[ciId];
    if (events.length >= 2) {
      const ci = demoData.configurationItems.find(c => c.id === ciId);
      patterns.push({
        ci: {
          id: ciId,
          name: ci?.name || 'Unknown',
          type: ci?.type || 'Unknown'
        },
        pattern: {
          eventCount: events.length,
          severities: [...new Set(events.map(e => e.severity))],
          eventTypes: [...new Set(events.map(e => e.type || 'ALERT'))],
          timeSpanDays: 7,
          frequency: events.length / 7
        },
        recommendation: events.length >= 3 ? 'INVESTIGATE_SYSTEMATIC_ISSUE' : 'MONITOR_CLOSELY'
      });
    }
  });

  res.json(patterns);
});

// Scenario-specific endpoints for realistic demonstrations
app.post('/api/demo/scenario/:scenarioId/events', (req, res) => {
  const { scenarioId } = req.params;
  const { eventCount = 5, timeSpanMinutes = 10 } = req.body;

  // Define scenario-specific event templates
  const scenarioEventTemplates = {
    'database-cascade-failure': [
      { ciType: 'Database', severity: 'CRITICAL', message: 'Database connection pool exhausted', eventType: 'DATABASE' },
      { ciType: 'APIService', severity: 'HIGH', message: 'API response time severely degraded', eventType: 'PERFORMANCE' },
      { ciType: 'WebApplication', severity: 'HIGH', message: 'Application timeout errors increasing', eventType: 'APPLICATION' },
      { ciType: 'Server', severity: 'MEDIUM', message: 'Database server CPU spike detected', eventType: 'PERFORMANCE' },
      { ciType: 'BusinessService', severity: 'HIGH', message: 'E-commerce transactions failing', eventType: 'BUSINESS' }
    ],
    'network-infrastructure-outage': [
      { ciType: 'NetworkSwitch', severity: 'CRITICAL', message: 'Core network switch interface failure', eventType: 'NETWORK' },
      { ciType: 'Server', severity: 'HIGH', message: 'Server network connectivity lost', eventType: 'CONNECTIVITY' },
      { ciType: 'Application', severity: 'HIGH', message: 'Application cluster communication failure', eventType: 'CLUSTER' },
      { ciType: 'Server', severity: 'MEDIUM', message: 'Network latency spike detected', eventType: 'PERFORMANCE' }
    ],
    'api-gateway-failure': [
      { ciType: 'APIService', severity: 'CRITICAL', message: 'API gateway service crashed', eventType: 'AVAILABILITY' },
      { ciType: 'WebApplication', severity: 'CRITICAL', message: 'Frontend unable to reach backend APIs', eventType: 'CONNECTIVITY' },
      { ciType: 'Microservice', severity: 'HIGH', message: 'Microservice authentication failures', eventType: 'AUTHENTICATION' },
      { ciType: 'BusinessService', severity: 'HIGH', message: 'Customer portal inaccessible', eventType: 'BUSINESS' }
    ]
  };

  const templates = scenarioEventTemplates[scenarioId] || scenarioEventTemplates['database-cascade-failure'];
  const createdEvents = [];
  const baseTime = new Date();
  const timeSpanMs = timeSpanMinutes * 60 * 1000;

  // Find CIs matching the scenario requirements
  templates.slice(0, eventCount).forEach((template, idx) => {
    const matchingCIs = demoData.configurationItems.filter(ci => {
      if (template.ciType === 'NetworkSwitch' && ci.type === 'NetworkSwitch') return true;
      if (template.ciType === 'Database' && ci.type === 'Database') return true;
      if (template.ciType === 'APIService' && ci.type === 'APIService') return true;
      if (template.ciType === 'WebApplication' && ci.type === 'WebApplication') return true;
      if (template.ciType === 'Microservice' && ci.type === 'Microservice') return true;
      if (template.ciType === 'Server' && ci.type === 'Server') return true;
      if (template.ciType === 'BusinessService' && ci.type === 'BusinessService') return true;
      if (template.ciType === 'Application' && (ci.type.includes('Application') || ci.type.includes('Service'))) return true;
      return false;
    });

    const targetCI = matchingCIs[Math.floor(Math.random() * matchingCIs.length)] ||
                     demoData.configurationItems[Math.floor(Math.random() * demoData.configurationItems.length)];

    // Distribute events over time span with realistic timing
    const timeOffset = (idx / eventCount) * timeSpanMs + (Math.random() - 0.5) * (timeSpanMs / 5);
    const eventTime = new Date(baseTime.getTime() - timeSpanMs + timeOffset);

    const event = {
      id: uuidv4(),
      message: `${template.message} - ${targetCI.name}`,
      severity: template.severity,
      eventType: template.eventType,
      timestamp: eventTime.toISOString(),
      status: 'OPEN',
      ciId: targetCI.id,
      metadata: JSON.stringify({
        scenario: scenarioId,
        simulatedAt: new Date().toISOString(),
        correlationTarget: true
      })
    };

    demoData.events.unshift(event);
    createdEvents.push(event);
  });

  res.json({
    scenario: scenarioId,
    eventsCreated: createdEvents.length,
    timeSpanMinutes,
    events: createdEvents,
    correlationReady: true,
    message: `Created ${createdEvents.length} scenario events for ${scenarioId}`
  });
});

// Cascade event simulation
app.post('/api/demo/simulate-cascade', (req, res) => {
  const { rootComponentId, cascadeDepth = 3, timeDelayMinutes = 5 } = req.body;

  // Find a root component if not specified
  const rootCI = rootComponentId ?
    demoData.configurationItems.find(ci => ci.id === rootComponentId) :
    demoData.configurationItems.find(ci => ci.type === 'Database' || ci.type === 'Server');

  if (!rootCI) {
    return res.status(404).json({ error: 'No suitable root component found for cascade simulation' });
  }

  // Find dependent components through relationships
  const cascadeEvents = [];
  const baseTime = new Date();
  const timeDelayMs = timeDelayMinutes * 60 * 1000;

  // Create root event
  const rootEvent = {
    id: uuidv4(),
    message: `Cascade failure initiated from ${rootCI.name}`,
    severity: 'CRITICAL',
    eventType: 'CASCADE_ROOT',
    timestamp: baseTime.toISOString(),
    status: 'OPEN',
    ciId: rootCI.id,
    metadata: JSON.stringify({
      cascadeRoot: true,
      cascadeId: uuidv4(),
      simulatedAt: new Date().toISOString()
    })
  };

  demoData.events.unshift(rootEvent);
  cascadeEvents.push(rootEvent);

  // Find components that depend on or are connected to the root
  const affectedComponents = [];

  // Direct dependencies
  demoData.relationships.forEach(rel => {
    if (rel.to === rootCI.id) {
      const dependentCI = demoData.configurationItems.find(ci => ci.id === rel.from);
      if (dependentCI) {
        affectedComponents.push({ ci: dependentCI, distance: 1, relationship: rel.type });
      }
    }
  });

  // Second level dependencies
  affectedComponents.slice().forEach(comp => {
    if (comp.distance === 1) {
      demoData.relationships.forEach(rel => {
        if (rel.to === comp.ci.id && !affectedComponents.find(ac => ac.ci.id === rel.from)) {
          const secondLevelCI = demoData.configurationItems.find(ci => ci.id === rel.from);
          if (secondLevelCI) {
            affectedComponents.push({ ci: secondLevelCI, distance: 2, relationship: rel.type });
          }
        }
      });
    }
  });

  // Create cascade events with realistic timing
  affectedComponents.slice(0, Math.min(10, affectedComponents.length)).forEach((comp, idx) => {
    const cascadeDelay = comp.distance * timeDelayMs / 3; // Stagger by distance
    const jitter = (Math.random() - 0.5) * timeDelayMs / 4; // Add randomness
    const eventTime = new Date(baseTime.getTime() + cascadeDelay + jitter);

    let severity = comp.distance === 1 ? 'HIGH' : 'MEDIUM';
    if (comp.ci.type === 'BusinessService') severity = 'HIGH';

    const cascadeEvent = {
      id: uuidv4(),
      message: `Cascade impact: ${comp.ci.name} affected by upstream failure`,
      severity,
      eventType: 'CASCADE_IMPACT',
      timestamp: eventTime.toISOString(),
      status: 'OPEN',
      ciId: comp.ci.id,
      metadata: JSON.stringify({
        cascadeDistance: comp.distance,
        relationshipType: comp.relationship,
        rootCause: rootCI.id,
        simulatedAt: new Date().toISOString()
      })
    };

    demoData.events.unshift(cascadeEvent);
    cascadeEvents.push(cascadeEvent);
  });

  res.json({
    cascadeId: JSON.parse(rootEvent.metadata).cascadeId,
    rootComponent: rootCI.name,
    eventsCreated: cascadeEvents.length,
    timespan: `${timeDelayMinutes} minutes`,
    cascadeDepth,
    events: cascadeEvents,
    correlationReady: true,
    message: `Simulated cascade failure with ${cascadeEvents.length} events`
  });
});

// Real-time event streaming simulation
let eventStreamInterval = null;

app.post('/api/demo/start-event-stream', (req, res) => {
  const { intervalSeconds = 10, eventTypes = ['PERFORMANCE', 'AVAILABILITY', 'CAPACITY'] } = req.body;

  if (eventStreamInterval) {
    clearInterval(eventStreamInterval);
  }

  const streamTemplates = [
    { message: 'CPU utilization spike', severity: 'MEDIUM', type: 'PERFORMANCE' },
    { message: 'Memory threshold exceeded', severity: 'MEDIUM', type: 'PERFORMANCE' },
    { message: 'Service response time degraded', severity: 'HIGH', type: 'PERFORMANCE' },
    { message: 'Network latency increased', severity: 'MEDIUM', type: 'NETWORK' },
    { message: 'Disk space warning', severity: 'LOW', type: 'CAPACITY' },
    { message: 'Application error rate increased', severity: 'HIGH', type: 'APPLICATION' }
  ];

  eventStreamInterval = setInterval(() => {
    const template = streamTemplates[Math.floor(Math.random() * streamTemplates.length)];
    const randomCI = demoData.configurationItems[Math.floor(Math.random() * demoData.configurationItems.length)];

    const streamEvent = {
      id: uuidv4(),
      message: `${template.message} - ${randomCI.name}`,
      severity: template.severity,
      eventType: template.type,
      timestamp: new Date().toISOString(),
      status: 'OPEN',
      ciId: randomCI.id,
      metadata: JSON.stringify({
        streamed: true,
        streamedAt: new Date().toISOString()
      })
    };

    demoData.events.unshift(streamEvent);

    // Keep only last 500 events to prevent memory issues
    if (demoData.events.length > 500) {
      demoData.events = demoData.events.slice(0, 500);
    }
  }, intervalSeconds * 1000);

  res.json({
    message: 'Event stream started',
    intervalSeconds,
    eventTypes,
    status: 'streaming'
  });
});

app.post('/api/demo/stop-event-stream', (req, res) => {
  if (eventStreamInterval) {
    clearInterval(eventStreamInterval);
    eventStreamInterval = null;
  }

  res.json({
    message: 'Event stream stopped',
    status: 'stopped'
  });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected to WebSocket');

  socket.on('disconnect', () => {
    console.log('User disconnected from WebSocket');
  });
});

server.listen(PORT, () => {
  console.log(`🔗 Fancy CMDB Concept Demo running on port ${PORT}`);
  console.log(`📊 Application: http://localhost:${PORT}`);
  console.log(`🎯 This is a simplified demo with in-memory data`);
  console.log(`🚀 All features are working - try the demo!`);
});