const { runWriteQuery } = require('../services/neo4j');

// Sample CMDB data creation functions
async function createSampleCMDB() {
  console.log('Creating sample CMDB data...');

  try {
    // Clear existing data
    await runWriteQuery('MATCH (n) DETACH DELETE n');

    // Create Configuration Items
    await createConfigurationItems();

    // Create relationships
    await createRelationships();

    // Create business services
    await createBusinessServices();

    // Create sample events
    await createSampleEvents();

    console.log('Sample CMDB data created successfully');
  } catch (error) {
    console.error('Error creating sample data:', error);
    throw error;
  }
}

async function createConfigurationItems() {
  const ciData = [
    // Infrastructure Layer
    {
      id: 'dc-nyc-01',
      name: 'NYC Data Center Primary',
      type: 'DataCenter',
      location: 'New York, NY',
      criticality: 'CRITICAL',
      status: 'OPERATIONAL'
    },
    {
      id: 'fw-nyc-01',
      name: 'Main Firewall NYC',
      type: 'Firewall',
      vendor: 'Cisco',
      model: 'ASA 5525-X',
      criticality: 'CRITICAL',
      status: 'OPERATIONAL'
    },
    {
      id: 'sw-core-01',
      name: 'Core Switch 1',
      type: 'NetworkSwitch',
      vendor: 'Cisco',
      model: 'Catalyst 9500',
      criticality: 'CRITICAL',
      status: 'OPERATIONAL'
    },
    {
      id: 'sw-core-02',
      name: 'Core Switch 2',
      type: 'NetworkSwitch',
      vendor: 'Cisco',
      model: 'Catalyst 9500',
      criticality: 'CRITICAL',
      status: 'OPERATIONAL'
    },
    {
      id: 'lb-prod-01',
      name: 'Production Load Balancer',
      type: 'LoadBalancer',
      vendor: 'F5',
      model: 'BIG-IP',
      criticality: 'HIGH',
      status: 'OPERATIONAL'
    },

    // Server Infrastructure
    {
      id: 'srv-web-01',
      name: 'Web Server 1',
      type: 'Server',
      os: 'Ubuntu 22.04',
      cpu: '16 cores',
      memory: '32GB',
      criticality: 'HIGH',
      status: 'OPERATIONAL'
    },
    {
      id: 'srv-web-02',
      name: 'Web Server 2',
      type: 'Server',
      os: 'Ubuntu 22.04',
      cpu: '16 cores',
      memory: '32GB',
      criticality: 'HIGH',
      status: 'OPERATIONAL'
    },
    {
      id: 'srv-app-01',
      name: 'Application Server 1',
      type: 'Server',
      os: 'RHEL 8',
      cpu: '32 cores',
      memory: '64GB',
      criticality: 'CRITICAL',
      status: 'OPERATIONAL'
    },
    {
      id: 'srv-app-02',
      name: 'Application Server 2',
      type: 'Server',
      os: 'RHEL 8',
      cpu: '32 cores',
      memory: '64GB',
      criticality: 'CRITICAL',
      status: 'OPERATIONAL'
    },
    {
      id: 'srv-db-01',
      name: 'Database Server Primary',
      type: 'DatabaseServer',
      os: 'RHEL 8',
      cpu: '64 cores',
      memory: '256GB',
      storage: '10TB SSD',
      criticality: 'CRITICAL',
      status: 'OPERATIONAL'
    },
    {
      id: 'srv-db-02',
      name: 'Database Server Replica',
      type: 'DatabaseServer',
      os: 'RHEL 8',
      cpu: '64 cores',
      memory: '256GB',
      storage: '10TB SSD',
      criticality: 'HIGH',
      status: 'OPERATIONAL'
    },

    // Applications
    {
      id: 'app-ecommerce',
      name: 'E-Commerce Platform',
      type: 'Application',
      version: '2.4.1',
      technology: 'Java Spring Boot',
      criticality: 'CRITICAL',
      status: 'OPERATIONAL'
    },
    {
      id: 'app-crm',
      name: 'Customer Relationship Management',
      type: 'Application',
      version: '3.1.0',
      technology: 'Node.js',
      criticality: 'HIGH',
      status: 'OPERATIONAL'
    },
    {
      id: 'app-analytics',
      name: 'Business Analytics Platform',
      type: 'Application',
      version: '1.2.5',
      technology: 'Python Django',
      criticality: 'MEDIUM',
      status: 'OPERATIONAL'
    },

    // Databases
    {
      id: 'db-ecommerce-prod',
      name: 'E-Commerce Production DB',
      type: 'Database',
      dbType: 'PostgreSQL',
      version: '14.9',
      size: '2.5TB',
      criticality: 'CRITICAL',
      status: 'OPERATIONAL'
    },
    {
      id: 'db-crm-prod',
      name: 'CRM Production DB',
      type: 'Database',
      dbType: 'MySQL',
      version: '8.0',
      size: '500GB',
      criticality: 'HIGH',
      status: 'OPERATIONAL'
    },
    {
      id: 'db-analytics-prod',
      name: 'Analytics Data Warehouse',
      type: 'Database',
      dbType: 'MongoDB',
      version: '6.0',
      size: '5TB',
      criticality: 'MEDIUM',
      status: 'OPERATIONAL'
    },

    // Monitoring Infrastructure
    {
      id: 'mon-prometheus',
      name: 'Prometheus Monitoring',
      type: 'MonitoringSystem',
      version: '2.45.0',
      criticality: 'HIGH',
      status: 'OPERATIONAL'
    },
    {
      id: 'mon-grafana',
      name: 'Grafana Dashboard',
      type: 'MonitoringSystem',
      version: '10.0.3',
      criticality: 'MEDIUM',
      status: 'OPERATIONAL'
    }
  ];

  for (const ci of ciData) {
    ci.createdAt = new Date().toISOString();
    ci.updatedAt = new Date().toISOString();

    const cypher = 'CREATE (ci:ConfigurationItem $ciData) RETURN ci.id';
    await runWriteQuery(cypher, { ciData: ci });
  }

  console.log(`Created ${ciData.length} Configuration Items`);
}

async function createRelationships() {
  const relationships = [
    // Infrastructure dependencies
    { from: 'fw-nyc-01', to: 'dc-nyc-01', type: 'HOSTED_IN' },
    { from: 'sw-core-01', to: 'dc-nyc-01', type: 'HOSTED_IN' },
    { from: 'sw-core-02', to: 'dc-nyc-01', type: 'HOSTED_IN' },
    { from: 'lb-prod-01', to: 'dc-nyc-01', type: 'HOSTED_IN' },

    // Network dependencies
    { from: 'sw-core-01', to: 'fw-nyc-01', type: 'CONNECTS_TO' },
    { from: 'sw-core-02', to: 'fw-nyc-01', type: 'CONNECTS_TO' },
    { from: 'lb-prod-01', to: 'sw-core-01', type: 'CONNECTS_TO' },
    { from: 'lb-prod-01', to: 'sw-core-02', type: 'CONNECTS_TO' },

    // Server hosting
    { from: 'srv-web-01', to: 'dc-nyc-01', type: 'HOSTED_IN' },
    { from: 'srv-web-02', to: 'dc-nyc-01', type: 'HOSTED_IN' },
    { from: 'srv-app-01', to: 'dc-nyc-01', type: 'HOSTED_IN' },
    { from: 'srv-app-02', to: 'dc-nyc-01', type: 'HOSTED_IN' },
    { from: 'srv-db-01', to: 'dc-nyc-01', type: 'HOSTED_IN' },
    { from: 'srv-db-02', to: 'dc-nyc-01', type: 'HOSTED_IN' },

    // Server network connections
    { from: 'srv-web-01', to: 'sw-core-01', type: 'CONNECTS_TO' },
    { from: 'srv-web-02', to: 'sw-core-02', type: 'CONNECTS_TO' },
    { from: 'srv-app-01', to: 'sw-core-01', type: 'CONNECTS_TO' },
    { from: 'srv-app-02', to: 'sw-core-02', type: 'CONNECTS_TO' },
    { from: 'srv-db-01', to: 'sw-core-01', type: 'CONNECTS_TO' },
    { from: 'srv-db-02', to: 'sw-core-02', type: 'CONNECTS_TO' },

    // Load balancer relationships
    { from: 'lb-prod-01', to: 'srv-web-01', type: 'BALANCES_TO' },
    { from: 'lb-prod-01', to: 'srv-web-02', type: 'BALANCES_TO' },

    // Application hosting
    { from: 'app-ecommerce', to: 'srv-app-01', type: 'RUNS_ON' },
    { from: 'app-ecommerce', to: 'srv-app-02', type: 'RUNS_ON' },
    { from: 'app-crm', to: 'srv-web-01', type: 'RUNS_ON' },
    { from: 'app-analytics', to: 'srv-web-02', type: 'RUNS_ON' },

    // Database hosting
    { from: 'db-ecommerce-prod', to: 'srv-db-01', type: 'RUNS_ON' },
    { from: 'db-crm-prod', to: 'srv-db-01', type: 'RUNS_ON' },
    { from: 'db-analytics-prod', to: 'srv-db-02', type: 'RUNS_ON' },

    // Application-Database dependencies
    { from: 'app-ecommerce', to: 'db-ecommerce-prod', type: 'DEPENDS_ON' },
    { from: 'app-crm', to: 'db-crm-prod', type: 'DEPENDS_ON' },
    { from: 'app-analytics', to: 'db-analytics-prod', type: 'DEPENDS_ON' },

    // Database replication
    { from: 'db-ecommerce-prod', to: 'srv-db-02', type: 'REPLICATES_TO' },

    // Monitoring relationships
    { from: 'mon-prometheus', to: 'srv-web-01', type: 'MONITORS' },
    { from: 'mon-prometheus', to: 'srv-web-02', type: 'MONITORS' },
    { from: 'mon-prometheus', to: 'srv-app-01', type: 'MONITORS' },
    { from: 'mon-prometheus', to: 'srv-app-02', type: 'MONITORS' },
    { from: 'mon-prometheus', to: 'srv-db-01', type: 'MONITORS' },
    { from: 'mon-prometheus', to: 'srv-db-02', type: 'MONITORS' },
    { from: 'mon-grafana', to: 'mon-prometheus', type: 'DEPENDS_ON' }
  ];

  for (const rel of relationships) {
    const cypher = `
      MATCH (from:ConfigurationItem {id: $fromId})
      MATCH (to:ConfigurationItem {id: $toId})
      CREATE (from)-[:${rel.type}]->(to)
    `;
    await runWriteQuery(cypher, { fromId: rel.from, toId: rel.to });
  }

  console.log(`Created ${relationships.length} relationships`);
}

async function createBusinessServices() {
  const services = [
    {
      id: 'svc-ecommerce',
      name: 'E-Commerce Service',
      type: 'BusinessService',
      criticality: 'CRITICAL',
      sla: '99.9%',
      owner: 'Digital Commerce Team',
      status: 'OPERATIONAL'
    },
    {
      id: 'svc-customer-mgmt',
      name: 'Customer Management Service',
      type: 'BusinessService',
      criticality: 'HIGH',
      sla: '99.5%',
      owner: 'Customer Experience Team',
      status: 'OPERATIONAL'
    },
    {
      id: 'svc-analytics',
      name: 'Business Intelligence Service',
      type: 'BusinessService',
      criticality: 'MEDIUM',
      sla: '99.0%',
      owner: 'Data Analytics Team',
      status: 'OPERATIONAL'
    }
  ];

  for (const service of services) {
    service.createdAt = new Date().toISOString();
    service.updatedAt = new Date().toISOString();

    const cypher = 'CREATE (s:Service $serviceData) RETURN s.id';
    await runWriteQuery(cypher, { serviceData: service });
  }

  // Link services to supporting CIs
  const serviceSupport = [
    { service: 'svc-ecommerce', ci: 'app-ecommerce' },
    { service: 'svc-ecommerce', ci: 'db-ecommerce-prod' },
    { service: 'svc-ecommerce', ci: 'lb-prod-01' },
    { service: 'svc-customer-mgmt', ci: 'app-crm' },
    { service: 'svc-customer-mgmt', ci: 'db-crm-prod' },
    { service: 'svc-analytics', ci: 'app-analytics' },
    { service: 'svc-analytics', ci: 'db-analytics-prod' }
  ];

  for (const support of serviceSupport) {
    const cypher = `
      MATCH (ci:ConfigurationItem {id: $ciId})
      MATCH (s:Service {id: $serviceId})
      CREATE (ci)-[:SUPPORTS]->(s)
    `;
    await runWriteQuery(cypher, { ciId: support.ci, serviceId: support.service });
  }

  console.log(`Created ${services.length} business services`);
}

async function createSampleEvents() {
  const events = [
    {
      id: 'evt-001',
      source: 'monitoring.cpu',
      message: 'High CPU utilization on srv-app-01',
      severity: 'HIGH',
      eventType: 'PERFORMANCE',
      ciId: 'srv-app-01',
      status: 'OPEN',
      metadata: { cpu_percent: 87, threshold: 80 }
    },
    {
      id: 'evt-002',
      source: 'monitoring.memory',
      message: 'Memory usage approaching limit on srv-db-01',
      severity: 'MEDIUM',
      eventType: 'PERFORMANCE',
      ciId: 'srv-db-01',
      status: 'ACKNOWLEDGED',
      metadata: { memory_percent: 91, threshold: 90 }
    },
    {
      id: 'evt-003',
      source: 'application.api',
      message: 'E-commerce API response time degraded',
      severity: 'HIGH',
      eventType: 'PERFORMANCE',
      ciId: 'app-ecommerce',
      status: 'OPEN',
      metadata: { avg_response_time: 2500, threshold: 1000 }
    },
    {
      id: 'evt-004',
      source: 'network.interface',
      message: 'Network interface down on sw-core-01',
      severity: 'CRITICAL',
      eventType: 'AVAILABILITY',
      ciId: 'sw-core-01',
      status: 'RESOLVED',
      metadata: { interface: 'GigabitEthernet1/0/24', duration: '5 minutes' }
    },
    {
      id: 'evt-005',
      source: 'database.replication',
      message: 'Database replication lag detected',
      severity: 'MEDIUM',
      eventType: 'DATA',
      ciId: 'db-ecommerce-prod',
      status: 'OPEN',
      metadata: { lag_seconds: 45, threshold: 30 }
    }
  ];

  for (const event of events) {
    const timestamp = new Date(Date.now() - Math.random() * 3600000).toISOString();
    event.timestamp = timestamp;
    event.correlationScore = Math.random() * 0.8;

    // Convert metadata object to JSON string for Neo4j compatibility
    if (event.metadata && typeof event.metadata === 'object') {
      event.metadata = JSON.stringify(event.metadata);
    }

    const cypher = `
      MATCH (ci:ConfigurationItem {id: $ciId})
      CREATE (e:Event $eventData)
      CREATE (e)-[:AFFECTS]->(ci)
      RETURN e.id
    `;
    await runWriteQuery(cypher, { eventData: event, ciId: event.ciId });
  }

  console.log(`Created ${events.length} sample events`);
}

module.exports = {
  createSampleCMDB,
  createConfigurationItems,
  createRelationships,
  createBusinessServices,
  createSampleEvents
};