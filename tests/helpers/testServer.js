const request = require('supertest');
const neo4j = require('neo4j-driver');

class TestServer {
  constructor() {
    this.baseURL = global.testConfig?.baseURL || 'http://localhost:3000';
    this.neo4jDriver = null;
  }

  async start() {
    // Initialize Neo4j driver for test cleanup
    this.neo4jDriver = neo4j.driver(
      global.testConfig?.neo4jURI || 'bolt://localhost:7687',
      neo4j.auth.basic(
        global.testConfig?.neo4jUser || 'neo4j',
        global.testConfig?.neo4jPassword || 'password'
      )
    );

    // Check if server is accessible
    try {
      const response = await request(this.baseURL).get('/health');
      if (response.status === 200) {
        console.log('✅ Server is accessible at', this.baseURL);
        return 3000;
      }
    } catch (error) {
      console.error('❌ Server not accessible:', error.message);
      throw new Error(`Server not accessible at ${this.baseURL}. Please start the server first.`);
    }
  }

  async stop() {
    if (this.neo4jDriver) {
      await this.neo4jDriver.close();
    }
  }

  async cleanDatabase() {
    if (!this.neo4jDriver) return;

    const session = this.neo4jDriver.session();
    try {
      // Clear all data in batches to avoid memory issues
      let deletedCount = 0;
      const batchSize = 1000;

      while (true) {
        const result = await session.run(`
          MATCH (n)
          WITH n LIMIT ${batchSize}
          DETACH DELETE n
          RETURN count(*) as deleted
        `);

        const deleted = result.records[0]?.get('deleted').toNumber() || 0;
        if (deleted === 0) break;
        deletedCount += deleted;
      }

      console.log(`Cleaned ${deletedCount} nodes from test database`);
    } finally {
      await session.close();
    }
  }

  request() {
    return request(this.baseURL);
  }
}

module.exports = TestServer;