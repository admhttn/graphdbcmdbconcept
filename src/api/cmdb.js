const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { runReadQuery, runWriteQuery, initializeDatabase } = require('../services/neo4j');

const router = express.Router();

// Initialize database on first load
let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await initializeDatabase();
    initialized = true;
  }
}

// Get all Configuration Items
router.get('/items', async (req, res) => {
  try {
    await ensureInitialized();

    const { type, limit = 50 } = req.query;
    let cypher = 'MATCH (ci:ConfigurationItem)';
    let params = { limit: Math.floor(parseInt(limit, 10)) || 50 };

    if (type) {
      cypher += ' WHERE ci.type = $type';
      params.type = type;
    }

    cypher += ' RETURN ci ORDER BY ci.name LIMIT $limit';

    const items = await runReadQuery(cypher, params);
    res.json(items.map(item => item.ci.properties));
  } catch (error) {
    console.error('Error fetching CIs:', error);
    res.status(500).json({ error: 'Failed to fetch configuration items' });
  }
});

// Get specific Configuration Item with relationships
router.get('/items/:id', async (req, res) => {
  try {
    await ensureInitialized();

    const { id } = req.params;

    const cypher = `
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
    `;

    const result = await runReadQuery(cypher, { id });

    if (result.length === 0) {
      return res.status(404).json({ error: 'Configuration item not found' });
    }

    const item = result[0];
    res.json({
      ...item.ci.properties,
      relationships: item.relationships.filter(rel => rel.relatedItem !== null)
    });
  } catch (error) {
    console.error('Error fetching CI details:', error);
    res.status(500).json({ error: 'Failed to fetch configuration item details' });
  }
});

// Create new Configuration Item
router.post('/items', async (req, res) => {
  try {
    await ensureInitialized();

    const { name, type, properties = {} } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const ciData = {
      id,
      name,
      type,
      createdAt: now,
      updatedAt: now,
      ...properties
    };

    const cypher = `
      CREATE (ci:ConfigurationItem $ciData)
      RETURN ci
    `;

    const result = await runWriteQuery(cypher, { ciData });
    res.status(201).json(result[0].ci.properties);
  } catch (error) {
    console.error('Error creating CI:', error);
    res.status(500).json({ error: 'Failed to create configuration item' });
  }
});

// Update Configuration Item
router.put('/items/:id', async (req, res) => {
  try {
    await ensureInitialized();

    const { id } = req.params;
    const updates = { ...req.body };
    delete updates.id; // Don't allow ID updates
    updates.updatedAt = new Date().toISOString();

    const setClause = Object.keys(updates)
      .map(key => `ci.${key} = $updates.${key}`)
      .join(', ');

    const cypher = `
      MATCH (ci:ConfigurationItem {id: $id})
      SET ${setClause}
      RETURN ci
    `;

    const result = await runWriteQuery(cypher, { id, updates });

    if (result.length === 0) {
      return res.status(404).json({ error: 'Configuration item not found' });
    }

    res.json(result[0].ci.properties);
  } catch (error) {
    console.error('Error updating CI:', error);
    res.status(500).json({ error: 'Failed to update configuration item' });
  }
});

// Delete Configuration Item
router.delete('/items/:id', async (req, res) => {
  try {
    await ensureInitialized();

    const { id } = req.params;

    const cypher = `
      MATCH (ci:ConfigurationItem {id: $id})
      DETACH DELETE ci
      RETURN count(ci) as deleted
    `;

    const result = await runWriteQuery(cypher, { id });

    if (result[0].deleted === 0) {
      return res.status(404).json({ error: 'Configuration item not found' });
    }

    res.json({ message: 'Configuration item deleted successfully' });
  } catch (error) {
    console.error('Error deleting CI:', error);
    res.status(500).json({ error: 'Failed to delete configuration item' });
  }
});

// Create relationship between Configuration Items
router.post('/relationships', async (req, res) => {
  try {
    await ensureInitialized();

    const { fromId, toId, relationshipType, properties = {} } = req.body;

    if (!fromId || !toId || !relationshipType) {
      return res.status(400).json({
        error: 'fromId, toId, and relationshipType are required'
      });
    }

    const cypher = `
      MATCH (from:ConfigurationItem {id: $fromId})
      MATCH (to:ConfigurationItem {id: $toId})
      CREATE (from)-[r:${relationshipType} $properties]->(to)
      RETURN from.name as fromName, to.name as toName, type(r) as relationship
    `;

    const result = await runWriteQuery(cypher, { fromId, toId, properties });

    if (result.length === 0) {
      return res.status(404).json({ error: 'One or both configuration items not found' });
    }

    res.status(201).json({
      message: 'Relationship created successfully',
      relationship: result[0]
    });
  } catch (error) {
    console.error('Error creating relationship:', error);
    res.status(500).json({ error: 'Failed to create relationship' });
  }
});

// Get topology/dependency graph
router.get('/topology', async (req, res) => {
  try {
    await ensureInitialized();

    const { depth = 3, startNode } = req.query;

    let cypher, params;

    if (startNode) {
      cypher = `
        MATCH path = (start:ConfigurationItem {id: $startNode})-[*1..${depth}]-(connected)
        WITH nodes(path) as nodeList, relationships(path) as relList
        UNWIND nodeList as node
        WITH collect(DISTINCT {
          id: node.id,
          name: node.name,
          type: node.type,
          status: coalesce(node.status, 'unknown')
        }) as nodes, relList
        UNWIND relList as rel
        RETURN nodes,
               collect(DISTINCT {
                 from: startNode(rel).id,
                 to: endNode(rel).id,
                 type: type(rel)
               }) as relationships
      `;
      params = { startNode, depth: parseInt(depth) };
    } else {
      cypher = `
        MATCH (ci:ConfigurationItem)
        OPTIONAL MATCH (ci)-[r]-(connected:ConfigurationItem)
        WITH collect(DISTINCT {
          id: ci.id,
          name: ci.name,
          type: ci.type,
          status: coalesce(ci.status, 'unknown')
        }) as nodes,
        collect(DISTINCT {
          from: startNode(r).id,
          to: endNode(r).id,
          type: type(r)
        }) as relationships
        RETURN nodes, relationships
      `;
      params = {};
    }

    const result = await runReadQuery(cypher, params);

    if (result.length === 0) {
      return res.json({ nodes: [], relationships: [] });
    }

    res.json({
      nodes: result[0].nodes || [],
      relationships: (result[0].relationships || []).filter(rel => rel.from && rel.to)
    });
  } catch (error) {
    console.error('Error fetching topology:', error);
    res.status(500).json({ error: 'Failed to fetch topology data' });
  }
});

// Get impact analysis for a CI
router.get('/impact/:id', async (req, res) => {
  try {
    await ensureInitialized();

    const { id } = req.params;
    const { direction = 'both', depth = 3 } = req.query;

    let relationshipPattern;
    switch (direction) {
      case 'upstream':
        relationshipPattern = '<-[*1..' + depth + ']-';
        break;
      case 'downstream':
        relationshipPattern = '-[*1..' + depth + ']->';
        break;
      default:
        relationshipPattern = '-[*1..' + depth + ']-';
    }

    const cypher = `
      MATCH (source:ConfigurationItem {id: $id})
      MATCH (source)${relationshipPattern}(impacted:ConfigurationItem)
      RETURN DISTINCT impacted.id as id,
                      impacted.name as name,
                      impacted.type as type,
                      impacted.criticality as criticality,
                      shortestPath((source)-[*]-(impacted)) as path
      ORDER BY length(path), impacted.criticality DESC
    `;

    const result = await runReadQuery(cypher, { id });
    res.json(result.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      criticality: item.criticality || 'medium',
      distance: item.path ? item.path.length : 0
    })));
  } catch (error) {
    console.error('Error performing impact analysis:', error);
    res.status(500).json({ error: 'Failed to perform impact analysis' });
  }
});

module.exports = router;