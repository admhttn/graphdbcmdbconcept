# API Examples and Testing Guide

This document provides comprehensive examples for testing and using the CMDB API endpoints.

## Prerequisites

Before testing, ensure the application is running:
```bash
# Using demo mode (no database required)
npm run demo

# Or using full stack with Neo4j
docker-compose up -d
npm run dev
```

## CMDB API Examples

### Database Statistics

Get comprehensive database metrics:

```bash
curl -X GET http://localhost:3000/api/cmdb/database/stats | jq
```

Example response:
```json
{
  "nodes": {
    "total": 1250,
    "configItems": 800,
    "events": 350,
    "services": 100
  },
  "relationships": {
    "total": 2400,
    "dependencies": 1200,
    "affects": 800,
    "contains": 400
  },
  "labels": ["ConfigurationItem", "Event", "Service", "Application"],
  "relationshipTypes": ["DEPENDS_ON", "AFFECTS", "CONTAINS", "RUNS_ON"]
}
```

### Configuration Items

#### List all CIs with filtering:
```bash
# Get all configuration items
curl -X GET http://localhost:3000/api/cmdb/items | jq

# Filter by type
curl -X GET "http://localhost:3000/api/cmdb/items?type=server&limit=10" | jq

# Filter by status
curl -X GET "http://localhost:3000/api/cmdb/items?status=operational" | jq
```

#### Create a new CI:
```bash
curl -X POST http://localhost:3000/api/cmdb/items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Web-Server-001",
    "type": "server",
    "status": "operational",
    "properties": {
      "environment": "production",
      "location": "datacenter-1",
      "ipAddress": "192.168.1.100",
      "os": "Ubuntu 20.04",
      "cpu": "4 cores",
      "memory": "16GB"
    }
  }' | jq
```

#### Get specific CI with relationships:
```bash
curl -X GET http://localhost:3000/api/cmdb/items/[CI_ID] | jq
```

#### Update a CI:
```bash
curl -X PUT http://localhost:3000/api/cmdb/items/[CI_ID] \
  -H "Content-Type: application/json" \
  -d '{
    "status": "maintenance",
    "properties": {
      "maintenanceWindow": "2024-01-15T02:00:00Z"
    }
  }' | jq
```

### Topology Data

#### Get full topology:
```bash
curl -X GET http://localhost:3000/api/cmdb/topology | jq
```

#### Get simplified topology (for performance):
```bash
curl -X GET http://localhost:3000/api/cmdb/topology/simple | jq
```

#### Filter topology by criteria:
```bash
curl -X POST http://localhost:3000/api/cmdb/topology/filter \
  -H "Content-Type: application/json" \
  -d '{
    "nodeTypes": ["server", "application"],
    "environment": "production",
    "maxDepth": 3
  }' | jq
```

## Events API Examples

### List Events

#### Get recent events:
```bash
curl -X GET http://localhost:3000/api/events | jq
```

#### Filter by severity:
```bash
curl -X GET "http://localhost:3000/api/events?severity=critical&limit=50" | jq
```

#### Filter by time range:
```bash
curl -X GET "http://localhost:3000/api/events?since=2024-01-01T00:00:00Z" | jq
```

### Create Events

#### Create a critical event:
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "High CPU Usage Alert",
    "description": "CPU utilization exceeded 90% threshold",
    "severity": "critical",
    "source": "monitoring-system",
    "affectedCI": "server-001-uuid",
    "metadata": {
      "cpuUsage": 95.2,
      "threshold": 90,
      "duration": "5 minutes"
    }
  }' | jq
```

### Event Statistics

```bash
curl -X GET http://localhost:3000/api/events/stats | jq
```

Example response:
```json
{
  "total": 1250,
  "bySeverity": {
    "critical": 45,
    "major": 120,
    "minor": 300,
    "warning": 485,
    "info": 300
  },
  "byTimeRange": {
    "last24Hours": 125,
    "lastWeek": 450,
    "lastMonth": 1250
  }
}
```

## Correlation API Examples

### Analyze Event Correlations

```bash
curl -X POST http://localhost:3000/api/correlation/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "eventIds": ["event-1-uuid", "event-2-uuid"],
    "timeWindow": "1h",
    "correlationTypes": ["temporal", "causal", "topological"]
  }' | jq
```

### Business Impact Analysis

```bash
curl -X GET http://localhost:3000/api/correlation/business-impact | jq
```

Example response:
```json
{
  "impactAnalysis": {
    "criticalServices": [
      {
        "serviceId": "payment-service",
        "impactLevel": "high",
        "affectedUsers": 10000,
        "revenueImpact": "$50000/hour"
      }
    ],
    "cascadeEffects": [
      {
        "sourceCI": "db-server-001",
        "affectedCIs": ["web-server-001", "web-server-002"],
        "impactChain": ["database", "application", "frontend"]
      }
    ]
  }
}
```

### Pattern Recognition

```bash
curl -X GET http://localhost:3000/api/correlation/patterns | jq
```

## Demo API Examples

### Generate Demo Data

#### Simple demo data:
```bash
curl -X POST http://localhost:3000/api/demo/generate/simple \
  -H "Content-Type: application/json" \
  -d '{
    "nodeCount": 100,
    "eventCount": 50
  }' | jq
```

#### Enterprise topology:
```bash
curl -X POST http://localhost:3000/api/demo/generate/enterprise \
  -H "Content-Type: application/json" \
  -d '{
    "size": "medium",
    "includeEvents": true,
    "complexity": "high"
  }' | jq
```

### Check Generation Status

```bash
curl -X GET http://localhost:3000/api/demo/status | jq
```

### Clear Demo Data

```bash
curl -X DELETE http://localhost:3000/api/demo/clear | jq
```

## Testing Workflows

### Basic Health Check

```bash
#!/bin/bash
# health-check.sh

echo "Checking application health..."
curl -f http://localhost:3000/health || exit 1

echo "Checking database connectivity..."
curl -f http://localhost:3000/api/cmdb/database/stats || exit 1

echo "All checks passed!"
```

### Load Testing with Sample Data

```bash
#!/bin/bash
# load-test.sh

echo "Generating large dataset..."
curl -X POST http://localhost:3000/api/demo/generate/enterprise \
  -H "Content-Type: application/json" \
  -d '{"size": "large", "includeEvents": true}'

echo "Testing topology endpoint performance..."
time curl -s http://localhost:3000/api/cmdb/topology/simple > /dev/null

echo "Testing event filtering performance..."
time curl -s "http://localhost:3000/api/events?limit=1000" > /dev/null
```

### Integration Test Example

```bash
#!/bin/bash
# integration-test.sh

set -e

echo "1. Creating test CI..."
CI_RESPONSE=$(curl -s -X POST http://localhost:3000/api/cmdb/items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test-Server",
    "type": "server",
    "status": "operational"
  }')

CI_ID=$(echo $CI_RESPONSE | jq -r '.id')
echo "Created CI with ID: $CI_ID"

echo "2. Creating related event..."
EVENT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test Event\",
    \"severity\": \"warning\",
    \"affectedCI\": \"$CI_ID\"
  }")

EVENT_ID=$(echo $EVENT_RESPONSE | jq -r '.id')
echo "Created event with ID: $EVENT_ID"

echo "3. Verifying relationship..."
curl -s http://localhost:3000/api/cmdb/items/$CI_ID | jq '.relationships'

echo "Integration test completed successfully!"
```

## JavaScript/Node.js Examples

### Using fetch() in Node.js

```javascript
// api-client.js
const fetch = require('node-fetch');

class CMDBClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async getStats() {
    const response = await fetch(`${this.baseUrl}/api/cmdb/database/stats`);
    return response.json();
  }

  async createCI(ciData) {
    const response = await fetch(`${this.baseUrl}/api/cmdb/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ciData)
    });
    return response.json();
  }

  async getTopology() {
    const response = await fetch(`${this.baseUrl}/api/cmdb/topology/simple`);
    return response.json();
  }
}

// Usage example
async function example() {
  const client = new CMDBClient();

  const stats = await client.getStats();
  console.log('Database stats:', stats);

  const ci = await client.createCI({
    name: 'API-Test-Server',
    type: 'server',
    status: 'operational'
  });
  console.log('Created CI:', ci);
}
```

## Postman Collection

Import this collection into Postman for easy API testing:

```json
{
  "info": {
    "name": "CMDB API Collection",
    "description": "Complete API collection for the CMDB application"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    }
  ],
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/health"
      }
    },
    {
      "name": "Database Stats",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/cmdb/database/stats"
      }
    },
    {
      "name": "Create CI",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/cmdb/items",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"name\": \"Test-Server-{{$randomInt}}\",\n  \"type\": \"server\",\n  \"status\": \"operational\",\n  \"properties\": {\n    \"environment\": \"test\",\n    \"location\": \"datacenter-1\"\n  }\n}"
        }
      }
    }
  ]
}
```

## Common Issues and Solutions

### Connection Refused
```bash
# Check if application is running
curl -v http://localhost:3000/health

# If using Docker, check container status
docker-compose ps
```

### Database Connection Issues
```bash
# Check Neo4j connectivity
curl http://localhost:7474

# Check Redis connectivity (if using queue features)
redis-cli ping
```

### Performance Issues
```bash
# Use simplified endpoints for large datasets
curl http://localhost:3000/api/cmdb/topology/simple

# Add pagination for large result sets
curl "http://localhost:3000/api/events?limit=100&offset=0"
```