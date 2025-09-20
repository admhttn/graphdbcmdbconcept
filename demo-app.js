const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
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

// Correlation API (simplified demo)
app.get('/api/correlation/analyze', (req, res) => {
  // Simple correlation demo - find events affecting related CIs
  const correlations = [];

  demoData.events.forEach(event1 => {
    demoData.events.forEach(event2 => {
      if (event1.id !== event2.id) {
        // Check if CIs are related
        const related = demoData.relationships.find(rel =>
          (rel.from === event1.ciId && rel.to === event2.ciId) ||
          (rel.to === event1.ciId && rel.from === event2.ciId)
        );

        if (related) {
          const timeDiff = Math.abs(new Date(event1.timestamp) - new Date(event2.timestamp));
          if (timeDiff < 3600000) { // Within 1 hour
            correlations.push({
              correlationScore: 0.8,
              relationshipDistance: 1,
              event1: {
                id: event1.id,
                message: event1.message,
                severity: event1.severity,
                timestamp: event1.timestamp,
                ci: demoData.configurationItems.find(ci => ci.id === event1.ciId)?.name
              },
              event2: {
                id: event2.id,
                message: event2.message,
                severity: event2.severity,
                timestamp: event2.timestamp,
                ci: demoData.configurationItems.find(ci => ci.id === event2.ciId)?.name
              }
            });
          }
        }
      }
    });
  });

  res.json(correlations.slice(0, 10)); // Limit results
});

app.get('/api/correlation/business-impact', (req, res) => {
  const impacts = demoData.events.map(event => {
    const ci = demoData.configurationItems.find(c => c.id === event.ciId);
    let impactScore = 0.5;

    if (event.severity === 'CRITICAL') impactScore = 1.0;
    else if (event.severity === 'HIGH') impactScore = 0.8;
    else if (event.severity === 'MEDIUM') impactScore = 0.5;

    return {
      event: {
        id: event.id,
        message: event.message,
        severity: event.severity,
        timestamp: event.timestamp
      },
      affectedCI: {
        name: ci?.name || 'Unknown',
        type: ci?.type || 'Unknown'
      },
      businessService: ci?.type === 'Application' ? {
        name: `${ci.name} Service`,
        criticality: 'HIGH'
      } : null,
      businessImpactScore: impactScore
    };
  });

  res.json(impacts.sort((a, b) => b.businessImpactScore - a.businessImpactScore));
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
app.listen(PORT, () => {
  console.log(`🔗 Fancy CMDB Concept Demo running on port ${PORT}`);
  console.log(`📊 Application: http://localhost:${PORT}`);
  console.log(`🎯 This is a simplified demo with in-memory data`);
  console.log(`🚀 All features are working - try the demo!`);
});