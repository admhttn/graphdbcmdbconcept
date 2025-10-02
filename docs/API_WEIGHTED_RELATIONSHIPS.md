# Weighted Relationships API Documentation

**Version:** 1.0
**Base Path:** `/api/relationships`
**Status:** ✅ Implemented (Phase 1)

---

## Overview

The Weighted Relationships API provides endpoints for creating, managing, and querying weighted relationships in the CMDB graph database. Weighted relationships add numeric properties to edges that represent criticality, load distribution, latency, and other operational metrics.

### Key Features

- ✅ **Create weighted relationships** with criticality scores, load factors, and latency metrics
- ✅ **Calculate relationship weights** automatically based on CI properties and operational data
- ✅ **Find shortest weighted paths** using Dijkstra's algorithm
- ✅ **Rank components by criticality** based on relationship weights
- ✅ **Batch operations** for creating multiple weighted relationships efficiently

---

## Authentication & Rate Limiting

All endpoints use IP-based rate limiting:

| Endpoint Type | Rate Limit | Window |
|---------------|------------|--------|
| Read operations | 100 requests | 15 minutes |
| Write operations | 20 requests | 15 minutes |
| Expensive operations (pathfinding, rankings) | 30 requests | 15 minutes |

Rate limit headers are included in responses:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining
- `RateLimit-Reset`: Time when limit resets (Unix timestamp)

---

## Endpoints

### 1. Create Weighted Relationship

Create or update a weighted relationship between two Configuration Items.

**Endpoint:** `POST /api/relationships/weighted`

**Request Body:**
```json
{
  "from": "app-ecommerce-001",
  "to": "db-postgres-prod",
  "type": "DEPENDS_ON",
  "properties": {
    "weight": 0.85,
    "criticality": "HIGH",
    "criticalityScore": 0.9,
    "loadFactor": 75,
    "redundancyLevel": 2,
    "latencyMs": 15,
    "bandwidthMbps": 1000,
    "costPerHour": 2.50,
    "confidence": 0.95,
    "source": "automated"
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | string | ✅ | Source CI ID |
| `to` | string | ✅ | Target CI ID |
| `type` | string | ✅ | Relationship type (DEPENDS_ON, RUNS_ON, SUPPORTS, etc.) |
| `properties.weight` | number | ❌ | Overall weight (0.0-1.0), default: 0.5 |
| `properties.criticality` | string | ❌ | Human-readable criticality (CRITICAL, HIGH, MEDIUM, LOW, INFO) |
| `properties.criticalityScore` | number | ❌ | Numeric criticality (0.0-1.0) |
| `properties.loadFactor` | number | ❌ | Load percentage (0-100), default: 50 |
| `properties.redundancyLevel` | number | ❌ | Alternative path count, default: 1 |
| `properties.latencyMs` | number | ❌ | Latency in milliseconds, default: 0 |
| `properties.bandwidthMbps` | number | ❌ | Available bandwidth in Mbps |
| `properties.costPerHour` | number | ❌ | Operational cost per hour |
| `properties.confidence` | number | ❌ | Confidence in weight (0.0-1.0), default: 0.8 |
| `properties.source` | string | ❌ | Weight source (manual, automated, ml-predicted) |

**Response:**
```json
{
  "message": "Weighted relationship created successfully",
  "relationship": {
    "from": "app-ecommerce-001",
    "to": "db-postgres-prod",
    "type": "DEPENDS_ON",
    "fromName": "E-Commerce Application",
    "toName": "PostgreSQL Production Database",
    "properties": {
      "weight": 0.85,
      "criticality": "HIGH",
      "criticalityScore": 0.9,
      "loadFactor": 75,
      "redundancyLevel": 2,
      "latencyMs": 15,
      "lastUpdated": "2025-10-01T14:30:00.000Z"
    }
  }
}
```

**Status Codes:**
- `201 Created` - Relationship created successfully
- `400 Bad Request` - Invalid parameters
- `404 Not Found` - Source or target CI not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

### 2. Get Weighted Relationship

Retrieve a specific weighted relationship.

**Endpoint:** `GET /api/relationships/weighted/:fromId/:toId/:type`

**Example:**
```
GET /api/relationships/weighted/app-001/db-001/DEPENDS_ON
```

**Response:**
```json
{
  "from": "app-001",
  "to": "db-001",
  "type": "DEPENDS_ON",
  "fromName": "Application 001",
  "toName": "Database 001",
  "properties": {
    "weight": 0.75,
    "criticalityScore": 0.8,
    "loadFactor": 60,
    "latencyMs": 25
  }
}
```

**Status Codes:**
- `200 OK` - Relationship found
- `404 Not Found` - Relationship not found
- `429 Too Many Requests` - Rate limit exceeded

---

### 3. Calculate Relationship Weight

Calculate relationship weight from component factors without creating the relationship.

**Endpoint:** `POST /api/relationships/calculate-weight`

**Request Body:**
```json
{
  "sourceCriticalityLevel": "CRITICAL",
  "targetCriticalityLevel": "HIGH",
  "businessImpact": 0.9,
  "redundancyLevel": 2,
  "historicalFailures": 3,
  "recoveryComplexity": 0.7,
  "requestsPerSecond": 500,
  "totalCapacity": 1000,
  "peakLoadHistory": 750,
  "loadBalancingWeight": 60,
  "latencyMs": 50
}
```

**Response:**
```json
{
  "weight": 0.78,
  "criticalityScore": 0.82,
  "criticality": "HIGH",
  "loadFactor": 58.5,
  "breakdown": {
    "sourceCriticality": "CRITICAL",
    "targetCriticality": "HIGH",
    "businessImpact": 0.9,
    "redundancyLevel": 2,
    "historicalFailures": 3,
    "recoveryComplexity": 0.7
  }
}
```

**Use Case:** Test weight calculations before creating relationships, or calculate weights for planning purposes.

---

### 4. Auto-Calculate Weights

Automatically calculate and update weights for all relationships of a given type based on CI properties.

**Endpoint:** `POST /api/relationships/auto-calculate-weights`

**Request Body:**
```json
{
  "relationshipType": "DEPENDS_ON"
}
```

**Response:**
```json
{
  "message": "Weights calculated successfully",
  "relationshipType": "DEPENDS_ON",
  "updatedCount": 1247,
  "timestamp": "2025-10-01T14:35:00.000Z"
}
```

**Use Case:** Bulk update weights after importing data or when CI criticality levels change.

---

### 5. Find Shortest Weighted Path

Find the shortest path between two CIs based on relationship weights.

**Endpoint:** `GET /api/relationships/shortest-path/:startId/:endId`

**Query Parameters:**
- `weightProperty` (optional) - Property to use as weight (default: `criticalityScore`)
- `maxDepth` (optional) - Maximum path length (default: 10)

**Example:**
```
GET /api/relationships/shortest-path/app-001/db-001?weightProperty=criticalityScore&maxDepth=6
```

**Response:**
```json
{
  "message": "Shortest weighted path found",
  "path": {
    "start": "app-001",
    "end": "db-001",
    "pathNodes": [
      {"id": "app-001", "name": "Application 001", "type": "Application"},
      {"id": "srv-010", "name": "Server 010", "type": "Server"},
      {"id": "db-001", "name": "Database 001", "type": "Database"}
    ],
    "pathRelationships": [
      {"type": "RUNS_ON", "weight": 0.8},
      {"type": "DEPENDS_ON", "weight": 0.9}
    ],
    "totalWeight": 1.7,
    "hops": 2,
    "weightProperty": "criticalityScore"
  }
}
```

**Status Codes:**
- `200 OK` - Path found
- `404 Not Found` - No path exists between CIs
- `429 Too Many Requests` - Rate limit exceeded

---

### 6. Find All Weighted Paths

Find all paths between two CIs, ranked by total weight.

**Endpoint:** `GET /api/relationships/all-paths/:startId/:endId`

**Query Parameters:**
- `maxDepth` (optional) - Maximum path length (default: 6)
- `limit` (optional) - Maximum paths to return (default: 10)
- `weightProperty` (optional) - Property to use as weight (default: `criticalityScore`)

**Example:**
```
GET /api/relationships/all-paths/app-001/db-001?maxDepth=6&limit=5
```

**Response:**
```json
{
  "message": "Found 3 paths",
  "totalPaths": 3,
  "paths": [
    {
      "start": "app-001",
      "end": "db-001",
      "pathNodes": [...],
      "pathRelationships": [...],
      "totalWeight": 1.8,
      "averageLoad": 62.5,
      "hops": 2
    },
    {
      "totalWeight": 1.5,
      "averageLoad": 45.0,
      "hops": 3
    },
    {
      "totalWeight": 1.2,
      "averageLoad": 38.0,
      "hops": 4
    }
  ]
}
```

**Use Case:** Analyze multiple dependency paths for redundancy planning or failover scenarios.

---

### 7. Get Criticality Rankings

Calculate criticality rankings for all CIs based on weighted relationships.

**Endpoint:** `GET /api/relationships/criticality-rankings`

**Query Parameters:**
- `limit` (optional) - Maximum results to return (default: 20)
- `weightProperty` (optional) - Property to use as weight (default: `criticalityScore`)

**Example:**
```
GET /api/relationships/criticality-rankings?limit=10
```

**Response:**
```json
{
  "message": "Top 10 critical components",
  "totalComponents": 10,
  "rankings": [
    {
      "id": "db-postgres-prod",
      "name": "PostgreSQL Production Database",
      "type": "Database",
      "ciCriticality": "CRITICAL",
      "criticalityRank": 8.75,
      "inboundDependencies": 25,
      "outboundDependencies": 3,
      "avgInboundWeight": 0.85,
      "avgOutboundWeight": 0.6
    },
    {
      "id": "gw-api-main",
      "name": "Main API Gateway",
      "type": "APIGateway",
      "criticalityRank": 7.92,
      "inboundDependencies": 18,
      "outboundDependencies": 12,
      "avgInboundWeight": 0.75,
      "avgOutboundWeight": 0.7
    }
  ]
}
```

**Use Case:** Identify the most critical components in your infrastructure for prioritized monitoring and maintenance.

---

### 8. Batch Create Weighted Relationships

Create multiple weighted relationships in a single request.

**Endpoint:** `POST /api/relationships/weighted/batch`

**Request Body:**
```json
{
  "relationships": [
    {
      "from": "app-001",
      "to": "db-001",
      "type": "DEPENDS_ON",
      "properties": {"weight": 0.8, "criticality": "HIGH"}
    },
    {
      "from": "app-001",
      "to": "srv-010",
      "type": "RUNS_ON",
      "properties": {"weight": 0.9, "criticality": "CRITICAL"}
    }
  ]
}
```

**Response:**
```json
{
  "message": "Processed 2 relationships",
  "successful": 2,
  "failed": 0,
  "results": [
    {...relationship details...},
    {...relationship details...}
  ]
}
```

**Limits:**
- Maximum 100 relationships per batch request
- Individual relationship failures don't fail the entire batch

**Status Codes:**
- `201 Created` - All relationships created successfully
- `207 Multi-Status` - Some relationships failed (check `errors` array)
- `400 Bad Request` - Invalid request format or batch too large

---

### 9. Get Weight Calculation Info

Get information about weight calculation methods and formulas.

**Endpoint:** `GET /api/relationships/weight-info`

**Response:**
```json
{
  "weightCalculation": {
    "description": "Relationship weight is calculated from multiple factors",
    "formula": "weight = (criticalityScore * 0.4) + (normalizedLoad * 0.3) + (latencyFactor * 0.2) + (redundancyFactor * 0.1)",
    "factors": {
      "criticalityScore": {
        "range": "0.0 - 1.0",
        "description": "Calculated from CI criticality, business impact, redundancy, reliability, and recovery complexity",
        "weights": {
          "ciCriticality": "30%",
          "businessImpact": "25%",
          "redundancy": "15% (inverse)",
          "reliability": "20% (based on historical failures)",
          "recovery": "10%"
        }
      },
      "loadFactor": {
        "range": "0 - 100",
        "description": "Percentage of traffic/load flowing through this relationship",
        "formula": "utilization * 0.5 + historicalPeak * 0.3 + manualWeight * 0.2"
      }
    }
  },
  "criticalityLevels": {
    "CRITICAL": 1.0,
    "HIGH": 0.75,
    "MEDIUM": 0.5,
    "LOW": 0.25,
    "INFO": 0.1
  },
  "supportedRelationshipTypes": [
    "DEPENDS_ON", "RUNS_ON", "SUPPORTS", "USES", "HOSTED_IN", "CONNECTS_TO"
  ]
}
```

---

### 10. Get Relationship Statistics

Get statistics about weighted relationships in the database.

**Endpoint:** `GET /api/relationships/stats`

**Response:**
```json
{
  "totalRelationships": 5247,
  "weightedRelationships": 3821,
  "unweightedRelationships": 1426,
  "coveragePercentage": "72.83",
  "averages": {
    "criticalityScore": 0.63,
    "loadFactor": 52.7,
    "latencyMs": 38.2
  }
}
```

**Use Case:** Monitor adoption of weighted relationships and identify gaps in weight coverage.

---

## Weight Calculation Formulas

### Criticality Score

```
criticalityScore = (
  avgCICriticality * 0.30 +
  businessImpact * 0.25 +
  (1 / redundancyLevel) * 0.15 +
  (historicalFailures / 100) * 0.20 +
  recoveryComplexity * 0.10
)
```

**Factors:**
- **CI Criticality (30%)**: Average of source and target CI criticality levels
- **Business Impact (25%)**: Revenue/business impact if relationship fails (0.0-1.0)
- **Redundancy (15%)**: Inverse of alternative path count (more redundancy = lower criticality)
- **Reliability (20%)**: Historical failure rate (0-100 failures normalized to 0.0-1.0)
- **Recovery (10%)**: Complexity of recovery (0.0=easy, 1.0=very hard)

### Load Factor

```
loadFactor = (
  currentUtilization * 0.50 +
  historicalPeakUtilization * 0.30 +
  manualLoadBalancingWeight * 0.20
)
```

Clamped to 0-100 range.

### Overall Relationship Weight

```
weight = (
  criticalityScore * 0.40 +
  (loadFactor / 100) * 0.30 +
  (1 - latencyMs / maxLatency) * 0.20 +
  (1 / redundancyLevel) * 0.10
)
```

Clamped to 0.0-1.0 range.

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message describing what went wrong"
}
```

Common error scenarios:

| Status Code | Scenario | Solution |
|-------------|----------|----------|
| 400 | Missing required fields | Check request body matches schema |
| 400 | Invalid relationship type | Use one of the supported types |
| 400 | Batch size too large | Reduce batch to ≤100 relationships |
| 404 | CI not found | Verify CI IDs exist in database |
| 404 | No path exists | CIs may not be connected in graph |
| 429 | Rate limit exceeded | Wait for rate limit window to reset |
| 500 | Database error | Check server logs, retry request |

---

## Example Usage Scenarios

### Scenario 1: Create Critical Database Dependency

```bash
curl -X POST http://localhost:3000/api/relationships/weighted \
  -H "Content-Type: application/json" \
  -d '{
    "from": "app-payment-processor",
    "to": "db-transactions-primary",
    "type": "DEPENDS_ON",
    "properties": {
      "criticality": "CRITICAL",
      "criticalityScore": 0.95,
      "loadFactor": 85,
      "redundancyLevel": 1,
      "latencyMs": 10,
      "source": "manual"
    }
  }'
```

### Scenario 2: Find Most Critical Path for Impact Analysis

```bash
curl "http://localhost:3000/api/relationships/shortest-path/app-001/db-prod-001?weightProperty=criticalityScore"
```

### Scenario 3: Auto-Calculate Weights After Data Import

```bash
curl -X POST http://localhost:3000/api/relationships/auto-calculate-weights \
  -H "Content-Type: application/json" \
  -d '{"relationshipType": "DEPENDS_ON"}'
```

### Scenario 4: Get Top 20 Critical Components

```bash
curl "http://localhost:3000/api/relationships/criticality-rankings?limit=20"
```

---

## Integration with CMDB

Weighted relationships integrate seamlessly with existing CMDB functionality:

1. **Topology Visualization** - Weighted edges can be rendered with different thicknesses or colors
2. **Impact Analysis** - Use weighted paths for more accurate impact calculations
3. **Event Correlation** - Weight events based on relationship criticality
4. **Capacity Planning** - Use load factors for resource allocation decisions
5. **Failover Planning** - Identify backup paths using weighted pathfinding

---

## Future Enhancements (Planned)

- ✨ **Temporal Relationships** - Track weight changes over time
- ✨ **Conditional Dependencies** - Activate relationships based on system state
- ✨ **ML-Based Weight Prediction** - Automatically predict weights from operational data
- ✨ **Graph Analytics** - PageRank, Louvain clustering for weighted graphs
- ✨ **Real-time Weight Updates** - Subscribe to weight changes via WebSocket

---

## Support

For issues or questions about the Weighted Relationships API:
- Check the [main CMDB documentation](../CLAUDE.md)
- Review [test examples](../../tests/unit/weightedRelationships.test.js)
- See [implementation details](FEATURE_enhancedrelmodeling.md)

---

**Document Version:** 1.0
**Last Updated:** 2025-10-01
**Status:** Production Ready
