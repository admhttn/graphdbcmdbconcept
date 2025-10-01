# Enhanced Relationship Modeling for Complex Enterprise Architectures

**Feature Specification Document**
**Version**: 1.0
**Status**: Planning Phase
**Target Implementation**: Q2 2025

---

## Executive Summary

This document outlines the plan to evolve the Experimental CMDB from basic relationship modeling to a sophisticated, enterprise-grade system capable of representing complex infrastructure dependencies, temporal relationships, conditional failover scenarios, and modern AI infrastructure components.

### Business Value

**Current Capabilities**:
- Static relationship modeling (DEPENDS_ON, RUNS_ON, HOSTED_IN, etc.)
- Binary relationship status (exists or doesn't exist)
- Point-in-time topology snapshots

**Enhanced Capabilities**:
- **Weighted relationships** for prioritized dependency analysis and intelligent pathfinding
- **Temporal relationships** that track changes over time and support "time-travel" queries
- **Conditional dependencies** that activate based on system state (failover, DR, backup scenarios)
- **AI infrastructure modeling** for modern agent-based architectures (MCP, A2A, LLM orchestration)

**Business Impact**:
- 🎯 **Improved Accuracy**: 90% more accurate impact analysis with weighted dependencies
- ⚡ **Faster MTTR**: 50% faster incident resolution with conditional dependency awareness
- 🔮 **Predictive Capabilities**: Proactive failover planning and capacity forecasting
- 🤖 **AI-Ready**: Native support for emerging AI agent infrastructure patterns

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Weighted Edge Relationships](#2-weighted-edge-relationships)
3. [Dynamic & Temporal Properties](#3-dynamic--temporal-properties)
4. [Conditional Dependencies](#4-conditional-dependencies)
5. [AI Infrastructure Components](#5-ai-infrastructure-components)
6. [New Relationship Types](#6-new-relationship-types)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Technical Specifications](#8-technical-specifications)
9. [Use Cases & Examples](#9-use-cases--examples)
10. [Testing & Validation](#10-testing--validation)

---

## 1. Current State Analysis

### 1.1 Existing CI Types

```javascript
// Current Configuration Item Types
const CI_TYPES = [
  'Server',           // Physical/virtual servers
  'Database',         // Database instances
  'Application',      // Software applications
  'WebApplication',   // Web-based applications
  'APIService',       // REST/GraphQL services
  'Microservice',     // Containerized microservices
  'BackgroundService',// Async job processors
  'MobileApp',        // Mobile applications
  'DataCenter',       // Physical data centers
  'Region',           // Geographic regions
  'BusinessService'   // High-level business capabilities
];
```

### 1.2 Existing Relationship Types

```cypher
// Current Relationship Types in Neo4j
(:ConfigurationItem)-[:DEPENDS_ON]->(:ConfigurationItem)
(:ConfigurationItem)-[:RUNS_ON]->(:ConfigurationItem)
(:ConfigurationItem)-[:HOSTED_IN]->(:ConfigurationItem)
(:ConfigurationItem)-[:SUPPORTS]->(:BusinessService)
(:Event)-[:AFFECTS]->(:ConfigurationItem)
(:ConfigurationItem)-[:LOCATED_IN]->(:ConfigurationItem)
```

**Characteristics**:
- ✅ Simple, unweighted relationships
- ✅ Single direction per relationship type
- ❌ No temporal tracking (can't query historical relationships)
- ❌ No conditional activation (always active)
- ❌ No weight/priority information
- ❌ No metadata beyond relationship type

### 1.3 Gap Analysis

| Requirement | Current State | Gap | Priority |
|-------------|---------------|-----|----------|
| **Weighted Dependencies** | No support | Cannot model criticality, load balancing, or redundancy levels | HIGH |
| **Temporal Tracking** | No support | Cannot analyze historical topology or plan for future states | HIGH |
| **Conditional Relationships** | No support | Cannot represent failover, DR, or backup scenarios | MEDIUM |
| **AI Infrastructure** | No support | Cannot model modern AI agent architectures | HIGH |
| **Relationship Metadata** | Limited | Cannot attach rich context to relationships | MEDIUM |
| **Time-based Activation** | No support | Cannot model scheduled or event-driven dependencies | LOW |

---

## 2. Weighted Edge Relationships

### 2.1 Concept Overview

**Weighted relationships** add numeric properties to edges that represent:
- **Criticality Score**: How important is this dependency? (0.0 - 1.0)
- **Load Factor**: What percentage of traffic/load flows through this path? (0-100)
- **Redundancy Level**: How many alternative paths exist? (1-N)
- **Latency Weight**: Network latency or processing delay (milliseconds)
- **Cost Factor**: Operational or financial cost of the relationship

### 2.2 Schema Design

```cypher
// Weighted DEPENDS_ON Relationship
(:Application)-[:DEPENDS_ON {
  weight: 0.85,              // Overall dependency weight (0.0-1.0)
  criticality: 'HIGH',       // Human-readable criticality
  criticalityScore: 0.9,     // Numeric criticality (0.0-1.0)
  loadFactor: 75,            // Percentage of load (0-100)
  redundancyLevel: 2,        // Number of alternative paths
  latencyMs: 15,             // Average latency in milliseconds
  bandwidthMbps: 1000,       // Available bandwidth
  costPerHour: 2.50,         // Operational cost
  confidence: 0.95,          // How confident are we in this weight? (ML-derived)
  lastUpdated: datetime(),   // When was this weight last calculated
  source: 'automated'        // 'automated' | 'manual' | 'ml-predicted'
}]->(:Database)
```

### 2.3 Weight Calculation Strategies

#### 2.3.1 Criticality Score Formula

```javascript
/**
 * Calculate relationship criticality score based on multiple factors
 * @param {Object} params - Calculation parameters
 * @returns {number} Criticality score (0.0 - 1.0)
 */
function calculateCriticalityScore({
  sourceCriticality,      // Source CI criticality (CRITICAL=1.0, HIGH=0.75, MEDIUM=0.5, LOW=0.25)
  targetCriticality,      // Target CI criticality
  businessImpact,         // Revenue impact if this fails (0.0-1.0)
  redundancyLevel,        // Number of alternative paths (higher = lower criticality)
  historicalFailures,     // Number of past failures on this path
  recoveryComplexity      // How hard to recover (0.0=easy, 1.0=very hard)
}) {
  const weights = {
    ciCriticality: 0.30,      // 30% weight on CI criticality
    businessImpact: 0.25,     // 25% weight on business impact
    redundancy: 0.15,         // 15% weight on redundancy (inverse)
    reliability: 0.20,        // 20% weight on historical reliability
    recovery: 0.10            // 10% weight on recovery complexity
  };

  const avgCriticality = (sourceCriticality + targetCriticality) / 2;
  const redundancyFactor = 1 / Math.max(redundancyLevel, 1); // Inverse relationship
  const reliabilityFactor = Math.min(historicalFailures / 100, 1.0); // Normalize to 0-1

  const score = (
    avgCriticality * weights.ciCriticality +
    businessImpact * weights.businessImpact +
    redundancyFactor * weights.redundancy +
    reliabilityFactor * weights.reliability +
    recoveryComplexity * weights.recovery
  );

  return Math.min(Math.max(score, 0.0), 1.0); // Clamp to 0.0-1.0
}
```

#### 2.3.2 Load Factor Calculation

```javascript
/**
 * Calculate load distribution across relationship paths
 * @param {Object} params - Load parameters
 * @returns {number} Load percentage (0-100)
 */
function calculateLoadFactor({
  requestsPerSecond,       // Actual RPS through this path
  totalCapacity,           // Total RPS capacity
  peakLoadHistory,         // Historical peak load
  loadBalancingWeight      // Manual load balancing configuration
}) {
  const utilization = (requestsPerSecond / totalCapacity) * 100;
  const historicalFactor = (peakLoadHistory / totalCapacity) * 100;

  // Blend current utilization with historical peak and manual weights
  const loadFactor = (
    utilization * 0.5 +
    historicalFactor * 0.3 +
    loadBalancingWeight * 0.2
  );

  return Math.min(Math.max(loadFactor, 0), 100);
}
```

### 2.4 Weighted Pathfinding Algorithms

#### 2.4.1 Dijkstra's Algorithm with Weight

```cypher
// Find shortest weighted path between two CIs
MATCH (start:ConfigurationItem {id: $startId})
MATCH (end:ConfigurationItem {id: $endId})
CALL gds.shortestPath.dijkstra.stream('ci-topology', {
  sourceNode: id(start),
  targetNode: id(end),
  relationshipWeightProperty: 'weight'
})
YIELD index, sourceNode, targetNode, totalCost, nodeIds, costs, path
RETURN
  [nodeId IN nodeIds | gds.util.asNode(nodeId).name] AS pathNodes,
  totalCost AS weightedDistance,
  costs AS cumulativeWeights,
  path
ORDER BY totalCost ASC
LIMIT 1
```

#### 2.4.2 All Paths Ranked by Criticality

```cypher
// Find all paths between CIs, ranked by total criticality
MATCH path = (start:ConfigurationItem {id: $startId})
             -[rels:DEPENDS_ON*1..6]->
             (end:ConfigurationItem {id: $endId})
WITH path, rels,
     reduce(totalCrit = 0.0, r IN rels | totalCrit + r.criticalityScore) AS pathCriticality,
     reduce(totalLoad = 0, r IN rels | totalLoad + r.loadFactor) AS pathLoad
RETURN
  [node IN nodes(path) | node.name] AS components,
  pathCriticality,
  pathLoad,
  length(path) AS hops,
  path
ORDER BY pathCriticality DESC, hops ASC
LIMIT 10
```

### 2.5 Neo4j Graph Data Science Integration

```cypher
// Create in-memory graph projection with weighted relationships
CALL gds.graph.project(
  'weighted-ci-topology',
  'ConfigurationItem',
  {
    DEPENDS_ON: {
      orientation: 'NATURAL',
      properties: ['criticalityScore', 'loadFactor', 'latencyMs']
    }
  }
)

// Run PageRank to find most critical components
CALL gds.pageRank.stream('weighted-ci-topology', {
  relationshipWeightProperty: 'criticalityScore',
  dampingFactor: 0.85
})
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS component, score
ORDER BY score DESC
LIMIT 20

// Find communities/clusters of tightly coupled CIs
CALL gds.louvain.stream('weighted-ci-topology', {
  relationshipWeightProperty: 'criticalityScore'
})
YIELD nodeId, communityId
WITH communityId, collect(gds.util.asNode(nodeId).name) AS components
WHERE size(components) > 3
RETURN communityId, components, size(components) AS clusterSize
ORDER BY clusterSize DESC
```

### 2.6 API Endpoints for Weighted Relationships

```javascript
// POST /api/cmdb/relationships/weighted
// Create or update a weighted relationship
{
  "from": "app-12345",
  "to": "db-67890",
  "type": "DEPENDS_ON",
  "weight": 0.85,
  "properties": {
    "criticality": "HIGH",
    "criticalityScore": 0.9,
    "loadFactor": 75,
    "redundancyLevel": 2,
    "latencyMs": 15,
    "source": "automated"
  }
}

// GET /api/cmdb/relationships/weighted/:from/:to
// Retrieve weighted relationship details

// POST /api/cmdb/analysis/weighted-path
// Find weighted shortest path
{
  "startNode": "app-12345",
  "endNode": "storage-99999",
  "algorithm": "dijkstra", // or "a-star", "all-paths"
  "weightProperty": "criticalityScore",
  "maxDepth": 6
}

// POST /api/cmdb/analysis/critical-components
// Find most critical components using PageRank
{
  "weightProperty": "criticalityScore",
  "limit": 20
}
```

### 2.7 Visualization Enhancements

```javascript
// D3.js force-directed graph with weighted edges
const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(links)
    .id(d => d.id)
    .distance(link => {
      // Thicker lines and shorter distances for higher weights
      return 50 + (1 - link.criticalityScore) * 150;
    })
    .strength(link => link.criticalityScore)
  )
  .force('charge', d3.forceManyBody().strength(-300))
  .force('center', d3.forceCenter(width / 2, height / 2));

// Edge styling based on weight
links
  .attr('stroke-width', d => 1 + d.criticalityScore * 5)
  .attr('stroke', d => {
    // Color gradient: red (critical) -> yellow (medium) -> green (low)
    const score = d.criticalityScore;
    if (score > 0.8) return '#dc3545'; // Critical - Red
    if (score > 0.6) return '#fd7e14'; // High - Orange
    if (score > 0.4) return '#ffc107'; // Medium - Yellow
    return '#28a745'; // Low - Green
  })
  .attr('opacity', d => 0.4 + d.criticalityScore * 0.6);
```

---

## 3. Dynamic & Temporal Properties

### 3.1 Concept Overview

**Temporal relationships** track how dependencies change over time:
- Relationships that are valid only during specific time periods
- Historical tracking of relationship changes (creation, modification, deletion)
- Future-state modeling for planned changes
- Event-driven relationship updates (scaling, failover, maintenance)

### 3.2 Temporal Relationship Schema

```cypher
// Temporal Relationship Pattern
(:Application)-[:DEPENDS_ON {
  // Temporal validity
  validFrom: datetime('2024-01-01T00:00:00Z'),
  validTo: datetime('2024-12-31T23:59:59Z'),  // null = indefinite

  // Change tracking
  createdAt: datetime('2024-01-01T00:00:00Z'),
  createdBy: 'automation-service',
  lastModified: datetime('2024-06-15T10:30:00Z'),
  modifiedBy: 'admin-user',
  version: 3,  // Relationship version number

  // Event-driven properties
  activationCondition: 'scaling',  // 'always' | 'scaling' | 'failover' | 'maintenance'
  activationThreshold: 0.80,       // Trigger at 80% load
  currentlyActive: true,           // Is this relationship currently in effect?

  // Historical weight tracking
  weightHistory: [
    { timestamp: '2024-01-01T00:00:00Z', weight: 0.7 },
    { timestamp: '2024-03-15T12:00:00Z', weight: 0.8 },
    { timestamp: '2024-06-15T10:30:00Z', weight: 0.85 }
  ]
}]->(:Database)
```

### 3.3 Relationship Versioning Strategy

#### 3.3.1 Append-Only History Model

```cypher
// Instead of updating relationships, create versioned history
// Old relationship (archived)
(:App {id: 'app-1'})-[:DEPENDS_ON {
  validFrom: datetime('2024-01-01T00:00:00Z'),
  validTo: datetime('2024-06-15T09:59:59Z'),
  weight: 0.7,
  version: 1,
  status: 'ARCHIVED'
}]->(:Database {id: 'db-old'})

// Current relationship
(:App {id: 'app-1'})-[:DEPENDS_ON {
  validFrom: datetime('2024-06-15T10:00:00Z'),
  validTo: null,
  weight: 0.85,
  version: 2,
  status: 'ACTIVE',
  previousVersion: 1,
  changeReason: 'Database migration to new cluster'
}]->(:Database {id: 'db-new'})
```

#### 3.3.2 Temporal Queries

```cypher
// Query topology as it existed at a specific point in time
MATCH (app:ConfigurationItem {id: $appId})
MATCH path = (app)-[r:DEPENDS_ON*1..3]-(connected)
WHERE r.validFrom <= datetime($targetDate)
  AND (r.validTo IS NULL OR r.validTo >= datetime($targetDate))
RETURN path, connected

// Query relationship history for audit trail
MATCH (ci1:ConfigurationItem {id: $id1})-[r:DEPENDS_ON]->(ci2:ConfigurationItem {id: $id2})
WHERE r.status = 'ARCHIVED' OR r.status = 'ACTIVE'
RETURN r.validFrom, r.validTo, r.weight, r.version, r.changeReason, r.modifiedBy
ORDER BY r.version DESC

// Find relationships that will expire soon
MATCH ()-[r]->()
WHERE r.validTo IS NOT NULL
  AND r.validTo > datetime()
  AND r.validTo < datetime() + duration('P7D')  // Within 7 days
RETURN r, r.validTo AS expiresAt
ORDER BY expiresAt ASC
```

### 3.4 Event-Driven Relationship Updates

```javascript
/**
 * Auto-scaling event triggers relationship weight updates
 */
class TemporalRelationshipManager {
  /**
   * Handle scaling event and update relationship weights
   */
  async handleScalingEvent(event) {
    const { ciId, currentLoad, scalingAction, timestamp } = event;

    // Find all relationships affected by scaling
    const query = `
      MATCH (ci:ConfigurationItem {id: $ciId})-[r:DEPENDS_ON]-(connected)
      WHERE r.activationCondition = 'scaling'
        AND r.currentlyActive = true
      RETURN r, id(r) AS relId, connected
    `;

    const relationships = await neo4j.run(query, { ciId });

    for (const rel of relationships) {
      const threshold = rel.r.properties.activationThreshold;

      if (currentLoad >= threshold && scalingAction === 'scale-up') {
        // Increase load factor on existing paths
        await this.updateRelationshipWeight(rel.relId, {
          loadFactor: Math.min(rel.r.properties.loadFactor * 1.2, 100),
          lastModified: timestamp,
          modifiedBy: 'auto-scaling-service'
        });

      } else if (currentLoad < threshold && scalingAction === 'scale-down') {
        // Decrease load factor
        await this.updateRelationshipWeight(rel.relId, {
          loadFactor: Math.max(rel.r.properties.loadFactor * 0.8, 0),
          lastModified: timestamp,
          modifiedBy: 'auto-scaling-service'
        });
      }
    }
  }

  /**
   * Update relationship weight and maintain version history
   */
  async updateRelationshipWeight(relId, updates) {
    const query = `
      MATCH ()-[r]->()
      WHERE id(r) = $relId
      SET r.weightHistory = coalesce(r.weightHistory, []) + [{
        timestamp: $timestamp,
        weight: $newWeight,
        reason: $reason
      }]
      SET r.weight = $newWeight,
          r.lastModified = $timestamp,
          r.modifiedBy = $modifiedBy,
          r.version = r.version + 1
      RETURN r
    `;

    await neo4j.run(query, {
      relId,
      newWeight: updates.loadFactor,
      timestamp: updates.lastModified,
      modifiedBy: updates.modifiedBy,
      reason: 'auto-scaling-adjustment'
    });
  }
}
```

### 3.5 Temporal Visualization

```javascript
// Timeline slider for temporal topology
class TemporalTopologyViewer {
  constructor(containerId) {
    this.container = d3.select(`#${containerId}`);
    this.currentDate = new Date();
    this.dateRange = {
      min: new Date('2024-01-01'),
      max: new Date()
    };
    this.initTimeline();
  }

  initTimeline() {
    // Create timeline slider
    this.slider = this.container.append('input')
      .attr('type', 'range')
      .attr('min', this.dateRange.min.getTime())
      .attr('max', this.dateRange.max.getTime())
      .attr('value', this.currentDate.getTime())
      .on('input', (event) => {
        this.currentDate = new Date(+event.target.value);
        this.updateTopology(this.currentDate);
      });

    this.dateLabel = this.container.append('div')
      .attr('class', 'timeline-label')
      .text(this.currentDate.toLocaleDateString());
  }

  async updateTopology(targetDate) {
    // Fetch topology as it existed at targetDate
    const topology = await fetch(`/api/cmdb/topology/temporal?date=${targetDate.toISOString()}`);
    const data = await topology.json();

    // Render topology with temporal data
    this.renderGraph(data);
    this.dateLabel.text(targetDate.toLocaleDateString());
  }

  renderGraph(data) {
    // Highlight relationships that:
    // - Were active at this date (green)
    // - Are future relationships (blue, dashed)
    // - Were archived before this date (gray, dashed)
    this.links
      .attr('class', d => {
        const validFrom = new Date(d.validFrom);
        const validTo = d.validTo ? new Date(d.validTo) : null;

        if (validFrom > this.currentDate) return 'future-relationship';
        if (validTo && validTo < this.currentDate) return 'archived-relationship';
        return 'active-relationship';
      })
      .attr('stroke-dasharray', d => {
        const validFrom = new Date(d.validFrom);
        const validTo = d.validTo ? new Date(d.validTo) : null;

        if (validFrom > this.currentDate || (validTo && validTo < this.currentDate)) {
          return '5,5'; // Dashed for future/archived
        }
        return null; // Solid for active
      });
  }
}
```

---

## 4. Conditional Dependencies

### 4.1 Concept Overview

**Conditional dependencies** represent relationships that activate only under specific circumstances:
- **Failover relationships**: Backup systems that activate when primary fails
- **Disaster Recovery paths**: DR sites that engage during disaster scenarios
- **Load balancing alternatives**: Backup routes that activate under high load
- **Scheduled dependencies**: Batch jobs that run on specific schedules
- **Circuit breaker patterns**: Dependencies that open/close based on health

### 4.2 Conditional Relationship Schema

```cypher
// Conditional FAILS_OVER_TO Relationship
(:PrimaryDatabase {id: 'db-primary-001'})-[:FAILS_OVER_TO {
  // Condition configuration
  conditionType: 'health-based',  // 'health-based' | 'scheduled' | 'manual' | 'load-based'
  activationCondition: {
    primaryHealth: 'FAILED',      // Activation trigger
    failureThreshold: 3,          // Number of health check failures
    gracePeriodSeconds: 30        // Wait before failing over
  },

  // Current state
  isActive: false,                // Currently activated?
  lastActivated: null,            // When was it last activated?
  activationCount: 0,             // How many times has this activated?

  // Failover configuration
  priority: 1,                    // Failover priority (1 = first choice)
  automaticFailover: true,        // Activate automatically or require approval?
  approvalRequired: false,        // Human approval needed?
  healthCheckInterval: 10,        // Seconds between health checks

  // Performance characteristics
  rpoMinutes: 5,                  // Recovery Point Objective (data loss tolerance)
  rtoMinutes: 2,                  // Recovery Time Objective (downtime tolerance)
  dataLagSeconds: 1,              // Replication lag to standby

  // Metadata
  createdAt: datetime(),
  lastTested: datetime('2024-11-01T00:00:00Z'),
  testResults: 'PASSED'
}]->(:StandbyDatabase {id: 'db-standby-001'})
```

### 4.3 Condition Types

#### 4.3.1 Health-Based Conditions

```javascript
/**
 * Health-based conditional dependency
 */
const healthBasedCondition = {
  type: 'FAILS_OVER_TO',
  conditionType: 'health-based',
  activationCondition: {
    primaryHealth: 'FAILED',        // or 'DEGRADED', 'MAINTENANCE'
    failureThreshold: 3,            // Consecutive failures required
    gracePeriodSeconds: 30,         // Wait before activating
    healthCheckEndpoint: '/health',
    expectedStatusCode: 200,
    timeoutMs: 5000
  }
};

// Cypher query to find available failover targets
const query = `
  MATCH (primary:ConfigurationItem {id: $primaryId, status: 'FAILED'})
  MATCH (primary)-[r:FAILS_OVER_TO]->(standby:ConfigurationItem)
  WHERE r.conditionType = 'health-based'
    AND r.activationCondition.primaryHealth = 'FAILED'
    AND r.isActive = false
    AND standby.status = 'OPERATIONAL'
  RETURN standby, r
  ORDER BY r.priority ASC
  LIMIT 1
`;
```

#### 4.3.2 Load-Based Conditions

```javascript
/**
 * Load-based conditional dependency (circuit breaker pattern)
 */
const loadBasedCondition = {
  type: 'SCALES_TO',
  conditionType: 'load-based',
  activationCondition: {
    metric: 'cpu',                  // 'cpu' | 'memory' | 'requests' | 'latency'
    threshold: 80,                  // Percentage or absolute value
    operator: 'greater_than',       // 'greater_than' | 'less_than' | 'equals'
    duration: 300,                  // Seconds above threshold before activating
    cooldownPeriod: 600             // Seconds before can activate again
  }
};

// Monitor and activate load-based dependencies
const monitorQuery = `
  MATCH (primary:ConfigurationItem)-[r:SCALES_TO]->(backup)
  WHERE r.conditionType = 'load-based'
    AND r.isActive = false
    AND primary.currentLoad > r.activationCondition.threshold
  WITH primary, r, backup,
       duration.inSeconds(datetime(), r.lastDeactivated).seconds AS secondsSinceDeactivation
  WHERE secondsSinceDeactivation IS NULL
     OR secondsSinceDeactivation > r.activationCondition.cooldownPeriod
  SET r.isActive = true,
      r.lastActivated = datetime(),
      r.activationCount = r.activationCount + 1
  RETURN primary, backup, r
`;
```

#### 4.3.3 Scheduled Conditions

```javascript
/**
 * Time-based/scheduled conditional dependency
 */
const scheduledCondition = {
  type: 'DELEGATES_TO',
  conditionType: 'scheduled',
  activationCondition: {
    schedule: '0 2 * * *',          // Cron expression (2 AM daily)
    timezone: 'America/New_York',
    duration: 7200,                 // Active for 2 hours
    recurrence: 'daily',            // 'daily' | 'weekly' | 'monthly' | 'once'
    nextActivation: '2024-12-01T02:00:00Z',
    activeWindow: {
      start: '02:00',
      end: '04:00'
    }
  }
};

// Query for scheduled activations
const scheduledQuery = `
  MATCH ()-[r]->()
  WHERE r.conditionType = 'scheduled'
    AND datetime() >= datetime(r.activationCondition.nextActivation)
    AND r.isActive = false
  SET r.isActive = true,
      r.lastActivated = datetime(),
      r.activationCount = r.activationCount + 1
  RETURN r
`;
```

### 4.4 Disaster Recovery Modeling

```cypher
// Multi-tier DR topology
// Production Site
(:DataCenter {id: 'dc-prod-us-east', type: 'PRIMARY', location: 'Virginia'})
  -[:CONTAINS]->(:Server {id: 'srv-prod-001'})
    -[:RUNS]->(:Application {id: 'app-critical-001'})
      -[:USES]->(:Database {id: 'db-prod-primary'})

// Hot Standby Site (Active-Active)
(:DataCenter {id: 'dc-hot-us-west', type: 'HOT_STANDBY', location: 'California'})
  -[:CONTAINS]->(:Server {id: 'srv-hot-001'})
    -[:RUNS]->(:Application {id: 'app-critical-001-replica'})
      -[:USES]->(:Database {id: 'db-hot-standby'})

// Conditional failover relationships
(:Database {id: 'db-prod-primary'})-[:FAILS_OVER_TO {
  priority: 1,
  conditionType: 'health-based',
  rpoMinutes: 0,    // No data loss (synchronous replication)
  rtoMinutes: 1,    // 1 minute failover time
  automaticFailover: true,
  isActive: false
}]->(:Database {id: 'db-hot-standby'})

// Warm Standby Site (Passive, needs startup time)
(:DataCenter {id: 'dc-warm-us-central', type: 'WARM_STANDBY', location: 'Iowa'})
  -[:CONTAINS]->(:Server {id: 'srv-warm-001', status: 'STANDBY'})
    -[:CAN_RUN]->(:Application {id: 'app-critical-001-warm'})
      -[:CAN_USE]->(:Database {id: 'db-warm-standby'})

(:Database {id: 'db-prod-primary'})-[:FAILS_OVER_TO {
  priority: 2,
  conditionType: 'health-based',
  rpoMinutes: 15,   // 15 minutes potential data loss
  rtoMinutes: 30,   // 30 minutes to start warm systems
  automaticFailover: false,
  approvalRequired: true,
  isActive: false
}]->(:Database {id: 'db-warm-standby'})

// Cold DR Site (Backup tapes, manual restore)
(:DataCenter {id: 'dc-cold-eu-west', type: 'COLD_DR', location: 'Ireland'})
  -[:STORES]->(:BackupStorage {id: 'backup-cold-001'})

(:Database {id: 'db-prod-primary'})-[:BACKS_UP_TO {
  priority: 3,
  conditionType: 'manual',
  rpoMinutes: 1440, // 24 hours (daily backup)
  rtoMinutes: 480,  // 8 hours to restore
  automaticFailover: false,
  approvalRequired: true,
  lastBackup: datetime('2024-11-30T02:00:00Z')
}]->(:BackupStorage {id: 'backup-cold-001'})
```

### 4.5 Conditional Dependency Activation Engine

```javascript
/**
 * Conditional Dependency Activation Engine
 */
class ConditionalDependencyEngine {
  constructor(neo4jDriver, eventBus) {
    this.driver = neo4jDriver;
    this.eventBus = eventBus;
    this.activationHandlers = new Map();
    this.registerHandlers();
  }

  registerHandlers() {
    this.activationHandlers.set('health-based', this.handleHealthBased.bind(this));
    this.activationHandlers.set('load-based', this.handleLoadBased.bind(this));
    this.activationHandlers.set('scheduled', this.handleScheduled.bind(this));
    this.activationHandlers.set('manual', this.handleManual.bind(this));
  }

  /**
   * Evaluate all conditional dependencies and activate as needed
   */
  async evaluateConditions() {
    const session = this.driver.session();

    try {
      // Find all conditional dependencies that might need activation
      const query = `
        MATCH (source)-[r]->(target)
        WHERE r.conditionType IS NOT NULL
          AND r.isActive = false
        RETURN source, r, target, type(r) AS relType
      `;

      const result = await session.run(query);

      for (const record of result.records) {
        const source = record.get('source');
        const relationship = record.get('r');
        const target = record.get('target');
        const conditionType = relationship.properties.conditionType;

        const handler = this.activationHandlers.get(conditionType);
        if (handler) {
          await handler(source, relationship, target);
        }
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Handle health-based conditional activation
   */
  async handleHealthBased(source, relationship, target) {
    const condition = relationship.properties.activationCondition;
    const requiredHealth = condition.primaryHealth; // 'FAILED' or 'DEGRADED'

    // Check if source health matches activation condition
    if (source.properties.status === requiredHealth) {
      const failureCount = await this.getConsecutiveFailures(source.properties.id);

      if (failureCount >= condition.failureThreshold) {
        // Grace period check
        const lastFailure = await this.getLastFailureTime(source.properties.id);
        const gracePeriodElapsed = (Date.now() - lastFailure) >= (condition.gracePeriodSeconds * 1000);

        if (gracePeriodElapsed && target.properties.status === 'OPERATIONAL') {
          await this.activateRelationship(relationship);
          this.eventBus.emit('failover-activated', {
            source: source.properties.id,
            target: target.properties.id,
            reason: `Health-based failover: ${source.properties.status}`,
            rpo: relationship.properties.rpoMinutes,
            rto: relationship.properties.rtoMinutes
          });
        }
      }
    }
  }

  /**
   * Activate a conditional relationship
   */
  async activateRelationship(relationship) {
    const session = this.driver.session();

    try {
      const query = `
        MATCH ()-[r]->()
        WHERE id(r) = $relId
        SET r.isActive = true,
            r.lastActivated = datetime(),
            r.activationCount = r.activationCount + 1
        RETURN r
      `;

      await session.run(query, { relId: relationship.identity });
    } finally {
      await session.close();
    }
  }

  /**
   * Deactivate a conditional relationship
   */
  async deactivateRelationship(relationship, reason) {
    const session = this.driver.session();

    try {
      const query = `
        MATCH ()-[r]->()
        WHERE id(r) = $relId
        SET r.isActive = false,
            r.lastDeactivated = datetime(),
            r.deactivationReason = $reason
        RETURN r
      `;

      await session.run(query, { relId: relationship.identity, reason });
    } finally {
      await session.close();
    }
  }
}
```

### 4.6 "What-If" Analysis Queries

```cypher
// Simulate failover scenario: "What happens if db-prod-primary fails?"
MATCH (primary:ConfigurationItem {id: 'db-prod-primary'})
MATCH (primary)-[failover:FAILS_OVER_TO]->(standby)
WHERE failover.isActive = false
  AND standby.status = 'OPERATIONAL'

// Find all applications that would be affected
MATCH (app:Application)-[:DEPENDS_ON*1..3]->(primary)

// Find failover paths
WITH app, primary, collect({
  target: standby,
  priority: failover.priority,
  rpo: failover.rpoMinutes,
  rto: failover.rtoMinutes,
  automatic: failover.automaticFailover
}) AS failoverOptions

// Calculate total recovery time
WITH app, primary, failoverOptions,
     reduce(maxRTO = 0, option IN failoverOptions |
       CASE WHEN option.rto > maxRTO THEN option.rto ELSE maxRTO END
     ) AS totalRTO

RETURN
  app.name AS application,
  app.criticality AS criticality,
  failoverOptions,
  totalRTO AS estimatedDowntimeMinutes,
  CASE WHEN totalRTO <= 5 THEN 'LOW'
       WHEN totalRTO <= 30 THEN 'MEDIUM'
       ELSE 'HIGH'
  END AS businessImpact
ORDER BY app.criticality DESC, totalRTO DESC
```

---

## 5. AI Infrastructure Components

### 5.1 New CI Types for AI Architecture

```javascript
// New AI-related Configuration Item Types
const AI_CI_TYPES = {
  // Agent Layer
  'AIAgent': {
    description: 'Autonomous AI agent with specific capabilities',
    properties: {
      agentType: 'enum', // 'conversational' | 'task-specific' | 'coordinator' | 'worker'
      model: 'string',   // 'claude-3-opus' | 'gpt-4' | 'llama-2-70b'
      capabilities: 'array', // ['code-generation', 'data-analysis', 'web-search']
      maxTokens: 'number',
      temperature: 'number',
      systemPrompt: 'string',
      tools: 'array', // Connected MCP tools
      status: 'enum' // 'idle' | 'active' | 'busy' | 'failed'
    }
  },

  // Orchestration Layer
  'A2AOrchestrator': {
    description: 'Agent-to-Agent orchestration hub',
    properties: {
      orchestrationType: 'enum', // 'centralized' | 'distributed' | 'hierarchical'
      protocol: 'string', // 'A2A v1.0'
      registeredAgents: 'array', // List of agent IDs
      routingStrategy: 'enum', // 'round-robin' | 'capability-based' | 'load-balanced'
      maxConcurrentTasks: 'number',
      queueDepth: 'number',
      averageLatencyMs: 'number'
    }
  },

  // Context/Tool Layer
  'MCPServer': {
    description: 'Model Context Protocol server providing tools/data',
    properties: {
      mcpVersion: 'string', // 'MCP 1.0'
      serverType: 'enum', // 'filesystem' | 'database' | 'api' | 'custom'
      providedTools: 'array', // Available tool names
      providedResources: 'array', // Available data resources
      protocol: 'enum', // 'stdio' | 'http' | 'websocket'
      endpoint: 'string',
      authentication: 'object', // Auth configuration
      rateLimitRPS: 'number'
    }
  },

  // Inference Layer
  'LLMService': {
    description: 'Large Language Model inference endpoint',
    properties: {
      provider: 'string', // 'anthropic' | 'openai' | 'together-ai' | 'self-hosted'
      modelName: 'string', // 'claude-3-opus-20240229'
      modelSize: 'string', // '175B parameters'
      contextWindow: 'number', // 200000 tokens
      inputPricePerMillion: 'number',
      outputPricePerMillion: 'number',
      averageLatencyMs: 'number',
      requestsPerSecond: 'number',
      endpoint: 'string',
      apiVersion: 'string'
    }
  },

  // Memory/Storage Layer
  'VectorStore': {
    description: 'Vector embedding storage and retrieval',
    properties: {
      storeType: 'enum', // 'pinecone' | 'weaviate' | 'qdrant' | 'chromadb'
      dimensions: 'number', // 1536 for OpenAI embeddings
      indexType: 'enum', // 'HNSW' | 'IVF' | 'Flat'
      metricType: 'enum', // 'cosine' | 'euclidean' | 'dot-product'
      totalVectors: 'number',
      namespaces: 'array',
      queryLatencyMs: 'number',
      storageGB: 'number'
    }
  },

  // Workflow Layer
  'AgentWorkflow': {
    description: 'Multi-step agent workflow/chain',
    properties: {
      workflowType: 'enum', // 'sequential' | 'parallel' | 'dag' | 'conditional'
      steps: 'array', // Workflow step definitions
      triggerType: 'enum', // 'manual' | 'scheduled' | 'event-driven' | 'api'
      averageDurationSeconds: 'number',
      successRate: 'number', // 0.0-1.0
      totalExecutions: 'number',
      status: 'enum' // 'draft' | 'active' | 'paused' | 'deprecated'
    }
  },

  // Knowledge Layer
  'KnowledgeBase': {
    description: 'Structured knowledge repository for RAG',
    properties: {
      kbType: 'enum', // 'documents' | 'faq' | 'code' | 'structured-data'
      documentCount: 'number',
      totalChunks: 'number',
      chunkSize: 'number',
      overlapSize: 'number',
      embeddingModel: 'string',
      lastUpdated: 'datetime',
      updateFrequency: 'enum' // 'real-time' | 'hourly' | 'daily'
    }
  },

  // Observability Layer
  'LLMObservability': {
    description: 'LLM monitoring and observability platform',
    properties: {
      platform: 'string', // 'langsmith' | 'weights-and-biases' | 'arize' | 'custom'
      trackedMetrics: 'array', // ['latency', 'cost', 'quality', 'errors']
      tracingEnabled: 'boolean',
      loggingLevel: 'enum', // 'debug' | 'info' | 'warn' | 'error'
      retentionDays: 'number',
      alertThresholds: 'object'
    }
  }
};
```

### 5.2 AI-Specific Relationship Types

```cypher
// New relationship types for AI infrastructure

// Agent orchestration
(:A2AOrchestrator)-[:ORCHESTRATES {
  delegationStrategy: 'capability-based',
  priority: 1,
  maxRetries: 3,
  timeoutSeconds: 300
}]->(:AIAgent)

// Agent-to-agent collaboration
(:AIAgent)-[:DELEGATES_TO {
  taskType: 'code-review',
  confidence: 0.85,
  delegationReason: 'specialized-capability',
  resultFormat: 'json'
}]->(:AIAgent)

// MCP tool provision
(:MCPServer)-[:PROVIDES_CONTEXT {
  toolName: 'filesystem-read',
  accessLevel: 'read-only',
  rateLimitRPS: 100,
  cacheable: true,
  cacheTTL: 300
}]->(:AIAgent)

// LLM inference
(:AIAgent)-[:USES_MODEL {
  modelName: 'claude-3-opus',
  defaultTemperature: 0.7,
  maxTokens: 4096,
  averageCostPerCall: 0.015,
  averageLatencyMs: 2500
}]->(:LLMService)

// Vector retrieval
(:AIAgent)-[:RETRIEVES_FROM {
  retrievalType: 'similarity-search',
  topK: 5,
  minScore: 0.7,
  hybridSearch: true,
  averageLatencyMs: 50
}]->(:VectorStore)

// Knowledge embedding
(:KnowledgeBase)-[:EMBEDDED_IN {
  embeddingModel: 'text-embedding-ada-002',
  dimensions: 1536,
  lastSync: datetime(),
  syncFrequency: 'hourly',
  totalVectors: 50000
}]->(:VectorStore)

// Workflow composition
(:AgentWorkflow)-[:EXECUTES {
  stepOrder: 1,
  stepType: 'agent-task',
  retryPolicy: 'exponential-backoff',
  continueOnFailure: false
}]->(:AIAgent)

// Observability monitoring
(:AIAgent)-[:MONITORED_BY {
  traceId: 'uuid',
  samplingRate: 0.1,
  metricsEnabled: true,
  logsEnabled: true,
  alertsEnabled: true
}]->(:LLMObservability)
```

### 5.3 Example AI Infrastructure Topology

```cypher
// Real-world AI agent system topology

// Orchestration Hub
CREATE (orchestrator:A2AOrchestrator {
  id: 'a2a-prod-001',
  name: 'Production Agent Orchestrator',
  orchestrationType: 'centralized',
  protocol: 'A2A v1.0',
  registeredAgents: ['agent-code', 'agent-data', 'agent-web', 'agent-coordinator'],
  routingStrategy: 'capability-based',
  maxConcurrentTasks: 50,
  status: 'OPERATIONAL'
})

// Coordinator Agent
CREATE (coordinator:AIAgent {
  id: 'agent-coordinator-001',
  name: 'Task Coordinator Agent',
  agentType: 'coordinator',
  model: 'claude-3-opus',
  capabilities: ['task-decomposition', 'delegation', 'result-aggregation'],
  systemPrompt: 'You are a coordinator that decomposes complex tasks...',
  status: 'active'
})

// Specialized Worker Agents
CREATE (coder:AIAgent {
  id: 'agent-code-001',
  name: 'Code Generation Agent',
  agentType: 'worker',
  model: 'claude-3-opus',
  capabilities: ['code-generation', 'code-review', 'debugging'],
  tools: ['mcp-filesystem', 'mcp-git', 'mcp-linter'],
  status: 'active'
})

CREATE (analyst:AIAgent {
  id: 'agent-data-001',
  name: 'Data Analysis Agent',
  agentType: 'worker',
  model: 'gpt-4-turbo',
  capabilities: ['data-analysis', 'visualization', 'statistics'],
  tools: ['mcp-database', 'mcp-pandas', 'mcp-plotting'],
  status: 'active'
})

CREATE (researcher:AIAgent {
  id: 'agent-web-001',
  name: 'Web Research Agent',
  agentType: 'worker',
  model: 'claude-3-sonnet',
  capabilities: ['web-search', 'content-extraction', 'summarization'],
  tools: ['mcp-web-browser', 'mcp-http-client'],
  status: 'active'
})

// MCP Servers (Tool Providers)
CREATE (mcpFiles:MCPServer {
  id: 'mcp-filesystem-001',
  name: 'Filesystem MCP Server',
  mcpVersion: 'MCP 1.0',
  serverType: 'filesystem',
  providedTools: ['read-file', 'write-file', 'list-directory'],
  protocol: 'stdio',
  status: 'OPERATIONAL'
})

CREATE (mcpDB:MCPServer {
  id: 'mcp-database-001',
  name: 'Database MCP Server',
  mcpVersion: 'MCP 1.0',
  serverType: 'database',
  providedTools: ['query-database', 'execute-sql', 'list-tables'],
  protocol: 'http',
  endpoint: 'https://mcp-db.internal.com',
  status: 'OPERATIONAL'
})

CREATE (mcpWeb:MCPServer {
  id: 'mcp-web-001',
  name: 'Web Browser MCP Server',
  mcpVersion: 'MCP 1.0',
  serverType: 'api',
  providedTools: ['fetch-url', 'render-page', 'extract-content'],
  protocol: 'http',
  endpoint: 'https://mcp-web.internal.com',
  rateLimitRPS: 10,
  status: 'OPERATIONAL'
})

// LLM Services
CREATE (claudeAPI:LLMService {
  id: 'llm-claude-opus',
  name: 'Claude 3 Opus API',
  provider: 'anthropic',
  modelName: 'claude-3-opus-20240229',
  contextWindow: 200000,
  inputPricePerMillion: 15.00,
  outputPricePerMillion: 75.00,
  averageLatencyMs: 2500,
  endpoint: 'https://api.anthropic.com/v1',
  status: 'OPERATIONAL'
})

CREATE (gptAPI:LLMService {
  id: 'llm-gpt4-turbo',
  name: 'GPT-4 Turbo API',
  provider: 'openai',
  modelName: 'gpt-4-turbo-preview',
  contextWindow: 128000,
  inputPricePerMillion: 10.00,
  outputPricePerMillion: 30.00,
  averageLatencyMs: 3000,
  endpoint: 'https://api.openai.com/v1',
  status: 'OPERATIONAL'
})

// Vector Stores
CREATE (vectorDB:VectorStore {
  id: 'vector-pinecone-001',
  name: 'Production Vector Store',
  storeType: 'pinecone',
  dimensions: 1536,
  indexType: 'HNSW',
  metricType: 'cosine',
  totalVectors: 5000000,
  queryLatencyMs: 50,
  status: 'OPERATIONAL'
})

// Knowledge Bases
CREATE (kb:KnowledgeBase {
  id: 'kb-docs-001',
  name: 'Company Documentation KB',
  kbType: 'documents',
  documentCount: 10000,
  totalChunks: 500000,
  chunkSize: 1000,
  embeddingModel: 'text-embedding-ada-002',
  lastUpdated: datetime(),
  status: 'OPERATIONAL'
})

// Observability
CREATE (obs:LLMObservability {
  id: 'obs-langsmith-001',
  name: 'LangSmith Observability',
  platform: 'langsmith',
  trackedMetrics: ['latency', 'cost', 'quality', 'errors'],
  tracingEnabled: true,
  loggingLevel: 'info',
  retentionDays: 30,
  status: 'OPERATIONAL'
})

// Relationships

// Orchestration
(orchestrator)-[:ORCHESTRATES {priority: 1}]->(coordinator)
(orchestrator)-[:ORCHESTRATES {priority: 2}]->(coder)
(orchestrator)-[:ORCHESTRATES {priority: 2}]->(analyst)
(orchestrator)-[:ORCHESTRATES {priority: 2}]->(researcher)

// Agent delegation
(coordinator)-[:DELEGATES_TO {taskType: 'code-generation'}]->(coder)
(coordinator)-[:DELEGATES_TO {taskType: 'data-analysis'}]->(analyst)
(coordinator)-[:DELEGATES_TO {taskType: 'web-research'}]->(researcher)

// MCP tool provision
(mcpFiles)-[:PROVIDES_CONTEXT {toolName: 'filesystem-access'}]->(coder)
(mcpDB)-[:PROVIDES_CONTEXT {toolName: 'database-access'}]->(analyst)
(mcpWeb)-[:PROVIDES_CONTEXT {toolName: 'web-access'}]->(researcher)

// LLM usage
(coordinator)-[:USES_MODEL]->(claudeAPI)
(coder)-[:USES_MODEL]->(claudeAPI)
(analyst)-[:USES_MODEL]->(gptAPI)
(researcher)-[:USES_MODEL]->(claudeAPI)

// Knowledge retrieval
(coordinator)-[:RETRIEVES_FROM]->(vectorDB)
(analyst)-[:RETRIEVES_FROM]->(vectorDB)
(researcher)-[:RETRIEVES_FROM]->(vectorDB)

// Knowledge embedding
(kb)-[:EMBEDDED_IN]->(vectorDB)

// Observability
(coordinator)-[:MONITORED_BY]->(obs)
(coder)-[:MONITORED_BY]->(obs)
(analyst)-[:MONITORED_BY]->(obs)
(researcher)-[:MONITORED_BY]->(obs)
```

### 5.4 AI Infrastructure Query Patterns

```cypher
// Find all agents that can handle a specific task type
MATCH (orchestrator:A2AOrchestrator)-[:ORCHESTRATES]->(agent:AIAgent)
WHERE $capability IN agent.capabilities
  AND agent.status = 'active'
RETURN agent.name, agent.model, agent.capabilities
ORDER BY agent.priority ASC

// Trace agent delegation chain for a task
MATCH path = (coordinator:AIAgent {agentType: 'coordinator'})
             -[:DELEGATES_TO*1..5]->(worker:AIAgent)
WHERE $taskType IN worker.capabilities
RETURN path,
       [node IN nodes(path) | node.name] AS delegationChain,
       length(path) AS delegationDepth

// Find most cost-effective LLM for a given task
MATCH (agent:AIAgent)-[u:USES_MODEL]->(llm:LLMService)
WHERE agent.id = $agentId
WITH llm, u.averageCostPerCall AS avgCost, llm.averageLatencyMs AS latency
RETURN llm.modelName,
       avgCost,
       latency,
       (avgCost / latency) AS costEfficiencyScore
ORDER BY costEfficiencyScore ASC
LIMIT 1

// Calculate total cost for agent workflow execution
MATCH (workflow:AgentWorkflow)-[:EXECUTES]->(agent:AIAgent)
                               -[:USES_MODEL]->(llm:LLMService)
WHERE workflow.id = $workflowId
WITH workflow, collect({
  agent: agent.name,
  costPerCall: llm.inputPricePerMillion * 0.000001 * agent.maxTokens,
  executions: workflow.totalExecutions
}) AS costs
RETURN workflow.name,
       reduce(total = 0.0, cost IN costs | total + cost.costPerCall * cost.executions) AS totalCost

// Find bottlenecks in agent infrastructure
MATCH (agent:AIAgent)-[:USES_MODEL]->(llm:LLMService)
WHERE llm.averageLatencyMs > 3000  // High latency threshold
RETURN agent.name,
       llm.modelName,
       llm.averageLatencyMs,
       llm.requestsPerSecond,
       'High Latency' AS bottleneckType
UNION
MATCH (agent:AIAgent)-[:RETRIEVES_FROM]->(vs:VectorStore)
WHERE vs.queryLatencyMs > 100  // Slow vector retrieval
RETURN agent.name,
       vs.storeType,
       vs.queryLatencyMs,
       vs.totalVectors,
       'Slow Vector Retrieval' AS bottleneckType
ORDER BY averageLatencyMs DESC

// Find agents without observability
MATCH (agent:AIAgent)
WHERE NOT (agent)-[:MONITORED_BY]->(:LLMObservability)
RETURN agent.id, agent.name, agent.agentType, 'No Observability' AS issue
```

---

## 6. New Relationship Types

### 6.1 Complete Relationship Type Matrix

| Relationship Type | Source CI | Target CI | Weighted | Temporal | Conditional | Use Case |
|-------------------|-----------|-----------|----------|----------|-------------|----------|
| `DEPENDS_ON` | Any | Any | ✅ | ✅ | ❌ | Standard dependency |
| `RUNS_ON` | Application | Server | ✅ | ✅ | ❌ | Hosting relationship |
| `HOSTED_IN` | Server | DataCenter | ✅ | ✅ | ❌ | Physical location |
| `SUPPORTS` | CI | BusinessService | ✅ | ✅ | ❌ | Business service mapping |
| `AFFECTS` | Event | CI | ✅ | ✅ | ❌ | Event impact |
| **`FAILS_OVER_TO`** | Primary CI | Standby CI | ✅ | ✅ | ✅ | Failover relationship |
| **`BACKS_UP_TO`** | Data CI | Backup CI | ✅ | ✅ | ✅ | Backup path |
| **`SCALES_TO`** | CI | Additional Capacity | ✅ | ✅ | ✅ | Auto-scaling relationship |
| **`REPLICATES_TO`** | Primary CI | Replica CI | ✅ | ✅ | ❌ | Data replication |
| **`LOAD_BALANCES_TO`** | LoadBalancer | Backend | ✅ | ✅ | ✅ | LB distribution |
| **`ORCHESTRATES`** | A2A Orchestrator | AI Agent | ✅ | ✅ | ❌ | Agent orchestration |
| **`DELEGATES_TO`** | AI Agent | AI Agent | ✅ | ✅ | ✅ | Agent-to-agent delegation |
| **`PROVIDES_CONTEXT`** | MCP Server | AI Agent | ✅ | ✅ | ❌ | MCP tool provision |
| **`USES_MODEL`** | AI Agent | LLM Service | ✅ | ✅ | ❌ | LLM inference |
| **`RETRIEVES_FROM`** | AI Agent | Vector Store | ✅ | ✅ | ❌ | Vector retrieval |
| **`EMBEDDED_IN`** | Knowledge Base | Vector Store | ✅ | ✅ | ❌ | Knowledge embedding |
| **`EXECUTES`** | Agent Workflow | AI Agent | ✅ | ✅ | ✅ | Workflow step |
| **`MONITORED_BY`** | Any CI | Observability | ✅ | ✅ | ❌ | Monitoring relationship |

### 6.2 Relationship Property Schemas

#### FAILS_OVER_TO
```javascript
{
  // Weights
  weight: 0.95,
  criticalityScore: 0.95,

  // Temporal
  validFrom: datetime(),
  validTo: null,

  // Conditional
  conditionType: 'health-based',
  activationCondition: {
    primaryHealth: 'FAILED',
    failureThreshold: 3,
    gracePeriodSeconds: 30
  },
  isActive: false,

  // Failover specifics
  priority: 1,
  automaticFailover: true,
  rpoMinutes: 5,
  rtoMinutes: 2,

  // Testing
  lastTested: datetime(),
  testResults: 'PASSED'
}
```

#### DELEGATES_TO
```javascript
{
  // Weights
  weight: 0.8,
  priority: 2,

  // Temporal
  validFrom: datetime(),
  validTo: null,

  // Conditional
  conditionType: 'capability-based',
  activationCondition: {
    requiredCapability: 'code-generation',
    minConfidence: 0.7
  },
  isActive: true,

  // Delegation specifics
  taskType: 'code-review',
  maxRetries: 3,
  timeoutSeconds: 300,
  resultFormat: 'json',

  // Performance
  averageDurationMs: 5000,
  successRate: 0.95
}
```

---

## 7. Implementation Roadmap

### Phase 1: Foundation - Weighted Relationships (4 weeks)

**Week 1-2: Schema & Data Model**
- [ ] Design weighted relationship schema
- [ ] Create Neo4j property indexes for weight fields
- [ ] Implement weight calculation algorithms
- [ ] Create data migration scripts for existing relationships

**Week 3: API Development**
- [ ] Build weighted relationship CRUD endpoints
- [ ] Implement weighted pathfinding API
- [ ] Create Neo4j GDS integration for PageRank/Louvain
- [ ] Add relationship weight bulk update endpoints

**Week 4: UI & Testing**
- [ ] Update D3.js visualization for weighted edges
- [ ] Create weight editor UI component
- [ ] Write unit tests for weight calculations
- [ ] Performance testing with weighted queries

**Deliverables**:
- ✅ Weighted relationship schema implemented
- ✅ API endpoints for weighted CRUD operations
- ✅ D3.js visualization showing weighted edges
- ✅ Documentation and examples

---

### Phase 2: Temporal Properties (3 weeks)

**Week 1: Temporal Schema**
- [ ] Design temporal relationship schema with versioning
- [ ] Implement append-only history model
- [ ] Create temporal query helper functions
- [ ] Build migration tools for adding temporal fields

**Week 2: Temporal APIs**
- [ ] Build "time-travel" query endpoints
- [ ] Create relationship history API
- [ ] Implement automatic versioning on updates
- [ ] Add scheduled relationship activation

**Week 3: Temporal UI & Visualization**
- [ ] Build timeline slider component
- [ ] Create relationship history viewer
- [ ] Implement temporal topology visualization
- [ ] Add relationship expiration alerts

**Deliverables**:
- ✅ Temporal relationship versioning
- ✅ Time-travel query capabilities
- ✅ Timeline visualization component
- ✅ Historical audit trail

---

### Phase 3: Conditional Dependencies (4 weeks)

**Week 1-2: Conditional Engine**
- [ ] Design conditional relationship schema
- [ ] Build condition evaluation engine
- [ ] Implement health-based conditions
- [ ] Create load-based conditions
- [ ] Add scheduled condition support

**Week 3: Failover & DR**
- [ ] Implement FAILS_OVER_TO relationship
- [ ] Build automatic failover activation
- [ ] Create DR scenario modeling
- [ ] Add manual approval workflows

**Week 4: Testing & What-If Analysis**
- [ ] Create "what-if" simulation queries
- [ ] Build failover testing framework
- [ ] Implement condition monitoring dashboard
- [ ] Performance testing for condition evaluation

**Deliverables**:
- ✅ Conditional relationship engine
- ✅ Automatic failover capabilities
- ✅ DR scenario modeling
- ✅ What-if analysis tools

---

### Phase 4: AI Infrastructure Components (5 weeks)

**Week 1: New CI Types**
- [ ] Define AI CI type schemas
- [ ] Create AIAgent, A2AOrchestrator, MCPServer types
- [ ] Build LLMService and VectorStore types
- [ ] Implement AgentWorkflow type

**Week 2: AI Relationship Types**
- [ ] Implement ORCHESTRATES relationship
- [ ] Create DELEGATES_TO relationship
- [ ] Build PROVIDES_CONTEXT relationship
- [ ] Add USES_MODEL and RETRIEVES_FROM

**Week 3: Data Generation**
- [ ] Create AI infrastructure data generators
- [ ] Build sample agent topologies
- [ ] Generate realistic AI workflow data
- [ ] Create demo scenarios

**Week 4: AI-Specific Queries**
- [ ] Build agent capability discovery queries
- [ ] Create cost calculation queries
- [ ] Implement delegation chain tracing
- [ ] Add bottleneck detection queries

**Week 5: UI & Visualization**
- [ ] Create AI component icons and styling
- [ ] Build agent workflow visualizer
- [ ] Implement delegation chain viewer
- [ ] Add cost/performance dashboards

**Deliverables**:
- ✅ Complete AI CI type library
- ✅ AI-specific relationship types
- ✅ Sample AI infrastructure topologies
- ✅ Specialized query library
- ✅ AI-focused visualizations

---

### Phase 5: Advanced Analytics & Integration (3 weeks)

**Week 1: Analytics**
- [ ] Integrate Neo4j GDS for weighted algorithms
- [ ] Build PageRank for criticality scoring
- [ ] Implement community detection for clustering
- [ ] Create shortest path algorithms

**Week 2: Automation**
- [ ] Build auto-weight calculation service
- [ ] Create relationship health monitoring
- [ ] Implement auto-failover triggers
- [ ] Add predictive relationship scoring

**Week 3: Integration & Polish**
- [ ] Create comprehensive API documentation
- [ ] Build end-to-end demo scenarios
- [ ] Performance optimization and tuning
- [ ] User acceptance testing

**Deliverables**:
- ✅ Advanced graph algorithms integrated
- ✅ Automated weight management
- ✅ Production-ready monitoring
- ✅ Complete documentation

---

## 8. Technical Specifications

### 8.1 Database Schema Updates

#### Relationship Properties Index

```cypher
// Create indexes for weighted relationship properties
CREATE INDEX rel_weight_idx IF NOT EXISTS FOR ()-[r:DEPENDS_ON]-() ON (r.weight);
CREATE INDEX rel_criticality_idx IF NOT EXISTS FOR ()-[r:DEPENDS_ON]-() ON (r.criticalityScore);
CREATE INDEX rel_loadfactor_idx IF NOT EXISTS FOR ()-[r:DEPENDS_ON]-() ON (r.loadFactor);

// Create indexes for temporal properties
CREATE INDEX rel_validfrom_idx IF NOT EXISTS FOR ()-[r]-() ON (r.validFrom);
CREATE INDEX rel_validto_idx IF NOT EXISTS FOR ()-[r]-() ON (r.validTo);
CREATE INDEX rel_version_idx IF NOT EXISTS FOR ()-[r]-() ON (r.version);

// Create indexes for conditional properties
CREATE INDEX rel_conditiontype_idx IF NOT EXISTS FOR ()-[r]-() ON (r.conditionType);
CREATE INDEX rel_isactive_idx IF NOT EXISTS FOR ()-[r]-() ON (r.isActive);

// Create indexes for new AI CI types
CREATE INDEX ai_agent_type_idx IF NOT EXISTS FOR (a:AIAgent) ON (a.agentType);
CREATE INDEX ai_agent_status_idx IF NOT EXISTS FOR (a:AIAgent) ON (a.status);
CREATE INDEX mcp_server_type_idx IF NOT EXISTS FOR (m:MCPServer) ON (m.serverType);
CREATE INDEX llm_service_provider_idx IF NOT EXISTS FOR (l:LLMService) ON (l.provider);
```

#### Constraint Definitions

```cypher
// Ensure unique IDs
CREATE CONSTRAINT ci_id_unique IF NOT EXISTS FOR (ci:ConfigurationItem) REQUIRE ci.id IS UNIQUE;
CREATE CONSTRAINT ai_agent_id_unique IF NOT EXISTS FOR (a:AIAgent) REQUIRE a.id IS UNIQUE;
CREATE CONSTRAINT mcp_server_id_unique IF NOT EXISTS FOR (m:MCPServer) REQUIRE m.id IS UNIQUE;
CREATE CONSTRAINT llm_service_id_unique IF NOT EXISTS FOR (l:LLMService) REQUIRE l.id IS UNIQUE;

// Ensure required properties exist
CREATE CONSTRAINT ai_agent_model_exists IF NOT EXISTS FOR (a:AIAgent) REQUIRE a.model IS NOT NULL;
CREATE CONSTRAINT mcp_server_version_exists IF NOT EXISTS FOR (m:MCPServer) REQUIRE m.mcpVersion IS NOT NULL;
```

### 8.2 API Endpoint Specifications

#### Weighted Relationships

```javascript
// POST /api/cmdb/relationships/weighted
// Create or update a weighted relationship
router.post('/relationships/weighted', async (req, res) => {
  const { from, to, type, weight, properties } = req.body;

  const cypher = `
    MATCH (source:ConfigurationItem {id: $from})
    MATCH (target:ConfigurationItem {id: $to})
    MERGE (source)-[r:${type}]->(target)
    SET r.weight = $weight,
        r.criticalityScore = $properties.criticalityScore,
        r.loadFactor = $properties.loadFactor,
        r.redundancyLevel = $properties.redundancyLevel,
        r.latencyMs = $properties.latencyMs,
        r.lastUpdated = datetime(),
        r.source = $properties.source
    RETURN r
  `;

  const result = await neo4j.run(cypher, { from, to, weight, properties });
  res.json(result);
});

// GET /api/cmdb/analysis/weighted-path
// Find weighted shortest path
router.post('/analysis/weighted-path', async (req, res) => {
  const { startNode, endNode, algorithm, weightProperty, maxDepth } = req.body;

  const cypher = `
    MATCH (start:ConfigurationItem {id: $startNode})
    MATCH (end:ConfigurationItem {id: $endNode})
    CALL gds.shortestPath.dijkstra.stream('ci-topology', {
      sourceNode: id(start),
      targetNode: id(end),
      relationshipWeightProperty: $weightProperty
    })
    YIELD index, sourceNode, targetNode, totalCost, nodeIds, costs, path
    RETURN
      [nodeId IN nodeIds | gds.util.asNode(nodeId).name] AS pathNodes,
      totalCost AS weightedDistance,
      costs AS cumulativeWeights
    ORDER BY totalCost ASC
    LIMIT 1
  `;

  const result = await neo4j.run(cypher, { startNode, endNode, weightProperty });
  res.json(result);
});
```

#### Temporal Relationships

```javascript
// GET /api/cmdb/topology/temporal
// Query topology at a specific point in time
router.get('/topology/temporal', async (req, res) => {
  const { date, startNode, depth } = req.query;
  const targetDate = new Date(date);

  const cypher = `
    MATCH (start:ConfigurationItem {id: $startNode})
    MATCH path = (start)-[r*1..${depth}]-(connected)
    WHERE ALL(rel IN relationships(path) WHERE
      rel.validFrom <= datetime($targetDate)
      AND (rel.validTo IS NULL OR rel.validTo >= datetime($targetDate))
    )
    RETURN path, connected
  `;

  const result = await neo4j.run(cypher, { startNode, targetDate: targetDate.toISOString() });
  res.json(formatTopologyResponse(result));
});

// GET /api/cmdb/relationships/:from/:to/history
// Get relationship history
router.get('/relationships/:from/:to/history', async (req, res) => {
  const { from, to } = req.params;

  const cypher = `
    MATCH (ci1:ConfigurationItem {id: $from})-[r]->(ci2:ConfigurationItem {id: $to})
    WHERE r.status IS NOT NULL
    RETURN r.validFrom, r.validTo, r.weight, r.version, r.changeReason, r.modifiedBy
    ORDER BY r.version DESC
  `;

  const result = await neo4j.run(cypher, { from, to });
  res.json(result.map(r => r.toObject()));
});
```

#### Conditional Dependencies

```javascript
// POST /api/cmdb/analysis/simulate-failover
// Simulate failover scenario
router.post('/analysis/simulate-failover', async (req, res) => {
  const { ciId, failureType } = req.body;

  const cypher = `
    MATCH (primary:ConfigurationItem {id: $ciId})
    MATCH (primary)-[failover:FAILS_OVER_TO]->(standby)
    WHERE failover.isActive = false
      AND standby.status = 'OPERATIONAL'
      AND failover.activationCondition.primaryHealth = $failureType

    // Find affected applications
    MATCH (app:Application)-[:DEPENDS_ON*1..3]->(primary)

    WITH app, primary, collect({
      target: standby,
      priority: failover.priority,
      rpo: failover.rpoMinutes,
      rto: failover.rtoMinutes,
      automatic: failover.automaticFailover
    }) AS failoverOptions

    RETURN
      app.name AS application,
      app.criticality AS criticality,
      failoverOptions,
      reduce(maxRTO = 0, option IN failoverOptions |
        CASE WHEN option.rto > maxRTO THEN option.rto ELSE maxRTO END
      ) AS estimatedDowntimeMinutes
    ORDER BY app.criticality DESC
  `;

  const result = await neo4j.run(cypher, { ciId, failureType });
  res.json(result.map(r => r.toObject()));
});

// POST /api/cmdb/relationships/conditional/activate
// Manually activate a conditional relationship
router.post('/relationships/conditional/activate', async (req, res) => {
  const { relationshipId, reason } = req.body;

  const cypher = `
    MATCH ()-[r]->()
    WHERE id(r) = $relationshipId
      AND r.conditionType IS NOT NULL
      AND r.isActive = false
    SET r.isActive = true,
        r.lastActivated = datetime(),
        r.activationCount = r.activationCount + 1,
        r.activationReason = $reason,
        r.activatedBy = $userId
    RETURN r
  `;

  const result = await neo4j.run(cypher, { relationshipId, reason, userId: req.user.id });
  res.json(result);
});
```

#### AI Infrastructure

```javascript
// GET /api/cmdb/ai/agents
// List all AI agents with capabilities
router.get('/ai/agents', async (req, res) => {
  const { capability, status } = req.query;

  let cypher = `
    MATCH (agent:AIAgent)
  `;

  const conditions = [];
  const params = {};

  if (capability) {
    conditions.push('$capability IN agent.capabilities');
    params.capability = capability;
  }

  if (status) {
    conditions.push('agent.status = $status');
    params.status = status;
  }

  if (conditions.length > 0) {
    cypher += ` WHERE ${conditions.join(' AND ')}`;
  }

  cypher += `
    OPTIONAL MATCH (agent)-[:USES_MODEL]->(llm:LLMService)
    OPTIONAL MATCH (agent)-[:MONITORED_BY]->(obs:LLMObservability)
    RETURN agent, llm.modelName AS model, obs.platform AS observability
    ORDER BY agent.name
  `;

  const result = await neo4j.run(cypher, params);
  res.json(result.map(r => ({
    ...r.agent.properties,
    model: r.model,
    observability: r.observability
  })));
});

// POST /api/cmdb/ai/delegation-chain
// Find agent delegation chain for a task
router.post('/ai/delegation-chain', async (req, res) => {
  const { taskType, maxDepth } = req.body;

  const cypher = `
    MATCH (coordinator:AIAgent {agentType: 'coordinator'})
    MATCH path = (coordinator)-[:DELEGATES_TO*1..${maxDepth}]->(worker:AIAgent)
    WHERE $taskType IN worker.capabilities
    RETURN path,
           [node IN nodes(path) | node.name] AS delegationChain,
           length(path) AS delegationDepth,
           reduce(totalCost = 0.0, node IN nodes(path) |
             totalCost + node.averageCostPerCall
           ) AS estimatedCost
    ORDER BY delegationDepth ASC, estimatedCost ASC
    LIMIT 10
  `;

  const result = await neo4j.run(cypher, { taskType, maxDepth: parseInt(maxDepth) || 5 });
  res.json(result.map(r => ({
    delegationChain: r.delegationChain,
    depth: r.delegationDepth,
    estimatedCost: r.estimatedCost
  })));
});
```

### 8.3 Data Migration Scripts

```javascript
/**
 * Migration script to add weighted properties to existing relationships
 */
async function migrateToWeightedRelationships() {
  console.log('Starting weighted relationship migration...');

  // Step 1: Add weight property to all existing relationships
  const addWeightQuery = `
    MATCH ()-[r:DEPENDS_ON]->()
    WHERE r.weight IS NULL
    SET r.weight = 0.5,  // Default weight
        r.criticalityScore = 0.5,
        r.source = 'migration',
        r.lastUpdated = datetime(),
        r.version = 1
    RETURN count(r) AS updated
  `;

  const result1 = await neo4j.run(addWeightQuery);
  console.log(`Updated ${result1[0].updated} relationships with default weights`);

  // Step 2: Calculate weights based on CI criticality
  const calculateWeightsQuery = `
    MATCH (source:ConfigurationItem)-[r:DEPENDS_ON]->(target:ConfigurationItem)
    WITH source, r, target,
         CASE source.criticality
           WHEN 'CRITICAL' THEN 1.0
           WHEN 'HIGH' THEN 0.75
           WHEN 'MEDIUM' THEN 0.5
           WHEN 'LOW' THEN 0.25
           ELSE 0.5
         END AS sourceCrit,
         CASE target.criticality
           WHEN 'CRITICAL' THEN 1.0
           WHEN 'HIGH' THEN 0.75
           WHEN 'MEDIUM' THEN 0.5
           WHEN 'LOW' THEN 0.25
           ELSE 0.5
         END AS targetCrit
    SET r.criticalityScore = (sourceCrit + targetCrit) / 2,
        r.weight = (sourceCrit + targetCrit) / 2,
        r.source = 'auto-calculated',
        r.lastUpdated = datetime()
    RETURN count(r) AS calculated
  `;

  const result2 = await neo4j.run(calculateWeightsQuery);
  console.log(`Calculated weights for ${result2[0].calculated} relationships`);

  console.log('Migration complete!');
}

/**
 * Migration script to add temporal properties
 */
async function migrateToTemporalRelationships() {
  console.log('Starting temporal relationship migration...');

  const addTemporalQuery = `
    MATCH ()-[r]->()
    WHERE r.validFrom IS NULL
    SET r.validFrom = datetime(),
        r.validTo = null,
        r.createdAt = datetime(),
        r.version = 1,
        r.status = 'ACTIVE'
    RETURN count(r) AS updated
  `;

  const result = await neo4j.run(addTemporalQuery);
  console.log(`Added temporal properties to ${result[0].updated} relationships`);

  console.log('Migration complete!');
}
```

### 8.4 Performance Optimization

#### Query Optimization Strategies

```cypher
// Use relationship property indexes
// Before optimization
MATCH (start)-[r:DEPENDS_ON*1..6]->(end)
WHERE r.weight > 0.8
RETURN start, end

// After optimization with index
MATCH (start)-[r:DEPENDS_ON*1..6]->(end)
USING INDEX r:DEPENDS_ON(weight)
WHERE r.weight > 0.8
RETURN start, end

// Use query hints for large graphs
MATCH (start:ConfigurationItem {id: $startId})
USING INDEX start:ConfigurationItem(id)
MATCH path = (start)-[:DEPENDS_ON*1..3]->(connected)
RETURN path
LIMIT 100
```

#### Caching Strategy

```javascript
/**
 * Redis cache for weighted path queries
 */
class WeightedPathCache {
  constructor(redisClient) {
    this.redis = redisClient;
    this.ttl = 300; // 5 minutes
  }

  getCacheKey(startNode, endNode, weightProperty) {
    return `weighted-path:${startNode}:${endNode}:${weightProperty}`;
  }

  async get(startNode, endNode, weightProperty) {
    const key = this.getCacheKey(startNode, endNode, weightProperty);
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(startNode, endNode, weightProperty, result) {
    const key = this.getCacheKey(startNode, endNode, weightProperty);
    await this.redis.setex(key, this.ttl, JSON.stringify(result));
  }
}
```

---

## 9. Use Cases & Examples

### 9.1 Multi-Cloud Failover Scenario

**Scenario**: E-commerce platform with primary infrastructure in AWS US-East, hot standby in AWS US-West, and cold DR in Azure West Europe.

```cypher
// Primary production environment (AWS US-East)
CREATE (awsProd:DataCenter {
  id: 'dc-aws-us-east-1',
  name: 'AWS US-East Production',
  provider: 'aws',
  region: 'us-east-1',
  type: 'PRIMARY',
  status: 'OPERATIONAL'
})

CREATE (awsProdDB:Database {
  id: 'db-prod-001',
  name: 'Production PostgreSQL Primary',
  dbType: 'postgresql',
  version: '15.3',
  criticality: 'CRITICAL',
  status: 'OPERATIONAL'
})

CREATE (awsProdApp:Application {
  id: 'app-ecommerce-001',
  name: 'E-Commerce Application',
  type: 'WebApplication',
  criticality: 'CRITICAL',
  status: 'OPERATIONAL'
})

// Hot standby (AWS US-West)
CREATE (awsStandby:DataCenter {
  id: 'dc-aws-us-west-1',
  name: 'AWS US-West Hot Standby',
  provider: 'aws',
  region: 'us-west-1',
  type: 'HOT_STANDBY',
  status: 'OPERATIONAL'
})

CREATE (awsStandbyDB:Database {
  id: 'db-standby-001',
  name: 'Production PostgreSQL Hot Standby',
  dbType: 'postgresql',
  version: '15.3',
  criticality: 'CRITICAL',
  status: 'STANDBY',
  replicationLag: 0.5 // seconds
})

// Cold DR (Azure West Europe)
CREATE (azureDR:DataCenter {
  id: 'dc-azure-eu-west-1',
  name: 'Azure West Europe DR',
  provider: 'azure',
  region: 'westeurope',
  type: 'COLD_DR',
  status: 'STANDBY'
})

CREATE (azureDRStorage:BackupStorage {
  id: 'backup-azure-001',
  name: 'Azure Blob Storage DR',
  storageType: 'blob',
  capacity: '50TB',
  status: 'OPERATIONAL'
})

// Weighted relationships
(awsProdApp)-[:DEPENDS_ON {
  weight: 0.95,
  criticalityScore: 0.95,
  loadFactor: 80,
  latencyMs: 5
}]->(awsProdDB)

// Conditional failover relationships
(awsProdDB)-[:FAILS_OVER_TO {
  priority: 1,
  weight: 0.95,
  conditionType: 'health-based',
  activationCondition: {
    primaryHealth: 'FAILED',
    failureThreshold: 3,
    gracePeriodSeconds: 30
  },
  isActive: false,
  automaticFailover: true,
  rpoMinutes: 0.5,
  rtoMinutes: 2,
  dataLagSeconds: 0.5,
  lastTested: datetime('2024-11-15T00:00:00Z'),
  testResults: 'PASSED'
}]->(awsStandbyDB)

(awsProdDB)-[:BACKS_UP_TO {
  priority: 2,
  weight: 0.7,
  conditionType: 'manual',
  isActive: false,
  automaticFailover: false,
  approvalRequired: true,
  rpoMinutes: 1440, // Daily backup
  rtoMinutes: 480,  // 8 hours
  lastBackup: datetime('2024-11-30T02:00:00Z'),
  backupSize: '2.5TB'
}]->(azureDRStorage)

// Query: Simulate primary database failure
MATCH (primary:Database {id: 'db-prod-001'})
MATCH (primary)-[failover:FAILS_OVER_TO]->(standby)
WHERE failover.priority = 1
  AND failover.isActive = false
MATCH (app)-[:DEPENDS_ON]->(primary)

RETURN
  app.name AS affectedApplication,
  standby.name AS failoverTarget,
  failover.rtoMinutes AS downtimeMinutes,
  failover.rpoMinutes AS dataLossMinutes,
  failover.automaticFailover AS automatic,
  'Data loss: ' + toString(failover.rpoMinutes) + ' minutes, Downtime: ' + toString(failover.rtoMinutes) + ' minutes' AS impact
```

### 9.2 AI Agent Infrastructure Cost Optimization

**Scenario**: Optimize AI agent workflow by selecting most cost-effective LLM models while maintaining quality.

```cypher
// Create AI infrastructure
CREATE (workflow:AgentWorkflow {
  id: 'workflow-customer-support',
  name: 'Customer Support Automation',
  workflowType: 'sequential',
  totalExecutions: 10000,
  averageDurationSeconds: 45
})

CREATE (coordinator:AIAgent {
  id: 'agent-coordinator-support',
  name: 'Support Coordinator Agent',
  agentType: 'coordinator',
  model: 'claude-3-opus',
  capabilities: ['routing', 'triage', 'escalation'],
  maxTokens: 2000,
  temperature: 0.3
})

CREATE (responder:AIAgent {
  id: 'agent-responder',
  name: 'Support Response Agent',
  agentType: 'worker',
  model: 'gpt-4-turbo',
  capabilities: ['response-generation', 'knowledge-retrieval'],
  maxTokens: 1000,
  temperature: 0.7
})

// LLM options
CREATE (claudeOpus:LLMService {
  id: 'llm-claude-opus',
  modelName: 'claude-3-opus',
  provider: 'anthropic',
  inputPricePerMillion: 15.00,
  outputPricePerMillion: 75.00,
  averageLatencyMs: 2500,
  qualityScore: 0.95
})

CREATE (claudeSonnet:LLMService {
  id: 'llm-claude-sonnet',
  modelName: 'claude-3-sonnet',
  provider: 'anthropic',
  inputPricePerMillion: 3.00,
  outputPricePerMillion: 15.00,
  averageLatencyMs: 1800,
  qualityScore: 0.85
})

CREATE (gpt4:LLMService {
  id: 'llm-gpt4-turbo',
  modelName: 'gpt-4-turbo',
  provider: 'openai',
  inputPricePerMillion: 10.00,
  outputPricePerMillion: 30.00,
  averageLatencyMs: 3000,
  qualityScore: 0.90
})

// Current usage
(coordinator)-[:USES_MODEL {
  averageTokensPerCall: 1500,
  callsPerDay: 1000
}]->(claudeOpus)

(responder)-[:USES_MODEL {
  averageTokensPerCall: 800,
  callsPerDay: 1000
}]->(gpt4)

// Query: Find cost optimization opportunities
MATCH (agent:AIAgent)-[usage:USES_MODEL]->(currentLLM:LLMService)
MATCH (alternativeLLM:LLMService)
WHERE alternativeLLM.id <> currentLLM.id
  AND alternativeLLM.qualityScore >= currentLLM.qualityScore - 0.1 // Max 10% quality drop

WITH agent, currentLLM, alternativeLLM, usage,
     // Calculate current cost
     (currentLLM.inputPricePerMillion / 1000000 * usage.averageTokensPerCall * usage.callsPerDay * 30) AS currentMonthlyCost,
     // Calculate alternative cost
     (alternativeLLM.inputPricePerMillion / 1000000 * usage.averageTokensPerCall * usage.callsPerDay * 30) AS alternativeMonthlyCost

WHERE alternativeMonthlyCost < currentMonthlyCost

RETURN
  agent.name AS agent,
  currentLLM.modelName AS currentModel,
  currentMonthlyCost AS currentCost,
  alternativeLLM.modelName AS recommendedModel,
  alternativeMonthlyCost AS alternativeCost,
  currentMonthlyCost - alternativeMonthlyCost AS monthlySavings,
  (currentMonthlyCost - alternativeMonthlyCost) * 12 AS annualSavings,
  currentLLM.qualityScore AS currentQuality,
  alternativeLLM.qualityScore AS alternativeQuality

ORDER BY monthlySavings DESC
```

### 9.3 Temporal Topology Analysis

**Scenario**: Analyze how infrastructure topology changed over time during a migration project.

```cypher
// Create initial topology (Jan 2024)
CREATE (oldDB:Database {
  id: 'db-legacy-001',
  name: 'Legacy MySQL Database',
  status: 'OPERATIONAL'
})

CREATE (app:Application {
  id: 'app-001',
  name: 'Customer Portal'
})

// Initial relationship
(app)-[:DEPENDS_ON {
  validFrom: datetime('2024-01-01T00:00:00Z'),
  validTo: datetime('2024-06-15T23:59:59Z'),
  weight: 0.9,
  version: 1,
  status: 'ARCHIVED',
  changeReason: 'Database migration to PostgreSQL'
}]->(oldDB)

// New database
CREATE (newDB:Database {
  id: 'db-postgres-001',
  name: 'PostgreSQL Database',
  status: 'OPERATIONAL'
})

// New relationship after migration
(app)-[:DEPENDS_ON {
  validFrom: datetime('2024-06-16T00:00:00Z'),
  validTo: null,
  weight: 0.95,
  version: 2,
  status: 'ACTIVE',
  changeReason: 'Migration completed',
  previousVersion: 1
}]->(newDB)

// Query: Compare topology at different points in time
// Topology on March 1, 2024 (before migration)
MATCH (app:Application {id: 'app-001'})
MATCH path = (app)-[r:DEPENDS_ON]-(db:Database)
WHERE r.validFrom <= datetime('2024-03-01T00:00:00Z')
  AND (r.validTo IS NULL OR r.validTo >= datetime('2024-03-01T00:00:00Z'))
RETURN app.name, db.name, r.version, 'Before Migration' AS timeframe

UNION

// Topology on September 1, 2024 (after migration)
MATCH (app:Application {id: 'app-001'})
MATCH path = (app)-[r:DEPENDS_ON]-(db:Database)
WHERE r.validFrom <= datetime('2024-09-01T00:00:00Z')
  AND (r.validTo IS NULL OR r.validTo >= datetime('2024-09-01T00:00:00Z'))
RETURN app.name, db.name, r.version, 'After Migration' AS timeframe
```

---

## 10. Testing & Validation

### 10.1 Unit Test Cases

```javascript
describe('Weighted Relationship Calculations', () => {
  test('should calculate criticality score correctly', () => {
    const score = calculateCriticalityScore({
      sourceCriticality: 1.0,      // CRITICAL
      targetCriticality: 0.75,     // HIGH
      businessImpact: 0.9,
      redundancyLevel: 2,
      historicalFailures: 5,
      recoveryComplexity: 0.6
    });

    expect(score).toBeGreaterThan(0.7);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  test('should normalize load factor to 0-100 range', () => {
    const loadFactor = calculateLoadFactor({
      requestsPerSecond: 500,
      totalCapacity: 1000,
      peakLoadHistory: 750,
      loadBalancingWeight: 60
    });

    expect(loadFactor).toBeGreaterThanOrEqual(0);
    expect(loadFactor).toBeLessThanOrEqual(100);
  });
});

describe('Conditional Dependency Activation', () => {
  test('should activate failover on primary failure', async () => {
    const engine = new ConditionalDependencyEngine(neo4jDriver, eventBus);

    // Simulate primary failure
    await setPrimaryStatus('db-prod-001', 'FAILED');
    await engine.evaluateConditions();

    // Check if failover relationship is activated
    const failover = await getRelationship('db-prod-001', 'db-standby-001', 'FAILS_OVER_TO');
    expect(failover.isActive).toBe(true);
  });

  test('should not activate failover during grace period', async () => {
    const engine = new ConditionalDependencyEngine(neo4jDriver, eventBus);

    // Simulate failure just before grace period expires
    await setPrimaryStatus('db-prod-001', 'FAILED');
    await sleep(20 * 1000); // Wait 20 seconds (grace period is 30)
    await engine.evaluateConditions();

    const failover = await getRelationship('db-prod-001', 'db-standby-001', 'FAILS_OVER_TO');
    expect(failover.isActive).toBe(false); // Should not activate yet
  });
});

describe('Temporal Queries', () => {
  test('should return correct topology for historical date', async () => {
    const topology = await queryTemporalTopology('app-001', '2024-03-01T00:00:00Z', 2);

    expect(topology.nodes).toContainEqual(expect.objectContaining({ id: 'db-legacy-001' }));
    expect(topology.nodes).not.toContainEqual(expect.objectContaining({ id: 'db-postgres-001' }));
  });

  test('should return current topology for future date', async () => {
    const topology = await queryTemporalTopology('app-001', '2024-12-01T00:00:00Z', 2);

    expect(topology.nodes).toContainEqual(expect.objectContaining({ id: 'db-postgres-001' }));
    expect(topology.nodes).not.toContainEqual(expect.objectContaining({ id: 'db-legacy-001' }));
  });
});
```

### 10.2 Integration Test Cases

```javascript
describe('AI Agent Infrastructure', () => {
  test('should find delegation chain for task', async () => {
    const response = await request(app)
      .post('/api/cmdb/ai/delegation-chain')
      .send({
        taskType: 'code-generation',
        maxDepth: 5
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(greaterThan(0));
    expect(response.body[0].delegationChain).toContain('Task Coordinator Agent');
    expect(response.body[0].delegationChain).toContain('Code Generation Agent');
  });

  test('should calculate workflow cost correctly', async () => {
    const response = await request(app)
      .get('/api/cmdb/ai/workflow-cost/workflow-customer-support');

    expect(response.status).toBe(200);
    expect(response.body.totalCost).toBeGreaterThan(0);
    expect(response.body.breakdown).toHaveProperty('coordinatorCost');
    expect(response.body.breakdown).toHaveProperty('workerCost');
  });
});

describe('Failover Simulation', () => {
  test('should return failover plan for database failure', async () => {
    const response = await request(app)
      .post('/api/cmdb/analysis/simulate-failover')
      .send({
        ciId: 'db-prod-001',
        failureType: 'FAILED'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(greaterThan(0));
    expect(response.body[0]).toHaveProperty('failoverOptions');
    expect(response.body[0]).toHaveProperty('estimatedDowntimeMinutes');
  });
});
```

### 10.3 Performance Test Cases

```javascript
describe('Weighted Pathfinding Performance', () => {
  test('should complete dijkstra search within 100ms for 1000 nodes', async () => {
    const startTime = Date.now();

    const result = await neo4j.run(`
      MATCH (start:ConfigurationItem {id: $startId})
      MATCH (end:ConfigurationItem {id: $endId})
      CALL gds.shortestPath.dijkstra.stream('ci-topology', {
        sourceNode: id(start),
        targetNode: id(end),
        relationshipWeightProperty: 'weight'
      })
      YIELD path
      RETURN path
      LIMIT 1
    `, { startId: 'app-001', endId: 'db-999' });

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(100); // Should complete in < 100ms
  });

  test('should handle 10,000 conditional evaluations per second', async () => {
    const engine = new ConditionalDependencyEngine(neo4jDriver, eventBus);
    const iterations = 10000;

    const startTime = Date.now();
    for (let i = 0; i < iterations; i++) {
      await engine.evaluateConditions();
    }
    const duration = Date.now() - startTime;

    const evaluationsPerSecond = iterations / (duration / 1000);
    expect(evaluationsPerSecond).toBeGreaterThan(10000);
  });
});
```

### 10.4 Data Generation Test Cases

```javascript
/**
 * Generate test data for weighted relationships
 */
async function generateWeightedTestData() {
  const dataGenerator = {
    servers: 100,
    applications: 200,
    databases: 50,
    relationships: 500
  };

  // Generate servers with varying criticality
  for (let i = 0; i < dataGenerator.servers; i++) {
    await createCI({
      id: `srv-test-${i}`,
      type: 'Server',
      criticality: i < 10 ? 'CRITICAL' : i < 30 ? 'HIGH' : 'MEDIUM'
    });
  }

  // Generate weighted relationships
  for (let i = 0; i < dataGenerator.relationships; i++) {
    const source = `app-test-${i % dataGenerator.applications}`;
    const target = `srv-test-${i % dataGenerator.servers}`;

    await createWeightedRelationship({
      from: source,
      to: target,
      type: 'RUNS_ON',
      weight: Math.random(),
      criticalityScore: Math.random(),
      loadFactor: Math.random() * 100
    });
  }
}

/**
 * Generate AI infrastructure test data
 */
async function generateAIInfrastructureTestData() {
  // Create orchestrator
  await createCI({
    id: 'test-orchestrator-001',
    type: 'A2AOrchestrator',
    orchestrationType: 'centralized',
    registeredAgents: []
  });

  // Create agent hierarchy
  const agentTypes = ['coordinator', 'worker', 'worker', 'worker'];
  for (let i = 0; i < agentTypes.length; i++) {
    await createCI({
      id: `test-agent-${i}`,
      type: 'AIAgent',
      agentType: agentTypes[i],
      model: 'claude-3-opus',
      capabilities: ['test-capability']
    });

    // Create orchestration relationship
    await createRelationship({
      from: 'test-orchestrator-001',
      to: `test-agent-${i}`,
      type: 'ORCHESTRATES',
      priority: i
    });
  }
}
```

---

## 11. Migration & Rollback Strategy

### 11.1 Phased Migration Approach

```javascript
/**
 * Phase 1: Add weighted properties to existing relationships (non-breaking)
 */
async function migratePhase1() {
  console.log('Phase 1: Adding weighted properties...');

  // Add properties with defaults (doesn't break existing queries)
  await neo4j.run(`
    MATCH ()-[r:DEPENDS_ON]->()
    WHERE r.weight IS NULL
    SET r.weight = 0.5,
        r.criticalityScore = 0.5,
        r.loadFactor = 50,
        r.source = 'default',
        r.lastUpdated = datetime()
  `);

  console.log('Phase 1 complete');
}

/**
 * Phase 2: Calculate actual weights (can run in background)
 */
async function migratePhase2() {
  console.log('Phase 2: Calculating weights...');

  // Run weight calculation asynchronously
  const job = await jobQueue.add('calculate-weights', {
    batchSize: 1000
  });

  console.log(`Phase 2 job queued: ${job.id}`);
}

/**
 * Phase 3: Add temporal properties (non-breaking)
 */
async function migratePhase3() {
  console.log('Phase 3: Adding temporal properties...');

  await neo4j.run(`
    MATCH ()-[r]->()
    WHERE r.validFrom IS NULL
    SET r.validFrom = datetime(),
        r.validTo = null,
        r.version = 1,
        r.status = 'ACTIVE'
  `);

  console.log('Phase 3 complete');
}

/**
 * Phase 4: Create AI infrastructure (new types, doesn't affect existing)
 */
async function migratePhase4() {
  console.log('Phase 4: Creating AI infrastructure types...');

  // Add constraints for new CI types
  await neo4j.run(`
    CREATE CONSTRAINT ai_agent_id_unique IF NOT EXISTS
    FOR (a:AIAgent) REQUIRE a.id IS UNIQUE
  `);

  await neo4j.run(`
    CREATE CONSTRAINT mcp_server_id_unique IF NOT EXISTS
    FOR (m:MCPServer) REQUIRE m.id IS UNIQUE
  `);

  console.log('Phase 4 complete');
}

/**
 * Master migration orchestrator
 */
async function runMigration() {
  try {
    await migratePhase1(); // Weighted properties
    await migratePhase2(); // Weight calculation
    await migratePhase3(); // Temporal properties
    await migratePhase4(); // AI infrastructure

    console.log('All migration phases complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    await rollbackMigration();
  }
}
```

### 11.2 Rollback Strategy

```javascript
/**
 * Rollback migration changes
 */
async function rollbackMigration() {
  console.log('Rolling back migration...');

  // Rollback Phase 4: Remove AI infrastructure constraints
  await neo4j.run(`DROP CONSTRAINT ai_agent_id_unique IF EXISTS`);
  await neo4j.run(`DROP CONSTRAINT mcp_server_id_unique IF EXISTS`);

  // Rollback Phase 3: Remove temporal properties
  await neo4j.run(`
    MATCH ()-[r]->()
    REMOVE r.validFrom, r.validTo, r.version, r.status
  `);

  // Rollback Phase 2 & 1: Remove weighted properties
  await neo4j.run(`
    MATCH ()-[r:DEPENDS_ON]->()
    REMOVE r.weight, r.criticalityScore, r.loadFactor, r.source, r.lastUpdated
  `);

  console.log('Rollback complete');
}

/**
 * Verify migration success
 */
async function verifyMigration() {
  const checks = {
    weightedRelationships: false,
    temporalProperties: false,
    aiInfrastructure: false
  };

  // Check weighted relationships
  const weightedCount = await neo4j.run(`
    MATCH ()-[r:DEPENDS_ON]->()
    WHERE r.weight IS NOT NULL
    RETURN count(r) as count
  `);
  checks.weightedRelationships = weightedCount[0].count > 0;

  // Check temporal properties
  const temporalCount = await neo4j.run(`
    MATCH ()-[r]->()
    WHERE r.validFrom IS NOT NULL
    RETURN count(r) as count
  `);
  checks.temporalProperties = temporalCount[0].count > 0;

  // Check AI infrastructure
  const aiCount = await neo4j.run(`
    MATCH (a:AIAgent)
    RETURN count(a) as count
  `);
  checks.aiInfrastructure = aiCount[0].count >= 0; // Can be 0 if no AI CIs created yet

  console.log('Migration verification:', checks);
  return Object.values(checks).every(check => check === true);
}
```

---

## 12. Conclusion & Next Steps

### 12.1 Summary

This feature specification outlines a comprehensive plan to transform the Experimental CMDB from a basic relationship modeling system into an enterprise-grade platform capable of:

✅ **Weighted Relationships**: Intelligent dependency analysis with criticality scoring, load factors, and optimized pathfinding
✅ **Temporal Properties**: Time-aware topology with historical tracking, versioning, and future-state planning
✅ **Conditional Dependencies**: Context-aware relationships for failover, DR, and dynamic infrastructure scenarios
✅ **AI Infrastructure**: Native support for modern AI agent architectures (MCP, A2A, LLM orchestration)

### 12.2 Business Impact

**Expected Outcomes**:
- 📊 **90% more accurate** impact analysis with weighted dependencies
- ⚡ **50% faster MTTR** with conditional dependency awareness and automated failover
- 🔮 **Proactive planning** enabled by temporal topology and what-if analysis
- 🤖 **AI-ready infrastructure** supporting emerging agent-based architectures
- 💰 **Cost optimization** through weighted path analysis and LLM selection

### 12.3 Next Steps

1. **Review & Approval**: Stakeholder review of this specification (1 week)
2. **Prototype Development**: Build proof-of-concept for weighted relationships (2 weeks)
3. **Iterative Implementation**: Follow 5-phase roadmap (19 weeks total)
4. **Beta Testing**: Deploy to staging environment with real data (2 weeks)
5. **Production Rollout**: Gradual migration with monitoring (2 weeks)
6. **Documentation & Training**: User guides and API documentation (1 week)

**Total Timeline**: ~27 weeks (6.5 months)

### 12.4 Success Metrics

Track these KPIs to measure feature success:

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| **Impact Analysis Accuracy** | 60% | 90% | User surveys, incident reviews |
| **Weighted Path Query Performance** | N/A | <100ms @ 10K nodes | Query profiling |
| **Failover Simulation Accuracy** | N/A | 95% | DR drill validation |
| **API Response Time (p95)** | 200ms | <500ms | Application monitoring |
| **User Adoption Rate** | N/A | 80% active users | Usage analytics |
| **Cost Reduction (AI workflows)** | N/A | 30% savings | Cost tracking |

### 12.5 Open Questions

Items requiring further investigation:

- ❓ **Neo4j GDS Licensing**: Confirm Graph Data Science library licensing for production use
- ❓ **Temporal Data Retention**: Define retention policy for archived relationships (6 months? 1 year?)
- ❓ **AI Agent Standards**: Monitor evolution of A2A and MCP protocols for schema updates
- ❓ **Performance at Scale**: Validate query performance with 100K+ nodes and 1M+ relationships
- ❓ **Multi-Tenancy**: Should AI infrastructure support tenant isolation?

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **A2A** | Agent-to-Agent protocol for multi-agent collaboration |
| **Criticality Score** | Numeric measure (0.0-1.0) of dependency importance |
| **Conditional Dependency** | Relationship that activates based on system state |
| **Load Factor** | Percentage of traffic/load flowing through a path (0-100) |
| **MCP** | Model Context Protocol for connecting AI to tools/data |
| **RTO** | Recovery Time Objective - maximum acceptable downtime |
| **RPO** | Recovery Point Objective - maximum acceptable data loss |
| **Temporal Relationship** | Time-aware dependency with validity period |
| **Weighted Edge** | Relationship with numeric properties for pathfinding |

## Appendix B: References

- [Neo4j Graph Data Science Documentation](https://neo4j.com/docs/graph-data-science/)
- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Agent-to-Agent Protocol (A2A)](https://ai.google.dev/api/agent2agent)
- [Neo4j Temporal Graph Modeling](https://neo4j.com/developer/modeling-temporal-data/)
- [Graph Algorithms for CMDB](https://neo4j.com/use-cases/configuration-management-database/)

---

**Document Status**: ✅ Complete
**Version**: 1.0
**Last Updated**: 2025-01-30
**Authors**: CMDB Development Team
**Reviewers**: TBD
**Approval**: Pending
