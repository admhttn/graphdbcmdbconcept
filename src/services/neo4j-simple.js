const neo4j = require('neo4j-driver');

let driver;

async function connectToNeo4j() {
  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'CHANGE_ME_INSECURE_DEFAULT';

  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

    // Verify connectivity
    await driver.verifyConnectivity();
    console.log('Neo4j connection verified');

    return driver;
  } catch (error) {
    console.error('Failed to connect to Neo4j:', error);
    throw error;
  }
}

async function closeConnection() {
  try {
    if (driver) {
      await driver.close();
    }
    console.log('Neo4j connection closed');
  } catch (error) {
    console.error('Error closing Neo4j connection:', error);
  }
}

// Execute a query (both read and write)
async function runQuery(cypher, params = {}) {
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map(record => record.toObject());
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Initialize database with constraints and indexes
async function initializeDatabase() {
  const session = driver.session();

  try {
    // Create constraints and indexes for Configuration Items
    await session.run(`
      CREATE CONSTRAINT ci_id_unique IF NOT EXISTS
      FOR (ci:ConfigurationItem) REQUIRE ci.id IS UNIQUE
    `);

    await session.run(`
      CREATE INDEX ci_type_index IF NOT EXISTS
      FOR (ci:ConfigurationItem) ON (ci.type)
    `);

    await session.run(`
      CREATE INDEX ci_name_index IF NOT EXISTS
      FOR (ci:ConfigurationItem) ON (ci.name)
    `);

    // Create constraints for Events
    await session.run(`
      CREATE CONSTRAINT event_id_unique IF NOT EXISTS
      FOR (e:Event) REQUIRE e.id IS UNIQUE
    `);

    await session.run(`
      CREATE INDEX event_timestamp_index IF NOT EXISTS
      FOR (e:Event) ON (e.timestamp)
    `);

    await session.run(`
      CREATE INDEX event_severity_index IF NOT EXISTS
      FOR (e:Event) ON (e.severity)
    `);

    // Create constraints for Services
    await session.run(`
      CREATE CONSTRAINT service_id_unique IF NOT EXISTS
      FOR (s:Service) REQUIRE s.id IS UNIQUE
    `);

    console.log('Database initialized with constraints and indexes');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    await session.close();
  }
}

module.exports = {
  connectToNeo4j,
  closeConnection,
  runQuery,
  runReadQuery: runQuery,
  runWriteQuery: runQuery,
  initializeDatabase
};