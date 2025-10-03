/**
 * Unit Tests for Temporal Relationships Service
 *
 * Tests versioning, time-travel queries, history tracking, and event handling
 */

const {
  createTemporalRelationship,
  getTopologyAtDate,
  getRelationshipHistory,
  updateRelationshipWithHistory,
  handleScalingEvent,
  findExpiringRelationships,
  getWeightTrend
} = require('../../src/services/temporalRelationships');

// Mock Neo4j driver
jest.mock('../../src/services/neo4j', () => {
  const mockSession = {
    run: jest.fn(),
    close: jest.fn()
  };

  const mockDriver = {
    session: jest.fn(() => mockSession)
  };

  return {
    getDriver: jest.fn(() => mockDriver),
    connectToNeo4j: jest.fn(),
    closeConnection: jest.fn()
  };
});

const { getDriver } = require('../../src/services/neo4j');

describe('Temporal Relationships Service', () => {
  let mockSession;

  beforeEach(() => {
    jest.clearAllMocks();
    const driver = getDriver();
    mockSession = driver.session();
  });

  describe('createTemporalRelationship', () => {
    it('should create a new versioned relationship', async () => {
      // Mock archiving existing relationships (none found)
      mockSession.run
        .mockResolvedValueOnce({ records: [] })
        // Mock creating new relationship
        .mockResolvedValueOnce({
          records: [{
            get: jest.fn((key) => {
              const data = {
                relId: '12345',
                sourceName: 'App-A',
                targetName: 'DB-B',
                r: {
                  properties: {
                    version: 1,
                    previousVersion: 0,
                    status: 'ACTIVE',
                    changeReason: 'Initial creation',
                    createdBy: 'test-user',
                    createdAt: new Date(),
                    validFrom: new Date(),
                    validTo: null,
                    weight: 0.85
                  }
                }
              };
              return data[key];
            })
          }]
        });

      const result = await createTemporalRelationship({
        from: 'app-123',
        to: 'db-456',
        type: 'DEPENDS_ON',
        properties: { weight: 0.85, criticalityScore: 0.9 },
        createdBy: 'test-user',
        changeReason: 'Initial creation'
      });

      expect(result).toBeDefined();
      expect(result.version).toBe(1);
      expect(result.previousVersion).toBe(0);
      expect(result.status).toBe('ACTIVE');
      expect(mockSession.run).toHaveBeenCalledTimes(2);
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should archive existing relationship and create new version', async () => {
      // Mock finding and archiving existing relationship
      mockSession.run
        .mockResolvedValueOnce({
          records: [{
            get: jest.fn(() => 2) // Previous version was 2
          }]
        })
        // Mock creating new version
        .mockResolvedValueOnce({
          records: [{
            get: jest.fn((key) => {
              const data = {
                relId: '12346',
                sourceName: 'App-A',
                targetName: 'DB-B',
                r: {
                  properties: {
                    version: 3,
                    previousVersion: 2,
                    status: 'ACTIVE',
                    changeReason: 'Weight update',
                    createdBy: 'test-user',
                    createdAt: new Date(),
                    validFrom: new Date(),
                    validTo: null,
                    weight: 0.95
                  }
                }
              };
              return data[key];
            })
          }]
        });

      const result = await createTemporalRelationship({
        from: 'app-123',
        to: 'db-456',
        type: 'DEPENDS_ON',
        properties: { weight: 0.95, criticalityScore: 0.95 },
        createdBy: 'test-user',
        changeReason: 'Weight update'
      });

      expect(result.version).toBe(3);
      expect(result.previousVersion).toBe(2);
      expect(mockSession.run).toHaveBeenCalledTimes(2);
    });

    it('should handle errors when CIs not found', async () => {
      mockSession.run
        .mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ records: [] }); // No CIs found

      await expect(
        createTemporalRelationship({
          from: 'nonexistent-1',
          to: 'nonexistent-2',
          type: 'DEPENDS_ON',
          properties: {}
        })
      ).rejects.toThrow('Could not create relationship');
    });
  });

  describe('getTopologyAtDate', () => {
    it('should return topology snapshot at specific date', async () => {
      const mockTopology = {
        records: [
          {
            get: jest.fn((key) => {
              const data = {
                id: 'app-123',
                name: 'App-A',
                type: 'Application',
                status: 'OPERATIONAL',
                relationships: [
                  {
                    type: 'DEPENDS_ON',
                    source: 'app-123',
                    target: 'db-456',
                    properties: { weight: 0.85 }
                  }
                ]
              };
              return data[key];
            })
          },
          {
            get: jest.fn((key) => {
              const data = {
                id: 'db-456',
                name: 'DB-B',
                type: 'Database',
                status: 'OPERATIONAL',
                relationships: []
              };
              return data[key];
            })
          }
        ]
      };

      mockSession.run.mockResolvedValueOnce(mockTopology);

      const targetDate = new Date('2024-06-01T00:00:00Z');
      const result = await getTopologyAtDate(targetDate, {
        maxDepth: 3,
        relationshipTypes: ['DEPENDS_ON']
      });

      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.targetDate).toBe(targetDate.toISOString());
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should filter by specific CI', async () => {
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: jest.fn((key) => {
              const data = {
                id: 'app-123',
                name: 'App-A',
                type: 'Application',
                status: 'OPERATIONAL',
                relationships: []
              };
              return data[key];
            })
          }
        ]
      });

      const result = await getTopologyAtDate(new Date(), {
        ciId: 'app-123',
        maxDepth: 2
      });

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('app-123');
    });
  });

  describe('getRelationshipHistory', () => {
    it('should return complete version history', async () => {
      const mockHistory = {
        records: [
          {
            get: jest.fn((key) => {
              const versions = {
                version: 3,
                validFrom: new Date('2024-06-01'),
                validTo: null,
                status: 'ACTIVE',
                changeReason: 'Latest update',
                createdBy: 'admin',
                createdAt: new Date('2024-06-01'),
                modifiedBy: 'admin',
                lastModified: new Date('2024-06-01'),
                properties: { weight: 0.95 }
              };
              return versions[key];
            })
          },
          {
            get: jest.fn((key) => {
              const versions = {
                version: 2,
                validFrom: new Date('2024-03-01'),
                validTo: new Date('2024-05-31'),
                status: 'ARCHIVED',
                changeReason: 'Mid-year update',
                createdBy: 'admin',
                createdAt: new Date('2024-03-01'),
                modifiedBy: 'admin',
                lastModified: new Date('2024-03-01'),
                properties: { weight: 0.85 }
              };
              return versions[key];
            })
          },
          {
            get: jest.fn((key) => {
              const versions = {
                version: 1,
                validFrom: new Date('2024-01-01'),
                validTo: new Date('2024-02-28'),
                status: 'ARCHIVED',
                changeReason: 'Initial creation',
                createdBy: 'system',
                createdAt: new Date('2024-01-01'),
                modifiedBy: 'system',
                lastModified: new Date('2024-01-01'),
                properties: { weight: 0.7 }
              };
              return versions[key];
            })
          }
        ]
      };

      mockSession.run.mockResolvedValueOnce(mockHistory);

      const result = await getRelationshipHistory('app-123', 'db-456', 'DEPENDS_ON');

      expect(result).toHaveLength(3);
      expect(result[0].version).toBe(3);
      expect(result[0].status).toBe('ACTIVE');
      expect(result[2].version).toBe(1);
      expect(result[2].status).toBe('ARCHIVED');
    });

    it('should return empty array if no history exists', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const result = await getRelationshipHistory('app-999', 'db-999', 'DEPENDS_ON');

      expect(result).toHaveLength(0);
    });
  });

  describe('updateRelationshipWithHistory', () => {
    it('should update relationship and maintain history', async () => {
      mockSession.run.mockResolvedValueOnce({
        records: [{
          get: jest.fn((key) => {
            const data = {
              r: { properties: { weight: 0.9 } },
              properties: {
                weight: 0.9,
                criticalityScore: 0.95,
                weightHistory: [
                  { timestamp: new Date(), weight: 0.9, source: 'manual' }
                ]
              }
            };
            return data[key];
          })
        }]
      });

      const result = await updateRelationshipWithHistory('12345', {
        weight: 0.9,
        criticalityScore: 0.95,
        source: 'manual',
        modifiedBy: 'admin'
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('12345');
      expect(result.updated).toBe(true);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('SET r.weightHistory'),
        expect.any(Object)
      );
    });

    it('should throw error if relationship not found', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      await expect(
        updateRelationshipWithHistory('99999', { weight: 0.9 })
      ).rejects.toThrow('Relationship not found: 99999');
    });
  });

  describe('handleScalingEvent', () => {
    it('should update load factors on scale-up', async () => {
      mockSession.run
        .mockResolvedValueOnce({
          records: [{
            get: jest.fn((key) => {
              const data = {
                r: {
                  properties: {
                    loadFactor: 50,
                    activationThreshold: 0.8
                  }
                },
                relId: { toString: () => '12345' },
                relType: 'DEPENDS_ON'
              };
              return data[key];
            })
          }]
        })
        .mockResolvedValueOnce({
          records: [{
            get: jest.fn(() => ({
              properties: { loadFactor: 60, weightHistory: [] }
            }))
          }]
        });

      const result = await handleScalingEvent({
        ciId: 'app-123',
        currentLoad: 85,
        scalingAction: 'scale-up'
      });

      expect(result).toHaveLength(1);
      expect(result[0].newLoadFactor).toBeGreaterThan(result[0].oldLoadFactor);
    });

    it('should decrease load factors on scale-down', async () => {
      mockSession.run
        .mockResolvedValueOnce({
          records: [{
            get: jest.fn((key) => {
              const data = {
                r: {
                  properties: {
                    loadFactor: 80,
                    activationThreshold: 0.8
                  }
                },
                relId: { toString: () => '12345' },
                relType: 'DEPENDS_ON'
              };
              return data[key];
            })
          }]
        })
        .mockResolvedValueOnce({
          records: [{
            get: jest.fn(() => ({
              properties: { loadFactor: 64, weightHistory: [] }
            }))
          }]
        });

      const result = await handleScalingEvent({
        ciId: 'app-123',
        currentLoad: 50,
        scalingAction: 'scale-down'
      });

      expect(result).toHaveLength(1);
      expect(result[0].newLoadFactor).toBeLessThan(result[0].oldLoadFactor);
    });
  });

  describe('findExpiringRelationships', () => {
    it('should find relationships expiring within timeframe', async () => {
      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

      mockSession.run.mockResolvedValueOnce({
        records: [{
          get: jest.fn((key) => {
            const data = {
              sourceId: 'app-123',
              sourceName: 'App-A',
              targetId: 'db-456',
              targetName: 'DB-B',
              relType: 'DEPENDS_ON',
              expiresAt: futureDate,
              daysUntilExpiry: 3,
              version: 2,
              changeReason: 'Temporary connection'
            };
            return data[key];
          })
        }]
      });

      const result = await findExpiringRelationships(7);

      expect(result).toHaveLength(1);
      expect(result[0].daysUntilExpiry).toBe(3);
      expect(result[0].sourceId).toBe('app-123');
    });

    it('should return empty array if none expiring', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const result = await findExpiringRelationships(7);

      expect(result).toHaveLength(0);
    });
  });

  describe('getWeightTrend', () => {
    it('should return weight trend analysis', async () => {
      const mockHistory = [
        { timestamp: new Date('2024-01-01'), weight: 0.7 },
        { timestamp: new Date('2024-02-01'), weight: 0.75 },
        { timestamp: new Date('2024-03-01'), weight: 0.8 },
        { timestamp: new Date('2024-04-01'), weight: 0.85 },
        { timestamp: new Date('2024-05-01'), weight: 0.9 }
      ];

      mockSession.run.mockResolvedValueOnce({
        records: [{
          get: jest.fn((key) => {
            const data = {
              history: mockHistory,
              currentWeight: 0.9,
              currentCriticality: 0.95,
              currentLoad: 75
            };
            return data[key];
          })
        }]
      });

      const result = await getWeightTrend('app-123', 'db-456', 'DEPENDS_ON');

      expect(result.found).toBe(true);
      expect(result.currentWeight).toBe(0.9);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.trend).toBe('increasing');
      expect(result.statistics.minimum).toBe(0.7);
      expect(result.statistics.maximum).toBe(0.9);
      expect(result.statistics.dataPoints).toBe(5);
    });

    it('should detect decreasing trend', async () => {
      const mockHistory = [
        { timestamp: new Date('2024-01-01'), weight: 0.9 },
        { timestamp: new Date('2024-02-01'), weight: 0.85 },
        { timestamp: new Date('2024-03-01'), weight: 0.8 },
        { timestamp: new Date('2024-04-01'), weight: 0.75 },
        { timestamp: new Date('2024-05-01'), weight: 0.7 }
      ];

      mockSession.run.mockResolvedValueOnce({
        records: [{
          get: jest.fn((key) => {
            const data = {
              history: mockHistory,
              currentWeight: 0.7,
              currentCriticality: 0.75,
              currentLoad: 50
            };
            return data[key];
          })
        }]
      });

      const result = await getWeightTrend('app-123', 'db-456', 'DEPENDS_ON');

      expect(result.statistics.trend).toBe('decreasing');
    });

    it('should return not found if relationship has no history', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const result = await getWeightTrend('app-999', 'db-999', 'DEPENDS_ON');

      expect(result.found).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null validTo date', async () => {
      mockSession.run
        .mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({
          records: [{
            get: jest.fn((key) => {
              const data = {
                relId: '12345',
                sourceName: 'App-A',
                targetName: 'DB-B',
                r: {
                  properties: {
                    version: 1,
                    previousVersion: 0,
                    status: 'ACTIVE',
                    validTo: null, // Indefinite
                    validFrom: new Date(),
                    createdBy: 'system',
                    changeReason: 'Permanent relationship'
                  }
                }
              };
              return data[key];
            })
          }]
        });

      const result = await createTemporalRelationship({
        from: 'app-123',
        to: 'db-456',
        type: 'DEPENDS_ON',
        properties: {},
        validTo: null
      });

      expect(result.validTo).toBeNull();
    });

    it('should handle database connection errors gracefully', async () => {
      mockSession.run.mockRejectedValueOnce(new Error('Database connection lost'));

      await expect(
        createTemporalRelationship({
          from: 'app-123',
          to: 'db-456',
          type: 'DEPENDS_ON',
          properties: {}
        })
      ).rejects.toThrow('Database connection lost');

      expect(mockSession.close).toHaveBeenCalled();
    });
  });
});
