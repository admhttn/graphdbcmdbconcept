const express = require('express');
const neo4j = require('neo4j-driver');
const { createSampleCMDB } = require('../models/sampleData');
const { runReadQuery } = require('../services/neo4j');

const router = express.Router();


// Load sample data
router.post('/sample-data', async (req, res) => {
  try {
    await createSampleCMDB();
    res.json({ message: 'Sample CMDB data loaded successfully' });
  } catch (error) {
    console.error('Error loading sample data:', error);
    res.status(500).json({ error: 'Failed to load sample data' });
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

module.exports = router;