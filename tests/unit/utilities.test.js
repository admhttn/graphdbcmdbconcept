const { describe, test, expect } = require('@jest/globals');

describe('Utility Functions', () => {
  test('should validate UUID format', () => {
    const crypto = require('crypto');
    const uuidv4 = () => crypto.randomUUID();

    const uuid = uuidv4();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(uuid).toMatch(uuidRegex);
  });

  test('should handle configuration validation', () => {
    const validateConfig = (config) => {
      if (!config) return false;
      if (!config.port || typeof config.port !== 'number') return false;
      if (!config.neo4j || !config.neo4j.uri) return false;
      return true;
    };

    const validConfig = {
      port: 3000,
      neo4j: { uri: 'bolt://localhost:7687' }
    };

    const invalidConfig = {
      port: '3000', // Should be number
      neo4j: {}
    };

    expect(validateConfig(validConfig)).toBe(true);
    expect(validateConfig(invalidConfig)).toBe(false);
    expect(validateConfig(null)).toBe(false);
  });

  test('should validate event severity levels', () => {
    const validSeverities = ['critical', 'major', 'minor', 'warning', 'info'];

    const isValidSeverity = (severity) => {
      return validSeverities.includes(severity);
    };

    expect(isValidSeverity('critical')).toBe(true);
    expect(isValidSeverity('invalid')).toBe(false);
    expect(isValidSeverity('')).toBe(false);
    expect(isValidSeverity(null)).toBe(false);
  });

  test('should validate CI types', () => {
    const validCITypes = ['server', 'application', 'database', 'network', 'service'];

    const isValidCIType = (type) => {
      return validCITypes.includes(type);
    };

    expect(isValidCIType('server')).toBe(true);
    expect(isValidCIType('application')).toBe(true);
    expect(isValidCIType('invalid')).toBe(false);
  });

  test('should format timestamps correctly', () => {
    const formatTimestamp = (date) => {
      return date.toISOString();
    };

    const testDate = new Date('2024-01-01T12:00:00Z');
    const formatted = formatTimestamp(testDate);

    expect(formatted).toBe('2024-01-01T12:00:00.000Z');
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe('Test Configuration', () => {
  test('should have global test config available', () => {
    // This test verifies our test setup is working
    expect(global.testConfig).toBeDefined();
    expect(global.testConfig.baseURL).toBeDefined();
    expect(global.testConfig.testBaseURL).toBeDefined();
    expect(global.testConfig.neo4jURI).toBeDefined();
  });

  test('should have valid timeout configuration', () => {
    expect(global.testConfig.timeout).toBeDefined();
    expect(global.testConfig.timeout.short).toBeGreaterThan(0);
    expect(global.testConfig.timeout.medium).toBeGreaterThan(global.testConfig.timeout.short);
    expect(global.testConfig.timeout.long).toBeGreaterThan(global.testConfig.timeout.medium);
  });
});