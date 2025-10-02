# Topology Query Fix - Complete Graph Traversal for CI Detail Modal

## Problem Description

### Current Behavior
The CI Detail Modal's topology diagram (`/api/cmdb/topology?startNode=X&depth=N`) only displays a **subset** of relationships when a Configuration Item has multiple parallel relationships of the same type.

**Example Issue:**
- Application `app-18878` has TWO `RUNS_ON` relationships pointing to different servers:
  - `srv-dc-region-003-00-0103` (App Server 104)
  - `srv-dc-region-000-01-0923` (Compute Server 924)
- The `/api/cmdb/items/app-18878` endpoint correctly returns BOTH relationships
- The `/api/cmdb/topology?startNode=app-18878&depth=2` endpoint only returns ONE server

### Expected Behavior
The topology visualization should display the **complete graph** of all nodes and relationships within the specified depth, including:
- All nodes reachable within N hops (both incoming and outgoing)
- All relationships between those nodes
- Proper handling of multiple parallel relationships of the same type

## Root Cause Analysis

### Issue Location
File: `src/api/cmdb.js`, lines 390-419

### Current Query Implementation
```javascript
cypher = `
  MATCH (start:ConfigurationItem {id: $startNode})
  CALL apoc.path.subgraphNodes(start, {
    maxLevel: ${depthParam},
    relationshipFilter: null,
    labelFilter: 'ConfigurationItem'
  }) YIELD node
  WITH collect(DISTINCT node) as allNodes

  UNWIND allNodes as n1
  MATCH (n1)-[r]-(n2)
  WHERE n2 IN allNodes

  RETURN [n IN allNodes | {...}] as nodes,
  collect(DISTINCT {...}) as relationships
`;
```

### Why It Fails
1. **APOC Uniqueness**: `apoc.path.subgraphNodes` uses `NODE_GLOBAL` uniqueness by default, which should work but may have issues with the current configuration
2. **Path Collection**: The query doesn't explicitly collect all paths - it only collects nodes
3. **Variable-Length Pattern Issues**: When multiple relationships of the same type exist between nodes at the same depth level, Neo4j's variable-length pattern matching may not explore all branches

### Comparison with Working Query
The `/items/:id` endpoint successfully retrieves all relationships using a simple pattern:

```cypher
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
```

**Key Difference**: This uses a single-hop pattern without variable length, ensuring ALL direct relationships are captured.

## Solution Implementations

### Solution 1: Iterative Depth Expansion (RECOMMENDED)

Build the graph iteratively level by level to ensure all nodes at each depth are discovered.

```cypher
MATCH (start:ConfigurationItem {id: $startNode})

// Level 0: Start node
WITH [start] as currentLevel, [start] as allNodes

// Level 1: All direct neighbors
OPTIONAL MATCH (n)-[r1]-(level1)
WHERE n IN currentLevel AND level1:ConfigurationItem
WITH allNodes + collect(DISTINCT level1) as allNodes,
     collect(DISTINCT level1) as level1Nodes
WHERE size(level1Nodes) > 0

// Level 2: Neighbors of level 1 (if depth >= 2)
OPTIONAL MATCH (n)-[r2]-(level2)
WHERE n IN level1Nodes AND level2:ConfigurationItem AND NOT level2 IN allNodes
WITH allNodes + collect(DISTINCT level2) as allNodes,
     collect(DISTINCT level2) as level2Nodes
WHERE size(level2Nodes) > 0 AND ${depthParam} >= 2

// Continue for levels 3, 4, 5...

// Final step: Get all relationships between collected nodes
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
```

**Advantages:**
- ✅ Guarantees all nodes at each level are discovered
- ✅ Handles multiple parallel relationships correctly
- ✅ Clear, predictable expansion logic

**Disadvantages:**
- ❌ Verbose query for high depth values (need to repeat for each level)
- ❌ Requires dynamic query construction based on depth parameter

### Solution 2: Recursive CTE Approach

Use a recursive approach to build the node set:

```cypher
MATCH (start:ConfigurationItem {id: $startNode})

// Build node collection recursively
CALL {
  WITH start

  // Get all nodes within depth using breadth-first traversal
  WITH [start] as currentNodes, [start] as allNodes, 0 as currentDepth, ${depthParam} as maxDepth

  CALL apoc.when(
    currentDepth < maxDepth,
    "
    MATCH (n)-[r]-(next:ConfigurationItem)
    WHERE n IN $currentNodes AND NOT next IN $allNodes
    RETURN collect(DISTINCT next) as nextLevel, $allNodes + collect(DISTINCT next) as newAllNodes
    ",
    "RETURN [] as nextLevel, $allNodes as newAllNodes",
    {currentNodes: currentNodes, allNodes: allNodes, maxDepth: maxDepth, currentDepth: currentDepth}
  ) YIELD value

  RETURN value.newAllNodes as allNodes
}

// Get relationships between discovered nodes
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
```

**Advantages:**
- ✅ Works for any depth value
- ✅ Uses APOC for conditional logic

**Disadvantages:**
- ❌ More complex to understand and maintain
- ❌ Requires APOC extended procedures

### Solution 3: Explicit Path Collection with Proper UNWIND

Collect ALL paths explicitly, then properly extract nodes and relationships:

```cypher
MATCH (start:ConfigurationItem {id: $startNode})

// Collect ALL paths (both directions) up to max depth
CALL {
  WITH start
  MATCH path = (start)-[*1..${depthParam}]->(out:ConfigurationItem)
  RETURN path
  UNION ALL
  WITH start
  MATCH path = (start)<-[*1..${depthParam}]-(in:ConfigurationItem)
  RETURN path
}

// Extract all unique nodes from paths
WITH collect(path) as allPaths
UNWIND allPaths as p
UNWIND nodes(p) as node
WITH collect(DISTINCT node) as allNodes, allPaths

// Extract all unique relationships from paths
UNWIND allPaths as p
UNWIND relationships(p) as rel
WITH allNodes, collect(DISTINCT rel) as allRels

RETURN [n IN allNodes | {
  id: n.id,
  name: n.name,
  type: n.type,
  status: coalesce(n.status, 'unknown')
}] as nodes,
[r IN allRels | {
  from: startNode(r).id,
  to: endNode(r).id,
  type: type(r)
}] as relationships
```

**Advantages:**
- ✅ Simple and straightforward
- ✅ Explicitly collects all paths
- ✅ Uses UNION ALL to combine outgoing and incoming traversals

**Disadvantages:**
- ❌ May be slower for large graphs (explores all paths)
- ❌ Memory intensive for high depth values

### Solution 4: APOC expandConfig with Proper Settings

Use APOC's more advanced expansion with proper uniqueness configuration:

```cypher
MATCH (start:ConfigurationItem {id: $startNode})

CALL apoc.path.expandConfig(start, {
  minLevel: 0,
  maxLevel: ${depthParam},
  uniqueness: 'NODE_GLOBAL',
  bfs: true,
  labelFilter: '+ConfigurationItem',
  relationshipFilter: null
}) YIELD path

// Extract nodes and relationships from all paths
WITH collect(DISTINCT path) as allPaths
UNWIND allPaths as p
UNWIND nodes(p) as node
WITH collect(DISTINCT node) as allNodes, allPaths

UNWIND allPaths as p
UNWIND relationships(p) as rel

RETURN [n IN allNodes | {
  id: n.id,
  name: n.name,
  type: n.type,
  status: coalesce(n.status, 'unknown')
}] as nodes,
collect(DISTINCT {
  from: startNode(rel).id,
  to: endNode(rel).id,
  type: type(rel)
}) as relationships
```

**Advantages:**
- ✅ Uses breadth-first search for consistent depth-based expansion
- ✅ Proper uniqueness settings
- ✅ Returns paths explicitly

**Disadvantages:**
- ❌ Requires APOC library
- ❌ May still have issues if APOC version is outdated

## Recommended Implementation

**Use Solution 3 (Explicit Path Collection with UNION ALL)** as the primary fix because:

1. ✅ **Simplicity**: Easy to understand and maintain
2. ✅ **Reliability**: Explicitly collects all paths in both directions
3. ✅ **No Dependencies**: Works with standard Cypher, doesn't rely on APOC behavior
4. ✅ **Proven Pattern**: Uses patterns similar to the working `/items/:id` endpoint

## Implementation Steps

### Step 1: Update the Query in src/api/cmdb.js

Replace lines 390-419 with Solution 3:

```javascript
if (startNode) {
  const depthParam = parseInt(depth);
  cypher = `
    MATCH (start:ConfigurationItem {id: $startNode})

    // Collect ALL paths (both directions) up to max depth
    CALL {
      WITH start
      MATCH path = (start)-[*1..${depthParam}]->(out:ConfigurationItem)
      RETURN path
      UNION ALL
      WITH start
      MATCH path = (start)<-[*1..${depthParam}]-(in:ConfigurationItem)
      RETURN path
    }

    // Extract all unique nodes from paths
    WITH collect(path) as allPaths
    UNWIND allPaths as p
    UNWIND nodes(p) as node
    WITH collect(DISTINCT node) as allNodes, allPaths

    // Extract all unique relationships from paths
    UNWIND allPaths as p
    UNWIND relationships(p) as rel
    WITH allNodes, collect(DISTINCT rel) as allRels

    RETURN [n IN allNodes | {
      id: n.id,
      name: n.name,
      type: n.type,
      status: coalesce(n.status, 'unknown')
    }] as nodes,
    [r IN allRels | {
      from: startNode(r).id,
      to: endNode(r).id,
      type: type(r)
    }] as relationships
  `;
  params = { startNode };
}
```

### Step 2: Add Safety Limits

To prevent performance issues with large graphs, add a node limit:

```javascript
if (startNode) {
  const depthParam = parseInt(depth);
  const maxNodes = 500; // Safety limit

  cypher = `
    MATCH (start:ConfigurationItem {id: $startNode})

    CALL {
      WITH start
      MATCH path = (start)-[*1..${depthParam}]->(out:ConfigurationItem)
      RETURN path
      UNION ALL
      WITH start
      MATCH path = (start)<-[*1..${depthParam}]-(in:ConfigurationItem)
      RETURN path
    }

    WITH collect(path) as allPaths
    UNWIND allPaths as p
    UNWIND nodes(p) as node
    WITH collect(DISTINCT node) as allNodes, allPaths

    // Apply node limit for safety
    WITH allNodes[0..${maxNodes}] as limitedNodes, allPaths

    UNWIND allPaths as p
    UNWIND relationships(p) as rel
    WHERE startNode(rel) IN limitedNodes AND endNode(rel) IN limitedNodes

    RETURN [n IN limitedNodes | {
      id: n.id,
      name: n.name,
      type: n.type,
      status: coalesce(n.status, 'unknown')
    }] as nodes,
    collect(DISTINCT {
      from: startNode(rel).id,
      to: endNode(rel).id,
      type: type(rel)
    }) as relationships
  `;
  params = { startNode };
}
```

### Step 3: Handle Edge Cases

Add handling for cases where no paths exist:

```javascript
cypher = `
  MATCH (start:ConfigurationItem {id: $startNode})

  OPTIONAL CALL {
    WITH start
    MATCH path = (start)-[*1..${depthParam}]->(out:ConfigurationItem)
    RETURN path
    UNION ALL
    WITH start
    MATCH path = (start)<-[*1..${depthParam}]-(in:ConfigurationItem)
    RETURN path
  }

  WITH start, collect(path) as allPaths

  // If no paths, return just the start node
  WITH CASE
    WHEN size(allPaths) = 0 THEN [start]
    ELSE (
      [p IN allPaths | nodes(p)]
      |> reduce(acc = [], nodeList IN _ | acc + nodeList)
      |> collect(DISTINCT _)
    )
  END as allNodes, allPaths

  // Get relationships if paths exist
  WITH allNodes,
       CASE
         WHEN size(allPaths) = 0 THEN []
         ELSE allPaths
       END as paths

  UNWIND CASE WHEN size(paths) > 0 THEN paths ELSE [null] END as p
  WITH allNodes,
       CASE WHEN p IS NOT NULL
         THEN relationships(p)
         ELSE []
       END as rels
  UNWIND CASE WHEN size(rels) > 0 THEN rels ELSE [null] END as rel

  WITH allNodes, collect(DISTINCT rel) as allRels

  RETURN [n IN allNodes | {
    id: n.id,
    name: n.name,
    type: n.type,
    status: coalesce(n.status, 'unknown')
  }] as nodes,
  [r IN allRels WHERE r IS NOT NULL | {
    from: startNode(r).id,
    to: endNode(r).id,
    type: type(r)
  }] as relationships
`;
```

## Testing Strategy

### Test Case 1: Multiple Parallel Relationships
```
Given: Application with 2+ RUNS_ON relationships to different servers
When: Query /api/cmdb/topology?startNode=app-XXX&depth=1
Then: Response should include ALL servers the app runs on
```

### Test Case 2: Multi-Hop Traversal
```
Given: App -> Server -> Datacenter -> Region (3 hops)
When: Query /api/cmdb/topology?startNode=app-XXX&depth=3
Then: Response should include app, all servers, datacenter(s), and region(s)
```

### Test Case 3: Bidirectional Traversal
```
Given: Database <- App -> Server
When: Query /api/cmdb/topology?startNode=app-XXX&depth=1
Then: Response should include both database AND server
```

### Test Case 4: Relationship Count Validation
```
Given: Any CI with known relationship count from /items/:id/relationships
When: Query topology for that CI
Then: Topology response should have same relationship count
```

### Test Case 5: Performance Test
```
Given: CI in a large graph (1000+ connected nodes)
When: Query /api/cmdb/topology?startNode=XXX&depth=2
Then: Response time should be < 2 seconds
And: Should respect node limit (500 max)
```

## Performance Considerations

### Query Optimization
1. **Limit Depth**: Keep maximum depth at 5 or less
2. **Node Limit**: Cap results at 500 nodes to prevent browser overwhelm
3. **Indexing**: Ensure `id` property has index: `CREATE INDEX FOR (ci:ConfigurationItem) ON (ci.id)`
4. **Monitoring**: Log query execution time to identify slow queries

### Memory Management
```javascript
// Add query timeout
const result = await runReadQuery(cypher, params, {
  timeout: 30000 // 30 second timeout
});
```

### Caching Strategy
Consider implementing caching for frequently accessed topology:

```javascript
const cacheKey = `topology:${startNode}:${depth}`;
const cached = await redis.get(cacheKey);
if (cached) {
  return JSON.parse(cached);
}

// ... run query ...

await redis.setex(cacheKey, 300, JSON.stringify(result)); // 5 min cache
```

## Rollback Strategy

If the new query causes issues:

1. **Immediate Rollback**: Restore original query from git history
2. **Fallback Query**: Keep old APOC version as fallback:

```javascript
const USE_NEW_TOPOLOGY_QUERY = process.env.USE_NEW_TOPOLOGY_QUERY === 'true';

if (USE_NEW_TOPOLOGY_QUERY) {
  // New implementation
} else {
  // Old APOC implementation
}
```

3. **Feature Flag**: Implement gradual rollout:

```javascript
const topologyQueryVersion = req.query.version || 'v1';
if (topologyQueryVersion === 'v2') {
  // New query
} else {
  // Old query
}
```

## Validation Checklist

Before considering this fix complete:

- [ ] Query returns ALL nodes within specified depth
- [ ] Query returns ALL relationships between discovered nodes
- [ ] Multiple parallel relationships of same type are captured
- [ ] Bidirectional traversal works (incoming + outgoing)
- [ ] Performance is acceptable (< 2s for depth=2, 1000 nodes)
- [ ] D3.js visualization renders all nodes correctly
- [ ] No regression in existing functionality
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing with real data confirms fix

## Related Files

- **Query Implementation**: `src/api/cmdb.js:380-460`
- **Frontend Visualization**: `public/js/ci-detail-modal.js:283-455`
- **Working Reference**: `src/api/cmdb.js:210-239` (`/items/:id` endpoint)

## Additional Resources

- [Neo4j Variable-Length Patterns](https://neo4j.com/docs/cypher-manual/current/patterns/variable-length-patterns/)
- [APOC Path Expansion](https://neo4j.com/docs/apoc/current/overview/apoc.path/)
- [Cypher Query Tuning](https://neo4j.com/docs/cypher-manual/current/query-tuning/)

---

**Last Updated**: 2025-01-30
**Status**: Ready for Implementation
**Priority**: High
**Complexity**: Medium
