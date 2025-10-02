const { runWriteQuery } = require('./neo4j');

/**
 * APOC-based Performance Utilities
 * Provides ultra-fast bulk operations using APOC procedures
 *
 * APOC (Awesome Procedures on Cypher) enables:
 * - Parallel batch processing
 * - Progress tracking
 * - Memory-efficient streaming
 * - 50-100x performance improvement over sequential operations
 */

/**
 * Check if APOC is available in the database
 */
async function checkAPOCAvailability() {
    try {
        const result = await runWriteQuery(`
            CALL dbms.procedures()
            YIELD name
            WHERE name STARTS WITH 'apoc'
            RETURN count(name) as apocProcedures
        `);

        const count = result[0]?.apocProcedures?.toNumber?.() || result[0]?.apocProcedures || 0;
        const isAvailable = count > 0;

        console.log(isAvailable
            ? `✅ APOC available (${count} procedures)`
            : '⚠️  APOC not available - falling back to standard operations'
        );

        return isAvailable;
    } catch (error) {
        console.warn('Could not check APOC availability:', error.message);
        return false;
    }
}

/**
 * Create nodes in ultra-fast batches using APOC periodic iterate
 *
 * @param {Array} nodes - Array of node objects to create
 * @param {number} batchSize - Number of nodes per batch (default: 10000)
 * @param {boolean} parallel - Enable parallel processing (default: true for nodes)
 * @returns {Object} Stats about the operation
 */
async function createNodesBulkAPOC(nodes, batchSize = 10000, parallel = true) {
    if (nodes.length === 0) {
        return { nodesCreated: 0, batches: 0, timeTaken: 0 };
    }

    const startTime = Date.now();
    console.log(`📦 Creating ${nodes.length.toLocaleString()} nodes using APOC (batch size: ${batchSize})...`);

    try {
        const result = await runWriteQuery(`
            CALL apoc.periodic.iterate(
                "UNWIND $nodes AS nodeData RETURN nodeData",
                "CREATE (n:ConfigurationItem) SET n = nodeData",
                {
                    batchSize: $batchSize,
                    parallel: $parallel,
                    params: {nodes: $nodes}
                }
            )
            YIELD batches, total, errorMessages
            RETURN batches, total, errorMessages
        `, { nodes, batchSize, parallel });

        const timeTaken = Date.now() - startTime;
        const stats = {
            nodesCreated: result[0]?.total?.toNumber?.() || result[0]?.total || nodes.length,
            batches: result[0]?.batches?.toNumber?.() || result[0]?.batches || 0,
            timeTaken,
            errors: result[0]?.errorMessages || []
        };

        console.log(`   ✅ Created ${stats.nodesCreated.toLocaleString()} nodes in ${timeTaken}ms (${Math.round(stats.nodesCreated / (timeTaken / 1000))} nodes/sec)`);

        if (stats.errors.length > 0) {
            console.warn('   ⚠️  Errors during creation:', stats.errors);
        }

        return stats;
    } catch (error) {
        console.error('❌ APOC bulk node creation failed:', error.message);
        throw error;
    }
}

/**
 * Create relationships in batches using APOC periodic iterate
 *
 * @param {Array} relationships - Array of {fromId, toId} objects
 * @param {string} relationshipType - Type of relationship to create
 * @param {number} batchSize - Number of relationships per batch (default: 5000)
 * @param {boolean} parallel - Enable parallel processing (default: false for relationships)
 * @returns {Object} Stats about the operation
 */
async function createRelationshipsBulkAPOC(relationships, relationshipType, batchSize = 5000, parallel = false) {
    if (relationships.length === 0) {
        return { relationshipsCreated: 0, batches: 0, timeTaken: 0 };
    }

    const startTime = Date.now();
    console.log(`🔗 Creating ${relationships.length.toLocaleString()} ${relationshipType} relationships using APOC...`);

    try {
        const result = await runWriteQuery(`
            CALL apoc.periodic.iterate(
                "UNWIND $rels AS rel RETURN rel",
                "MATCH (from:ConfigurationItem {id: rel.fromId})
                 MATCH (to:ConfigurationItem {id: rel.toId})
                 MERGE (from)-[r:${relationshipType}]->(to)",
                {
                    batchSize: $batchSize,
                    parallel: $parallel,
                    params: {rels: $relationships}
                }
            )
            YIELD batches, total, errorMessages
            RETURN batches, total, errorMessages
        `, { relationships, batchSize, parallel });

        const timeTaken = Date.now() - startTime;
        const stats = {
            relationshipsCreated: result[0]?.total?.toNumber?.() || result[0]?.total || relationships.length,
            batches: result[0]?.batches?.toNumber?.() || result[0]?.batches || 0,
            timeTaken,
            errors: result[0]?.errorMessages || []
        };

        console.log(`   ✅ Created ${stats.relationshipsCreated.toLocaleString()} relationships in ${timeTaken}ms (${Math.round(stats.relationshipsCreated / (timeTaken / 1000))} rels/sec)`);

        if (stats.errors.length > 0) {
            console.warn('   ⚠️  Errors during creation:', stats.errors);
        }

        return stats;
    } catch (error) {
        console.error('❌ APOC bulk relationship creation failed:', error.message);
        throw error;
    }
}

/**
 * Fallback: Create nodes in batches without APOC
 * Used when APOC is not available
 */
async function createNodesBulkFallback(nodes, batchSize = 1000) {
    if (nodes.length === 0) {
        return { nodesCreated: 0, batches: 0, timeTaken: 0 };
    }

    const startTime = Date.now();
    console.log(`📦 Creating ${nodes.length.toLocaleString()} nodes using UNWIND fallback (batch size: ${batchSize})...`);

    let totalCreated = 0;
    let batchCount = 0;

    for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);

        await runWriteQuery(`
            UNWIND $nodes AS nodeData
            CREATE (n:ConfigurationItem)
            SET n = nodeData
        `, { nodes: batch });

        totalCreated += batch.length;
        batchCount++;

        if (batchCount % 10 === 0) {
            console.log(`   ... created ${totalCreated.toLocaleString()}/${nodes.length.toLocaleString()} nodes`);
        }
    }

    const timeTaken = Date.now() - startTime;
    console.log(`   ✅ Created ${totalCreated.toLocaleString()} nodes in ${timeTaken}ms (${Math.round(totalCreated / (timeTaken / 1000))} nodes/sec)`);

    return {
        nodesCreated: totalCreated,
        batches: batchCount,
        timeTaken
    };
}

/**
 * Fallback: Create relationships in batches without APOC
 */
async function createRelationshipsBulkFallback(relationships, relationshipType, batchSize = 1000) {
    if (relationships.length === 0) {
        return { relationshipsCreated: 0, batches: 0, timeTaken: 0 };
    }

    const startTime = Date.now();
    console.log(`🔗 Creating ${relationships.length.toLocaleString()} ${relationshipType} relationships using UNWIND fallback...`);

    let totalCreated = 0;
    let batchCount = 0;

    for (let i = 0; i < relationships.length; i += batchSize) {
        const batch = relationships.slice(i, i + batchSize);

        await runWriteQuery(`
            UNWIND $rels AS rel
            MATCH (from:ConfigurationItem {id: rel.fromId})
            MATCH (to:ConfigurationItem {id: rel.toId})
            MERGE (from)-[r:${relationshipType}]->(to)
        `, { rels: batch });

        totalCreated += batch.length;
        batchCount++;

        if (batchCount % 10 === 0) {
            console.log(`   ... created ${totalCreated.toLocaleString()}/${relationships.length.toLocaleString()} relationships`);
        }
    }

    const timeTaken = Date.now() - startTime;
    console.log(`   ✅ Created ${totalCreated.toLocaleString()} relationships in ${timeTaken}ms (${Math.round(totalCreated / (timeTaken / 1000))} rels/sec)`);

    return {
        relationshipsCreated: totalCreated,
        batches: batchCount,
        timeTaken
    };
}

/**
 * Smart bulk creation - uses APOC if available, falls back to UNWIND otherwise
 */
async function createNodesBulk(nodes, batchSize = 10000) {
    const hasAPOC = await checkAPOCAvailability();

    if (hasAPOC) {
        return await createNodesBulkAPOC(nodes, batchSize, true);
    } else {
        return await createNodesBulkFallback(nodes, Math.min(batchSize, 1000));
    }
}

/**
 * Smart bulk relationship creation
 */
async function createRelationshipsBulk(relationships, relationshipType, batchSize = 5000) {
    const hasAPOC = await checkAPOCAvailability();

    if (hasAPOC) {
        return await createRelationshipsBulkAPOC(relationships, relationshipType, batchSize, false);
    } else {
        return await createRelationshipsBulkFallback(relationships, relationshipType, Math.min(batchSize, 1000));
    }
}

module.exports = {
    checkAPOCAvailability,
    createNodesBulk,
    createRelationshipsBulk,
    createNodesBulkAPOC,
    createRelationshipsBulkAPOC,
    createNodesBulkFallback,
    createRelationshipsBulkFallback
};
