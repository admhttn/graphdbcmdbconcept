/**
 * Unit Tests for Neo4j Service
 * Tests database connection, query execution, and initialization
 */

const neo4jService = require('../../src/services/neo4j');

// Mock neo4j-driver
jest.mock('neo4j-driver', () => {
  const mockSession = {
    run: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined)
  };

  const mockDriver = {
    verifyConnectivity: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    session: jest.fn(() => mockSession)
  };

  return {
    driver: jest.fn(() => mockDriver),
    auth: {
      basic: jest.fn((user, password) => ({ user, password }))
    }
  };
});

describe('Neo4j Service', () => {
  let neo4j;
  let mockDriver;
  let mockSession;

  beforeEach(() => {
    jest.clearAllMocks();
    neo4j = require('neo4j-driver');

    // Get mock instances
    mockDriver = neo4j.driver();
    mockSession = mockDriver.session();

    // Reset environment variables
    delete process.env.NEO4J_URI;
    delete process.env.NEO4J_USER;
    delete process.env.NEO4J_PASSWORD;
  });

  describe('connectToNeo4j', () => {
    it('should connect with default configuration', async () => {
      await neo4jService.connectToNeo4j();

      expect(neo4j.driver).toHaveBeenCalledWith(
        'bolt://localhost:7687',
        expect.objectContaining({
          user: 'neo4j',
          password: 'CHANGE_ME_INSECURE_DEFAULT'
        })
      );
      expect(mockDriver.verifyConnectivity).toHaveBeenCalled();
    });

    it('should connect with environment variables', async () => {
      process.env.NEO4J_URI = 'bolt://custom-host:7687';
      process.env.NEO4J_USER = 'customuser';
      process.env.NEO4J_PASSWORD = 'custompass';

      await neo4jService.connectToNeo4j();

      expect(neo4j.driver).toHaveBeenCalledWith(
        'bolt://custom-host:7687',
        expect.objectContaining({
          user: 'customuser',
          password: 'custompass'
        })
      );
    });

    it('should throw error on connection failure', async () => {
      const connectionError = new Error('Connection refused');
      mockDriver.verifyConnectivity.mockRejectedValueOnce(connectionError);

      await expect(neo4jService.connectToNeo4j()).rejects.toThrow('Connection refused');
    });

    it('should return driver instance', async () => {
      const driver = await neo4jService.connectToNeo4j();
      expect(driver).toBeDefined();
      expect(driver.verifyConnectivity).toBeDefined();
    });
  });

  describe('closeConnection', () => {
    it('should close driver connection', async () => {
      await neo4jService.connectToNeo4j();
      await neo4jService.closeConnection();

      expect(mockDriver.close).toHaveBeenCalled();
    });

    it('should handle close error gracefully', async () => {
      await neo4jService.connectToNeo4j();
      mockDriver.close.mockRejectedValueOnce(new Error('Close failed'));

      // Should not throw
      await expect(neo4jService.closeConnection()).resolves.toBeUndefined();
    });

    it('should handle closing without active connection', async () => {
      // Should not throw even if driver is null
      await expect(neo4jService.closeConnection()).resolves.toBeUndefined();
    });
  });

  describe('runQuery', () => {
    beforeEach(async () => {
      await neo4jService.connectToNeo4j();
    });

    it('should execute query and return mapped results', async () => {
      const mockRecords = [
        { toObject: () => ({ id: '1', name: 'Test1' }) },
        { toObject: () => ({ id: '2', name: 'Test2' }) }
      ];

      mockSession.run.mockResolvedValueOnce({ records: mockRecords });

      const result = await neo4jService.runQuery('MATCH (n) RETURN n');

      expect(mockSession.run).toHaveBeenCalledWith('MATCH (n) RETURN n', {});
      expect(result).toEqual([
        { id: '1', name: 'Test1' },
        { id: '2', name: 'Test2' }
      ]);
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should execute query with parameters', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const params = { id: 'test-id', name: 'Test Name' };
      await neo4jService.runQuery('MATCH (n {id: $id}) RETURN n', params);

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (n {id: $id}) RETURN n',
        params
      );
    });

    it('should handle empty result set', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const result = await neo4jService.runQuery('MATCH (n) WHERE false RETURN n');

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      const queryError = new Error('Syntax error');
      mockSession.run.mockRejectedValueOnce(queryError);

      await expect(neo4jService.runQuery('INVALID QUERY')).rejects.toThrow('Syntax error');
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should close session even on error', async () => {
      mockSession.run.mockRejectedValueOnce(new Error('Query failed'));

      try {
        await neo4jService.runQuery('MATCH (n) RETURN n');
      } catch (e) {
        // Expected error
      }

      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should support runReadQuery alias', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      await neo4jService.runReadQuery('MATCH (n) RETURN n');

      expect(mockSession.run).toHaveBeenCalled();
    });

    it('should support runWriteQuery alias', async () => {
      mockSession.run.mockResolvedValueOnce({ records: [] });

      await neo4jService.runWriteQuery('CREATE (n:Test) RETURN n');

      expect(mockSession.run).toHaveBeenCalled();
    });
  });

  describe('initializeDatabase', () => {
    beforeEach(async () => {
      await neo4jService.connectToNeo4j();
      mockSession.run.mockResolvedValue({ records: [] });
    });

    it('should create all constraints and indexes', async () => {
      await neo4jService.initializeDatabase();

      // Should create 3 CI indexes + 3 Event indexes + 1 Service index = 7 total
      expect(mockSession.run).toHaveBeenCalledTimes(7);

      // Verify constraint creation calls
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE CONSTRAINT ci_id_unique')
      );
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE CONSTRAINT event_id_unique')
      );
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE CONSTRAINT service_id_unique')
      );

      // Verify index creation calls
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX ci_type_index')
      );
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX event_timestamp_index')
      );
    });

    it('should close session after initialization', async () => {
      await neo4jService.initializeDatabase();

      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      const initError = new Error('Constraint already exists');
      mockSession.run.mockRejectedValueOnce(initError);

      await expect(neo4jService.initializeDatabase()).rejects.toThrow('Constraint already exists');
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should create IF NOT EXISTS constraints', async () => {
      await neo4jService.initializeDatabase();

      // Verify that all constraint creations use IF NOT EXISTS
      const calls = mockSession.run.mock.calls;
      const constraintCalls = calls.filter(call =>
        call[0].includes('CREATE CONSTRAINT')
      );

      constraintCalls.forEach(call => {
        expect(call[0]).toContain('IF NOT EXISTS');
      });
    });

    it('should create IF NOT EXISTS indexes', async () => {
      await neo4jService.initializeDatabase();

      // Verify that all index creations use IF NOT EXISTS
      const calls = mockSession.run.mock.calls;
      const indexCalls = calls.filter(call =>
        call[0].includes('CREATE INDEX')
      );

      indexCalls.forEach(call => {
        expect(call[0]).toContain('IF NOT EXISTS');
      });
    });
  });

  describe('Error Handling', () => {
    it('should log connection errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockDriver.verifyConnectivity.mockRejectedValueOnce(new Error('Network error'));

      try {
        await neo4jService.connectToNeo4j();
      } catch (e) {
        // Expected error
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to connect to Neo4j:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should log query errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await neo4jService.connectToNeo4j();
      mockSession.run.mockRejectedValueOnce(new Error('Query error'));

      try {
        await neo4jService.runQuery('BAD QUERY');
      } catch (e) {
        // Expected error
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'Query error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Module Exports', () => {
    it('should export all required functions', () => {
      expect(neo4jService).toHaveProperty('connectToNeo4j');
      expect(neo4jService).toHaveProperty('closeConnection');
      expect(neo4jService).toHaveProperty('runQuery');
      expect(neo4jService).toHaveProperty('runReadQuery');
      expect(neo4jService).toHaveProperty('runWriteQuery');
      expect(neo4jService).toHaveProperty('initializeDatabase');
    });

    it('should have function type exports', () => {
      expect(typeof neo4jService.connectToNeo4j).toBe('function');
      expect(typeof neo4jService.closeConnection).toBe('function');
      expect(typeof neo4jService.runQuery).toBe('function');
      expect(typeof neo4jService.initializeDatabase).toBe('function');
    });
  });
});
