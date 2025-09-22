// Test fixtures for consistent test data

const sampleCIs = [
  {
    id: 'test-server-01',
    name: 'Test Web Server 01',
    type: 'Server',
    status: 'Running',
    environment: 'Production',
    location: 'DC1',
    properties: {
      ip: '192.168.1.100',
      os: 'Ubuntu 22.04',
      cpu: '8 cores',
      memory: '32GB'
    }
  },
  {
    id: 'test-app-01',
    name: 'Test Web Application',
    type: 'Application',
    status: 'Running',
    environment: 'Production',
    location: 'DC1',
    properties: {
      version: '2.1.0',
      port: '8080',
      language: 'Node.js'
    }
  },
  {
    id: 'test-db-01',
    name: 'Test Database',
    type: 'Database',
    status: 'Running',
    environment: 'Production',
    location: 'DC1',
    properties: {
      engine: 'PostgreSQL',
      version: '14.2',
      size: '500GB'
    }
  }
];

const sampleRelationships = [
  {
    source: 'test-app-01',
    target: 'test-server-01',
    type: 'runs_on',
    properties: {}
  },
  {
    source: 'test-app-01',
    target: 'test-db-01',
    type: 'depends_on',
    properties: {
      connection_type: 'tcp',
      port: 5432
    }
  }
];

const sampleEvents = [
  {
    id: 'test-event-01',
    severity: 'HIGH',
    message: 'High CPU usage detected',
    source: 'test-server-01',
    timestamp: new Date().toISOString(),
    status: 'Open',
    category: 'Performance'
  },
  {
    id: 'test-event-02',
    severity: 'CRITICAL',
    message: 'Database connection failure',
    source: 'test-db-01',
    timestamp: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    status: 'Open',
    category: 'Connectivity'
  },
  {
    id: 'test-event-03',
    severity: 'MEDIUM',
    message: 'Application response time increased',
    source: 'test-app-01',
    timestamp: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
    status: 'Open',
    category: 'Performance'
  }
];

const sampleCorrelations = [
  {
    id: 'test-correlation-01',
    score: 0.85,
    type: 'temporal',
    description: 'Database failure caused application slowdown',
    events: ['test-event-02', 'test-event-03'],
    timeWindow: '15m',
    confidence: 'high'
  }
];

const expectedDataCounts = {
  small: {
    minCIs: 800,
    maxCIs: 1200,
    minRelationships: 1000,
    maxRelationships: 2000
  },
  medium: {
    minCIs: 8000,
    maxCIs: 12000,
    minRelationships: 15000,
    maxRelationships: 25000
  },
  large: {
    minCIs: 45000,
    maxCIs: 55000,
    minRelationships: 80000,
    maxRelationships: 120000
  }
};

const testScenarios = {
  'database-cascade-failure': {
    name: 'Database Cascade Failure',
    description: 'Simulates database failure cascading to dependent applications',
    expectedEvents: 5,
    expectedCorrelations: 2,
    expectedSeverities: ['CRITICAL', 'HIGH', 'MEDIUM']
  },
  'network-infrastructure-outage': {
    name: 'Network Infrastructure Outage',
    description: 'Simulates network switch failure affecting multiple servers',
    expectedEvents: 8,
    expectedCorrelations: 3,
    expectedSeverities: ['CRITICAL', 'HIGH']
  },
  'api-gateway-failure': {
    name: 'API Gateway Failure',
    description: 'Simulates API gateway failure affecting microservices',
    expectedEvents: 6,
    expectedCorrelations: 2,
    expectedSeverities: ['CRITICAL', 'HIGH', 'MEDIUM']
  }
};

module.exports = {
  sampleCIs,
  sampleRelationships,
  sampleEvents,
  sampleCorrelations,
  expectedDataCounts,
  testScenarios
};