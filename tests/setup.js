const { beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');

// Global test setup
global.testConfig = {
  baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
  neo4jURI: process.env.TEST_NEO4J_URI || 'bolt://localhost:7687',
  neo4jUser: process.env.TEST_NEO4J_USER || 'neo4j',
  neo4jPassword: process.env.TEST_NEO4J_PASSWORD || 'CHANGE_ME_INSECURE_DEFAULT',
  redisURL: process.env.TEST_REDIS_URL || 'redis://localhost:6379',
  timeout: {
    short: 5000,
    medium: 15000,
    long: 60000
  }
};

// Global timeout for async operations
jest.setTimeout(30000);

// Helper to wait for condition
global.waitFor = async (condition, timeout = 10000, interval = 100) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
};

// Helper to retry operations
global.retry = async (operation, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

console.log('Test setup completed with config:', global.testConfig);