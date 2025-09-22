const express = require('express');
const neo4j = require('neo4j-driver');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const { createSampleCMDB } = require('../models/sampleData');
const { createDemoEnterpriseData } = require('../models/demoEnterpriseData');
const { runReadQuery, runWriteQuery } = require('../services/neo4j');

const router = express.Router();


// Load sample data - DEPRECATED: Use /api/jobs with scale='sample' instead
router.post('/sample-data', async (req, res) => {
  try {
    console.warn('⚠️  DEPRECATED: /api/demo/sample-data endpoint is deprecated. Use Data Generation tab with /api/jobs instead.');
    await createSampleCMDB();
    res.json({
      message: 'Sample CMDB data loaded successfully',
      deprecated: true,
      recommendation: 'Use Data Generation tab for consistent data generation experience'
    });
  } catch (error) {
    console.error('Error loading sample data:', error);
    res.status(500).json({ error: 'Failed to load sample data' });
  }
});

// Load enterprise-scale data (50,000+ CIs) - DEPRECATED: Use /api/jobs with scale='large' instead
router.post('/enterprise-data', async (req, res) => {
  try {
    console.warn('⚠️  DEPRECATED: /api/demo/enterprise-data endpoint is deprecated. Use Data Generation tab with /api/jobs instead.');
    console.log('🏢 Starting enterprise-scale CMDB generation...');
    const result = await createDemoEnterpriseData();

    res.json({
      ...result,
      message: 'Enterprise-scale CMDB data generated successfully',
      scale: 'enterprise',
      generatedAt: new Date().toISOString(),
      deprecated: true,
      recommendation: 'Use Data Generation tab with worker-based generation for better performance and progress tracking'
    });
  } catch (error) {
    console.error('Error generating enterprise data:', error);
    res.status(500).json({ error: 'Failed to generate enterprise data' });
  }
});

// Multi-hop impact analysis - showcases graph database advantages
router.get('/impact-analysis/:componentId', async (req, res) => {
  try {
    const { componentId } = req.params;
    const { maxDepth = 6, direction = 'downstream' } = req.query;

    let relationshipDirection = '';
    if (direction === 'upstream') {
      relationshipDirection = '<-[r:DEPENDS_ON|RUNS_ON|SUPPORTS|USES|INTEGRATES_WITH|MUST_COMPLY_WITH*1..' + maxDepth + ']-';
    } else if (direction === 'downstream') {
      relationshipDirection = '-[r:DEPENDS_ON|RUNS_ON|SUPPORTS|USES|INTEGRATES_WITH|MUST_COMPLY_WITH*1..' + maxDepth + ']->';
    } else { // both directions
      relationshipDirection = '-[r:DEPENDS_ON|RUNS_ON|SUPPORTS|USES|INTEGRATES_WITH|MUST_COMPLY_WITH*1..' + maxDepth + ']-';
    }

    // Graph Database Advantage: Variable-depth traversal with impact calculation
    const cypher = `
      MATCH (source:ConfigurationItem {id: $componentId})
      MATCH path = (source)${relationshipDirection}(target)

      WITH source, target, path, length(path) as hopDistance,
           [rel in relationships(path) | type(rel)] as relationshipChain,
           [node in nodes(path) | {
             id: node.id,
             name: node.name,
             type: coalesce(node.type, head(labels(node))),
             criticality: node.criticality
           }] as dependencyPath

      // Calculate impact scores based on relationship distance and criticality
      WITH source, target, path, hopDistance, relationshipChain, dependencyPath,
           CASE target.criticality
             WHEN 'CRITICAL' THEN 1.0
             WHEN 'HIGH' THEN 0.8
             WHEN 'MEDIUM' THEN 0.6
             WHEN 'LOW' THEN 0.4
             ELSE 0.2
           END as criticalityScore,

           // Distance decay factor
           1.0 / hopDistance as distanceScore

      WITH source, target, path, hopDistance, relationshipChain, dependencyPath,
           criticalityScore * distanceScore as impactScore

      // Calculate business impact for customer segments
      OPTIONAL MATCH (target)-[:USES*0..2]->(service:Service)
      OPTIONAL MATCH (customerSegment)-[:USES]->(service)
      WHERE customerSegment.type = 'CustomerSegment'

      WITH source, target, path, hopDistance, relationshipChain, dependencyPath, impactScore,
           service, customerSegment,
           coalesce(customerSegment.revenue_per_hour, 0) as revenueImpact

      RETURN target.id as componentId,
             target.name as componentName,
             target.type as componentType,
             target.criticality as criticality,
             hopDistance,
             relationshipChain,
             dependencyPath,
             round(impactScore, 3) as impactScore,
             service.name as affectedBusinessService,
             customerSegment.name as affectedCustomerSegment,
             revenueImpact as hourlyRevenueAtRisk,

             // Risk classification
             CASE
               WHEN impactScore >= 0.8 THEN 'CRITICAL_IMPACT'
               WHEN impactScore >= 0.6 THEN 'HIGH_IMPACT'
               WHEN impactScore >= 0.4 THEN 'MEDIUM_IMPACT'
               ELSE 'LOW_IMPACT'
             END as riskLevel

      ORDER BY impactScore DESC, hopDistance ASC
      LIMIT $resultLimit
    `;

    const startTime = Date.now();
    const impactResults = await runReadQuery(cypher, {
      componentId,
      resultLimit: neo4j.int(50)
    });
    const executionTime = Date.now() - startTime;

    // Calculate total business impact (handle Neo4j BigInt values)
    const totalRevenueAtRisk = impactResults.reduce((sum, result) => {
      const revenue = result.hourlyRevenueAtRisk;
      if (revenue === null || revenue === undefined) return sum;
      // Convert Neo4j BigInt to regular number
      const revenueValue = typeof revenue === 'bigint' ? Number(revenue) : Number(revenue) || 0;
      return sum + revenueValue;
    }, 0);

    const criticalImpacts = impactResults.filter(r => r.riskLevel === 'CRITICAL_IMPACT').length;
    const highImpacts = impactResults.filter(r => r.riskLevel === 'HIGH_IMPACT').length;

    res.json({
      sourceComponent: {
        id: componentId,
        analysisDirection: direction,
        maxDepth: parseInt(maxDepth)
      },
      impactSummary: {
        totalAffectedComponents: impactResults.length,
        criticalImpacts,
        highImpacts,
        totalHourlyRevenueAtRisk: totalRevenueAtRisk,
        executionTimeMs: executionTime
      },
      impactDetails: impactResults,
      graphAdvantage: {
        cypherComplexity: 'Single query with variable-depth traversal',
        sqlEquivalent: 'Would require recursive CTE with ' + maxDepth + ' levels of self-joins',
        performanceAdvantage: `${executionTime}ms execution time for ${impactResults.length} components across ${maxDepth} hops`
      }
    });

  } catch (error) {
    console.error('Error performing impact analysis:', error);
    res.status(500).json({ error: 'Failed to perform impact analysis' });
  }
});

// Get pre-configured demo scenarios that showcase graph advantages
router.get('/graph-advantage-examples', async (req, res) => {
  try {
    const demoScenarios = [
      {
        id: 'database-cascade-failure',
        title: 'Database Cascade Failure Analysis',
        description: 'Shows 6-hop impact from database server failure to customer revenue',
        componentId: 'srv-db-01',
        expectedHops: 6,
        expectedImpact: 'Critical - affects payment processing and customer transactions',
        revenueAtRisk: '$75,000/hour',
        graphAdvantage: 'Single graph query vs 50+ lines of recursive SQL with poor performance'
      },
      {
        id: 'network-infrastructure-outage',
        title: 'Network Infrastructure Outage',
        description: 'Core switch failure affecting entire application stack',
        componentId: 'sw-core-01',
        expectedHops: 5,
        expectedImpact: 'High - affects multiple microservices and business services',
        revenueAtRisk: '$40,000/hour',
        graphAdvantage: 'Complex network topology traversal impossible in traditional SQL'
      },
      {
        id: 'api-gateway-failure',
        title: 'API Gateway Failure Impact',
        description: 'Shows how API gateway failure affects all customer-facing services',
        componentId: 'gw-api-main',
        expectedHops: 4,
        expectedImpact: 'Critical - blocks all customer access to services',
        revenueAtRisk: '$90,000/hour',
        graphAdvantage: 'Bidirectional relationship traversal with business impact calculation'
      },
      {
        id: 'microservice-dependency-analysis',
        title: 'Microservice Dependency Web',
        description: 'Authentication service failure cascading through microservice mesh',
        componentId: 'ms-user-auth',
        expectedHops: 5,
        expectedImpact: 'Critical - authentication affects all user-facing functionality',
        revenueAtRisk: '$60,000/hour',
        graphAdvantage: 'Service mesh complexity analysis with weighted relationships'
      },
      {
        id: 'compliance-requirement-tracing',
        title: 'Compliance Requirement Impact',
        description: 'GDPR compliance component affecting multiple systems and regions',
        componentId: 'compliance-gdpr',
        expectedHops: 4,
        expectedImpact: 'High - affects EU operations and data processing',
        revenueAtRisk: '$25,000/hour',
        graphAdvantage: 'Cross-cutting concern analysis across multiple domains'
      },
      {
        id: 'external-service-dependency',
        title: 'External Service Dependency',
        description: 'Payment gateway failure upstream dependency analysis',
        componentId: 'ext-payment-stripe',
        expectedHops: 3,
        expectedImpact: 'Critical - payment processing unavailable',
        revenueAtRisk: '$100,000/hour',
        graphAdvantage: 'External dependency impact with SLA-aware analysis'
      }
    ];

    res.json({
      demoScenarios,
      totalScenarios: demoScenarios.length,
      instructions: 'Select any scenario to run impact analysis and see graph database advantages in action'
    });

  } catch (error) {
    console.error('Error getting demo scenarios:', error);
    res.status(500).json({ error: 'Failed to load demo scenarios' });
  }
});

// Get Cypher vs SQL query comparison for educational purposes
router.get('/query-comparison/:componentId', async (req, res) => {
  try {
    const { componentId } = req.params;
    const { maxDepth = 4 } = req.query;

    // The elegant Cypher query
    const cypherQuery = `
MATCH (source:ConfigurationItem {id: '${componentId}'})
MATCH path = (source)-[r:DEPENDS_ON|RUNS_ON|SUPPORTS*1..${maxDepth}]->(target)

WITH target, length(path) as hopDistance,
     [node in nodes(path) | node.name] as dependencyPath

OPTIONAL MATCH (target)-[:USES*0..2]->(service:Service)
OPTIONAL MATCH (customer)-[:USES]->(service)
WHERE customer.type = 'CustomerSegment'

RETURN target.name, hopDistance, dependencyPath,
       service.name as businessService,
       sum(customer.revenue_per_hour) as revenueAtRisk
ORDER BY hopDistance, revenueAtRisk DESC`;

    // The equivalent SQL would be extremely complex
    const sqlEquivalent = `
-- SQL equivalent would require complex recursive CTE with multiple self-joins
WITH RECURSIVE dependency_chain AS (
  -- Base case: direct dependencies
  SELECT source_ci_id, target_ci_id, relationship_type,
         1 as hop_level,
         ARRAY[source_ci_id] as path,
         source_ci_id as root_ci
  FROM ci_relationships
  WHERE source_ci_id = '${componentId}'

  UNION ALL

  -- Recursive case: indirect dependencies up to ${maxDepth} levels
  SELECT dc.root_ci, cr.target_ci_id, cr.relationship_type,
         dc.hop_level + 1,
         dc.path || cr.target_ci_id,
         dc.root_ci
  FROM dependency_chain dc
  JOIN ci_relationships cr ON dc.target_ci_id = cr.source_ci_id
  WHERE dc.hop_level < ${maxDepth}
    AND cr.target_ci_id <> ALL(dc.path)  -- Prevent cycles
    AND cr.relationship_type IN ('DEPENDS_ON', 'RUNS_ON', 'SUPPORTS')
),

-- Join with configuration items for details
enriched_dependencies AS (
  SELECT dc.*, ci.name as target_name, ci.type as target_type
  FROM dependency_chain dc
  JOIN configuration_items ci ON dc.target_ci_id = ci.id
),

-- Complex business service lookup
business_services AS (
  SELECT ed.target_ci_id, ed.target_name, ed.hop_level, ed.path,
         bs.name as service_name
  FROM enriched_dependencies ed
  LEFT JOIN service_ci_mappings scm ON ed.target_ci_id = scm.ci_id
  LEFT JOIN business_services bs ON scm.service_id = bs.id
),

-- Even more complex customer impact calculation
customer_impact AS (
  SELECT bs.*, cs.name as customer_name, cs.revenue_per_hour
  FROM business_services bs
  LEFT JOIN customer_service_mappings csm ON bs.service_name = csm.service_name
  LEFT JOIN customer_segments cs ON csm.customer_id = cs.id
)

SELECT target_name, hop_level, path,
       service_name as business_service,
       sum(revenue_per_hour) as revenue_at_risk
FROM customer_impact
GROUP BY target_name, hop_level, path, service_name
ORDER BY hop_level, revenue_at_risk DESC;

-- Note: This SQL assumes many additional junction tables and would be
-- extremely slow on large datasets. Many databases would timeout or
-- hit recursion limits before completing.`;

    const comparison = {
      cypher: {
        query: cypherQuery,
        linesOfCode: cypherQuery.split('\n').length,
        complexity: 'Low - Single query with native graph traversal',
        performance: 'Excellent - Optimized for relationship traversal',
        maintainability: 'High - Readable and intuitive',
        scalability: 'Excellent - Performance independent of relationship depth'
      },
      sql: {
        query: sqlEquivalent,
        linesOfCode: sqlEquivalent.split('\n').length,
        complexity: 'Very High - Multiple CTEs, self-joins, and junction tables',
        performance: 'Poor - Exponential complexity with depth',
        maintainability: 'Low - Complex logic, hard to modify',
        scalability: 'Poor - Performance degrades significantly with scale'
      },
      advantages: [
        {
          aspect: 'Query Complexity',
          cypher: '~15 lines of intuitive graph traversal',
          sql: '~40+ lines of complex recursive CTEs'
        },
        {
          aspect: 'Performance',
          cypher: 'Sub-second execution regardless of depth',
          sql: 'Exponential degradation, may timeout at depth > 3'
        },
        {
          aspect: 'Flexibility',
          cypher: 'Variable depth with single parameter change',
          sql: 'Requires query rewriting for different depths'
        },
        {
          aspect: 'Business Logic',
          cypher: 'Native support for weighted relationships',
          sql: 'Requires complex junction tables and calculations'
        },
        {
          aspect: 'Real-time Usage',
          cypher: 'Safe for production real-time analysis',
          sql: 'Would impact OLTP performance significantly'
        }
      ]
    };

    res.json(comparison);

  } catch (error) {
    console.error('Error generating query comparison:', error);
    res.status(500).json({ error: 'Failed to generate query comparison' });
  }
});

// Generate scenario-specific events for correlation demo
router.post('/scenario/:scenarioId/events', async (req, res) => {
  try {
    const { scenarioId } = req.params;
    const { eventCount = 5, timeSpanMinutes = 10 } = req.body;

    // Define scenario-specific event templates
    const scenarioEvents = {
      'database-cascade-failure': [
        { ciId: 'srv-db-01', severity: 'CRITICAL', message: 'Database server primary disk failure', eventType: 'INFRASTRUCTURE', source: 'storage.disk' },
        { ciId: 'db-ecommerce-prod', severity: 'CRITICAL', message: 'Database connection pool exhausted', eventType: 'DATABASE', source: 'database.connections' },
        { ciId: 'ms-payment-processor', severity: 'HIGH', message: 'Payment processing service timeout errors', eventType: 'APPLICATION', source: 'application.api' },
        { ciId: 'app-ecommerce', severity: 'HIGH', message: 'E-commerce application response time degraded', eventType: 'PERFORMANCE', source: 'application.performance' },
        { ciId: 'ms-inventory', severity: 'MEDIUM', message: 'Inventory service intermittent failures', eventType: 'APPLICATION', source: 'microservice.api' },
        { ciId: 'gw-api-main', severity: 'HIGH', message: 'API gateway elevated error rates', eventType: 'GATEWAY', source: 'gateway.errors' }
      ],
      'network-infrastructure-outage': [
        { ciId: 'sw-core-01', severity: 'CRITICAL', message: 'Core switch interface failure', eventType: 'NETWORK', source: 'network.interface' },
        { ciId: 'srv-app-01', severity: 'HIGH', message: 'Application server network connectivity lost', eventType: 'CONNECTIVITY', source: 'network.connectivity' },
        { ciId: 'srv-app-02', severity: 'HIGH', message: 'Application server network latency spike', eventType: 'PERFORMANCE', source: 'network.latency' },
        { ciId: 'ms-user-auth', severity: 'HIGH', message: 'Authentication service cluster communication failure', eventType: 'SERVICE', source: 'service.cluster' },
        { ciId: 'lb-prod-01', severity: 'MEDIUM', message: 'Load balancer health check failures', eventType: 'LOADBALANCER', source: 'loadbalancer.health' }
      ],
      'api-gateway-failure': [
        { ciId: 'gw-api-main', severity: 'CRITICAL', message: 'API gateway service crashed', eventType: 'SERVICE', source: 'gateway.process' },
        { ciId: 'app-ecommerce', severity: 'CRITICAL', message: 'E-commerce frontend unable to reach APIs', eventType: 'CONNECTIVITY', source: 'application.frontend' },
        { ciId: 'ms-user-auth', severity: 'HIGH', message: 'Authentication service request queue backup', eventType: 'PERFORMANCE', source: 'microservice.queue' },
        { ciId: 'ms-payment-processor', severity: 'HIGH', message: 'Payment service external gateway unreachable', eventType: 'EXTERNAL', source: 'external.connectivity' }
      ],
      'microservice-dependency-analysis': [
        { ciId: 'ms-user-auth', severity: 'CRITICAL', message: 'User authentication service database connection lost', eventType: 'DATABASE', source: 'service.database' },
        { ciId: 'ms-payment-processor', severity: 'HIGH', message: 'Payment processor authentication validation failures', eventType: 'AUTHENTICATION', source: 'service.auth' },
        { ciId: 'ms-inventory', severity: 'HIGH', message: 'Inventory service user permission check failures', eventType: 'AUTHORIZATION', source: 'service.authorization' },
        { ciId: 'app-ecommerce', severity: 'MEDIUM', message: 'E-commerce login functionality degraded', eventType: 'FUNCTIONALITY', source: 'application.login' },
        { ciId: 'ms-recommendation', severity: 'MEDIUM', message: 'Recommendation service user data access denied', eventType: 'DATA_ACCESS', source: 'service.data' }
      ],
      'compliance-requirement-tracing': [
        { ciId: 'compliance-gdpr', severity: 'HIGH', message: 'GDPR compliance audit finding detected', eventType: 'COMPLIANCE', source: 'compliance.audit' },
        { ciId: 'region-europe', severity: 'HIGH', message: 'European region data processing compliance violation', eventType: 'REGULATORY', source: 'region.compliance' },
        { ciId: 'db-crm-prod', severity: 'MEDIUM', message: 'CRM database unauthorized data access attempt', eventType: 'SECURITY', source: 'database.security' },
        { ciId: 'ms-user-auth', severity: 'MEDIUM', message: 'User authentication GDPR consent verification failures', eventType: 'CONSENT', source: 'service.consent' }
      ],
      'external-service-dependency': [
        { ciId: 'ext-payment-stripe', severity: 'CRITICAL', message: 'Stripe payment gateway service degradation', eventType: 'EXTERNAL', source: 'external.stripe' },
        { ciId: 'ms-payment-processor', severity: 'CRITICAL', message: 'Payment processor Stripe API failures', eventType: 'API', source: 'service.external_api' },
        { ciId: 'app-ecommerce', severity: 'HIGH', message: 'E-commerce checkout process failures', eventType: 'TRANSACTION', source: 'application.checkout' },
        { ciId: 'customer-enterprise', severity: 'HIGH', message: 'Enterprise customer payment processing blocked', eventType: 'BUSINESS', source: 'customer.impact' }
      ]
    };

    const eventTemplates = scenarioEvents[scenarioId];
    if (!eventTemplates) {
      return res.status(400).json({ error: 'Invalid scenario ID' });
    }

    const createdEvents = [];
    const baseTime = new Date();
    const timeSpanMs = timeSpanMinutes * 60 * 1000;

    // Create events with realistic timing distribution
    for (let i = 0; i < Math.min(eventCount, eventTemplates.length); i++) {
      const template = eventTemplates[i];

      // Distribute events over the time span with some clustering for realism
      const timeOffset = (i / eventCount) * timeSpanMs + (Math.random() - 0.5) * (timeSpanMs / 10);
      const eventTime = new Date(baseTime.getTime() - timeSpanMs + timeOffset).toISOString();

      const eventData = {
        id: uuidv4(),
        source: template.source,
        message: template.message,
        severity: template.severity,
        eventType: template.eventType,
        timestamp: eventTime,
        status: 'OPEN',
        metadata: JSON.stringify({
          scenario: scenarioId,
          simulatedAt: new Date().toISOString(),
          correlationTarget: true
        }),
        correlationScore: 0.0
      };

      // Create event and link to CI
      const cypher = `
        MATCH (ci:ConfigurationItem {id: $ciId})
        CREATE (e:Event $eventData)
        CREATE (e)-[:AFFECTS]->(ci)
        RETURN e, ci.name as ciName, ci.type as ciType
      `;

      const result = await runWriteQuery(cypher, {
        eventData,
        ciId: template.ciId
      });

      if (result.length > 0) {
        createdEvents.push({
          ...result[0].e.properties,
          affectedCI: {
            name: result[0].ciName,
            type: result[0].ciType
          }
        });
      }
    }

    res.json({
      scenario: scenarioId,
      eventsCreated: createdEvents.length,
      timeSpanMinutes,
      events: createdEvents,
      correlationReady: true,
      message: `Created ${createdEvents.length} scenario events for correlation analysis`
    });

  } catch (error) {
    console.error('Error creating scenario events:', error);
    res.status(500).json({ error: 'Failed to create scenario events' });
  }
});

// Generate cascade event simulation for sophisticated correlation demos
router.post('/simulate-cascade', async (req, res) => {
  try {
    const { rootComponentId, cascadeDepth = 3, timeDelayMinutes = 5 } = req.body;

    if (!rootComponentId) {
      return res.status(400).json({ error: 'Root component ID is required' });
    }

    // Find dependent components using graph traversal (both directions)
    const cypher = `
      MATCH (root:ConfigurationItem {id: $rootComponentId})
      MATCH path = (root)-[r:DEPENDS_ON|RUNS_ON|SUPPORTS|USES|HOSTED_IN|CONNECTS_TO|BALANCES_TO|REPLICATES_TO|MONITORS|INTEGRATES_WITH|ROUTES_TO|MANAGES|ORCHESTRATES*1..${cascadeDepth}]-(dependent)

      WHERE root.id <> dependent.id

      WITH root, dependent, path, length(path) as distance,
           [rel in relationships(path) | type(rel)] as relationshipChain

      WHERE distance <= $cascadeDepth

      RETURN root.id as rootId,
             root.name as rootName,
             dependent.id as dependentId,
             dependent.name as dependentName,
             dependent.type as dependentType,
             dependent.criticality as criticality,
             distance,
             relationshipChain

      ORDER BY distance, dependent.criticality DESC
      LIMIT 15
    `;

    const dependencies = await runReadQuery(cypher, {
      rootComponentId,
      cascadeDepth: parseInt(cascadeDepth)
    });

    if (dependencies.length === 0) {
      return res.status(404).json({ error: 'No dependencies found for the specified component' });
    }

    const cascadeEvents = [];
    const baseTime = new Date();
    const timeDelayMs = timeDelayMinutes * 60 * 1000;

    // Create root event
    const rootEvent = {
      id: uuidv4(),
      source: 'cascade.simulation',
      message: `Cascade failure initiated from ${dependencies[0].rootName}`,
      severity: 'CRITICAL',
      eventType: 'CASCADE_ROOT',
      timestamp: baseTime.toISOString(),
      status: 'OPEN',
      metadata: JSON.stringify({
        cascadeRoot: true,
        cascadeId: uuidv4(),
        simulatedAt: new Date().toISOString()
      }),
      correlationScore: 0.0
    };

    // Create root event
    await runWriteQuery(`
      MATCH (ci:ConfigurationItem {id: $ciId})
      CREATE (e:Event $eventData)
      CREATE (e)-[:AFFECTS]->(ci)
    `, { eventData: rootEvent, ciId: rootComponentId });

    cascadeEvents.push({
      ...rootEvent,
      affectedComponent: dependencies[0].rootName,
      distance: 0
    });

    // Create cascading events with realistic timing
    for (const dep of dependencies) {
      const cascadeDelay = dep.distance * timeDelayMs / 2; // Stagger events based on distance
      const jitter = (Math.random() - 0.5) * timeDelayMs / 4; // Add some randomness
      const eventTime = new Date(baseTime.getTime() + cascadeDelay + jitter);

      let severity = 'MEDIUM';
      let eventType = 'CASCADE_IMPACT';

      // Severity based on criticality and distance
      if (dep.criticality === 'CRITICAL' && dep.distance <= 2) {
        severity = 'HIGH';
      } else if (dep.criticality === 'CRITICAL' || dep.distance === 1) {
        severity = 'HIGH';
      } else if (dep.distance <= 2) {
        severity = 'MEDIUM';
      } else {
        severity = 'LOW';
      }

      const cascadeEventData = {
        id: uuidv4(),
        source: 'cascade.propagation',
        message: `Cascade impact: ${dep.dependentType} ${dep.dependentName} affected by upstream failure`,
        severity,
        eventType,
        timestamp: eventTime.toISOString(),
        status: 'OPEN',
        metadata: JSON.stringify({
          cascadeDistance: dep.distance,
          relationshipChain: dep.relationshipChain,
          rootCause: rootComponentId,
          simulatedAt: new Date().toISOString()
        }),
        correlationScore: 0.8 - (dep.distance * 0.1) // Higher correlation for closer components
      };

      await runWriteQuery(`
        MATCH (ci:ConfigurationItem {id: $ciId})
        CREATE (e:Event $eventData)
        CREATE (e)-[:AFFECTS]->(ci)
      `, { eventData: cascadeEventData, ciId: dep.dependentId });

      cascadeEvents.push({
        ...cascadeEventData,
        affectedComponent: dep.dependentName,
        componentType: dep.dependentType,
        distance: dep.distance,
        relationshipChain: dep.relationshipChain
      });
    }

    res.json({
      cascadeId: JSON.parse(rootEvent.metadata).cascadeId,
      rootComponent: dependencies[0].rootName,
      eventsCreated: cascadeEvents.length,
      timespan: `${timeDelayMinutes} minutes`,
      cascadeDepth,
      events: cascadeEvents,
      correlationReady: true,
      message: `Simulated cascade failure with ${cascadeEvents.length} events across ${cascadeDepth} hops`
    });

  } catch (error) {
    console.error('Error simulating cascade events:', error);
    res.status(500).json({ error: 'Failed to simulate cascade events' });
  }
});

module.exports = router;