const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const request = require('supertest');

describe('API Health Integration Tests', () => {
  const baseURL = global.testConfig?.baseURL || 'http://localhost:3000';

  test('should respond to health check', async () => {
    const response = await request(baseURL)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'OK');
    expect(response.body).toHaveProperty('timestamp');

    // Verify timestamp is recent (within last minute)
    const timestamp = new Date(response.body.timestamp);
    const now = new Date();
    const timeDiff = now - timestamp;
    expect(timeDiff).toBeLessThan(60000); // Less than 1 minute
  });

  test('should respond to database stats endpoint', async () => {
    const response = await request(baseURL)
      .get('/api/cmdb/database/stats')
      .expect(200);

    expect(response.body).toHaveProperty('nodes');
    expect(response.body).toHaveProperty('relationships');
    expect(response.body).toHaveProperty('relationshipTypes');
    expect(response.body).toHaveProperty('nodeTypes');

    // Verify data types
    expect(typeof response.body.nodes).toBe('object');
    expect(typeof response.body.relationships).toBe('object');
    expect(Array.isArray(response.body.relationshipTypes)).toBe(true);
    expect(Array.isArray(response.body.nodeTypes)).toBe(true);
  });

  test('should handle non-existent endpoint gracefully', async () => {
    await request(baseURL)
      .get('/api/non-existent')
      .expect(404);
  });

  test('should respond to CORS preflight requests', async () => {
    const response = await request(baseURL)
      .options('/api/cmdb/database/stats')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe('*');
  });

  test('should return valid JSON for all API endpoints', async () => {
    const endpoints = [
      '/health',
      '/api/cmdb/database/stats',
      '/api/events',
      '/api/events/stats'
    ];

    for (const endpoint of endpoints) {
      const response = await request(baseURL)
        .get(endpoint)
        .expect(200);

      expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
    }
  });

  test('should handle query parameters correctly', async () => {
    const response = await request(baseURL)
      .get('/api/events?limit=5&severity=info')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeLessThanOrEqual(5);
  });
});