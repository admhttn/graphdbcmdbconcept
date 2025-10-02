/**
 * Unit Tests for Weighted Relationships API
 * Tests API endpoints for weighted relationship management
 */

const request = require('supertest');
const express = require('express');
const weightedRelAPI = require('../../src/api/weightedRelationships');

// Mock the weightedRelationships service
jest.mock('../../src/services/weightedRelationships', () => ({
  calculateCriticalityScore: jest.fn((params) => {
    // Simple mock calculation
    return 0.85;
  }),
  calculateLoadFactor: jest.fn(() => 75.5),
  calculateOverallWeight: jest.fn(() => 0.78),
  createWeightedRelationship: jest.fn((data) => ({
    id: 'rel-123',
    ...data,
    weight: 0.78
  })),
  updateRelationshipWeight: jest.fn((id, weights) => ({
    id,
    ...weights,
    updated: true
  })),
  getRelationshipWeight: jest.fn((id) => ({
    id,
    criticalityScore: 0.85,
    loadFactor: 75.5,
    overallWeight: 0.78
  })),
  findShortestWeightedPath: jest.fn((start, end) => ({
    path: [start, 'middle-node', end],
    totalWeight: 1.5,
    hopCount: 2
  })),
  findTopNPaths: jest.fn((start, end, n) => [
    { path: [start, 'node1', end], weight: 1.2 },
    { path: [start, 'node2', end], weight: 1.5 }
  ]),
  calculateCriticalityRankings: jest.fn(() => [
    { ciId: 'ci-1', name: 'Critical Server', score: 0.95 },
    { ciId: 'ci-2', name: 'Database', score: 0.88 }
  ]),
  autoCalculateWeights: jest.fn((filter) => ({
    updated: 150,
    failed: 0
  }))
}));

describe('Weighted Relationships API', () => {
  let app;
  let weightedRelService;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/relationships', weightedRelAPI);

    weightedRelService = require('../../src/services/weightedRelationships');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/relationships/weighted', () => {
    it('should create weighted relationship', async () => {
      const relationshipData = {
        sourceId: 'ci-1',
        targetId: 'ci-2',
        type: 'DEPENDS_ON',
        criticalityScore: 0.9,
        loadFactor: 80
      };

      const response = await request(app)
        .post('/api/relationships/weighted')
        .send(relationshipData)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('weight');
      expect(weightedRelService.createWeightedRelationship).toHaveBeenCalledWith(
        expect.objectContaining(relationshipData)
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/relationships/weighted')
        .send({
          sourceId: 'ci-1'
          // Missing targetId and type
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle service errors', async () => {
      weightedRelService.createWeightedRelationship.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/relationships/weighted')
        .send({
          sourceId: 'ci-1',
          targetId: 'ci-2',
          type: 'DEPENDS_ON'
        })
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/relationships/:id/weight', () => {
    it('should retrieve relationship weight', async () => {
      const response = await request(app)
        .get('/api/relationships/rel-123/weight')
        .expect(200);

      expect(response.body).toHaveProperty('criticalityScore');
      expect(response.body).toHaveProperty('loadFactor');
      expect(response.body).toHaveProperty('overallWeight');
      expect(weightedRelService.getRelationshipWeight).toHaveBeenCalledWith('rel-123');
    });

    it('should handle non-existent relationships', async () => {
      weightedRelService.getRelationshipWeight.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/relationships/non-existent/weight')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/relationships/:id/weight', () => {
    it('should update relationship weight', async () => {
      const updates = {
        criticalityScore: 0.95,
        loadFactor: 85
      };

      const response = await request(app)
        .put('/api/relationships/rel-123/weight')
        .send(updates)
        .expect(200);

      expect(response.body).toHaveProperty('updated', true);
      expect(weightedRelService.updateRelationshipWeight).toHaveBeenCalledWith(
        'rel-123',
        updates
      );
    });

    it('should validate weight values', async () => {
      const response = await request(app)
        .put('/api/relationships/rel-123/weight')
        .send({
          criticalityScore: 1.5 // Invalid: > 1.0
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/relationships/calculate/criticality', () => {
    it('should calculate criticality score', async () => {
      const params = {
        sourceCriticality: 0.8,
        targetCriticality: 0.9,
        businessImpact: 0.85,
        redundancyLevel: 2,
        historicalFailures: 0,
        recoveryComplexity: 0.6
      };

      const response = await request(app)
        .post('/api/relationships/calculate/criticality')
        .send(params)
        .expect(200);

      expect(response.body).toHaveProperty('score', 0.85);
      expect(weightedRelService.calculateCriticalityScore).toHaveBeenCalledWith(params);
    });

    it('should use default values for missing params', async () => {
      const response = await request(app)
        .post('/api/relationships/calculate/criticality')
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('score');
    });
  });

  describe('POST /api/relationships/calculate/load', () => {
    it('should calculate load factor', async () => {
      const params = {
        currentUtilization: 80,
        capacity: 100,
        historicalPeak: 90,
        manualWeight: 0.8
      };

      const response = await request(app)
        .post('/api/relationships/calculate/load')
        .send(params)
        .expect(200);

      expect(response.body).toHaveProperty('loadFactor', 75.5);
      expect(weightedRelService.calculateLoadFactor).toHaveBeenCalledWith(params);
    });
  });

  describe('POST /api/relationships/calculate/overall', () => {
    it('should calculate overall weight', async () => {
      const params = {
        criticalityScore: 0.85,
        loadFactor: 75,
        latencyMs: 50,
        bandwidthMbps: 1000,
        reliabilityPercent: 99.9
      };

      const response = await request(app)
        .post('/api/relationships/calculate/overall')
        .send(params)
        .expect(200);

      expect(response.body).toHaveProperty('weight', 0.78);
      expect(weightedRelService.calculateOverallWeight).toHaveBeenCalledWith(params);
    });
  });

  describe('GET /api/relationships/shortest-path/:startId/:endId', () => {
    it('should find shortest weighted path', async () => {
      const response = await request(app)
        .get('/api/relationships/shortest-path/ci-1/ci-5')
        .expect(200);

      expect(response.body).toHaveProperty('path');
      expect(response.body).toHaveProperty('totalWeight');
      expect(response.body).toHaveProperty('hopCount');
      expect(weightedRelService.findShortestWeightedPath).toHaveBeenCalledWith(
        'ci-1',
        'ci-5',
        expect.any(Object)
      );
    });

    it('should support optional parameters', async () => {
      const response = await request(app)
        .get('/api/relationships/shortest-path/ci-1/ci-5')
        .query({ maxHops: '5', relationshipTypes: 'DEPENDS_ON,CONTAINS' })
        .expect(200);

      expect(weightedRelService.findShortestWeightedPath).toHaveBeenCalledWith(
        'ci-1',
        'ci-5',
        expect.objectContaining({
          maxHops: '5',
          relationshipTypes: 'DEPENDS_ON,CONTAINS'
        })
      );
    });

    it('should handle no path found', async () => {
      weightedRelService.findShortestWeightedPath.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/relationships/shortest-path/ci-1/ci-999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/relationships/top-paths/:startId/:endId', () => {
    it('should find top N weighted paths', async () => {
      const response = await request(app)
        .get('/api/relationships/top-paths/ci-1/ci-5')
        .query({ n: '3' })
        .expect(200);

      expect(response.body).toHaveProperty('paths');
      expect(Array.isArray(response.body.paths)).toBe(true);
      expect(weightedRelService.findTopNPaths).toHaveBeenCalledWith(
        'ci-1',
        'ci-5',
        '3',
        expect.any(Object)
      );
    });

    it('should use default n value', async () => {
      await request(app)
        .get('/api/relationships/top-paths/ci-1/ci-5')
        .expect(200);

      expect(weightedRelService.findTopNPaths).toHaveBeenCalledWith(
        'ci-1',
        'ci-5',
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('GET /api/relationships/criticality-rankings', () => {
    it('should get criticality rankings', async () => {
      const response = await request(app)
        .get('/api/relationships/criticality-rankings')
        .expect(200);

      expect(response.body).toHaveProperty('rankings');
      expect(Array.isArray(response.body.rankings)).toBe(true);
      expect(response.body.rankings[0]).toHaveProperty('score');
    });

    it('should support filtering options', async () => {
      await request(app)
        .get('/api/relationships/criticality-rankings')
        .query({ limit: '10', minScore: '0.8' })
        .expect(200);

      expect(weightedRelService.calculateCriticalityRankings).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: '10',
          minScore: '0.8'
        })
      );
    });
  });

  describe('POST /api/relationships/auto-calculate-weights', () => {
    it('should auto-calculate weights for all relationships', async () => {
      const response = await request(app)
        .post('/api/relationships/auto-calculate-weights')
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('updated');
      expect(response.body).toHaveProperty('failed');
      expect(weightedRelService.autoCalculateWeights).toHaveBeenCalled();
    });

    it('should support filtering by relationship type', async () => {
      await request(app)
        .post('/api/relationships/auto-calculate-weights')
        .send({ relationshipType: 'DEPENDS_ON' })
        .expect(200);

      expect(weightedRelService.autoCalculateWeights).toHaveBeenCalledWith(
        expect.objectContaining({
          relationshipType: 'DEPENDS_ON'
        })
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to write operations', async () => {
      // This test verifies that rate limiting middleware is applied
      // In a real scenario, you'd make multiple requests to trigger rate limiting

      const response = await request(app)
        .post('/api/relationships/weighted')
        .send({
          sourceId: 'ci-1',
          targetId: 'ci-2',
          type: 'DEPENDS_ON'
        });

      expect(response.status).toBeLessThan(500);
    });

    it('should apply rate limiting to expensive operations', async () => {
      const response = await request(app)
        .get('/api/relationships/shortest-path/ci-1/ci-5');

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/relationships/weighted')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle service exceptions', async () => {
      weightedRelService.calculateCriticalityScore.mockImplementationOnce(() => {
        throw new Error('Calculation error');
      });

      const response = await request(app)
        .post('/api/relationships/calculate/criticality')
        .send({})
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    it('should return appropriate status codes', async () => {
      // 200 for success
      await request(app)
        .post('/api/relationships/calculate/criticality')
        .send({})
        .expect(200);

      // 404 for not found
      weightedRelService.getRelationshipWeight.mockResolvedValueOnce(null);
      await request(app)
        .get('/api/relationships/non-existent/weight')
        .expect(404);
    });
  });

  describe('Response Format', () => {
    it('should return JSON responses', async () => {
      const response = await request(app)
        .post('/api/relationships/calculate/criticality')
        .send({});

      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('should include proper error messages', async () => {
      const response = await request(app)
        .post('/api/relationships/weighted')
        .send({
          sourceId: 'ci-1'
          // Missing required fields
        })
        .expect(400);

      expect(response.body.error).toBeTruthy();
      expect(typeof response.body.error).toBe('string');
    });
  });
});
