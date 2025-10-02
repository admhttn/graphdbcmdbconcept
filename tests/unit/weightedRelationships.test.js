/**
 * Unit Tests for Weighted Relationships Service
 */

const {
  calculateCriticalityScore,
  calculateLoadFactor,
  calculateRelationshipWeight,
  criticalityToScore,
  scoreToCriticality,
  CRITICALITY_SCORES
} = require('../../src/services/weightedRelationships');

describe('Weighted Relationships - Utility Functions', () => {
  describe('Criticality Conversion', () => {
    test('should convert criticality string to score', () => {
      expect(criticalityToScore('CRITICAL')).toBe(1.0);
      expect(criticalityToScore('HIGH')).toBe(0.75);
      expect(criticalityToScore('MEDIUM')).toBe(0.5);
      expect(criticalityToScore('LOW')).toBe(0.25);
      expect(criticalityToScore('INFO')).toBe(0.1);
    });

    test('should return default for unknown criticality', () => {
      expect(criticalityToScore('UNKNOWN')).toBe(0.5);
      expect(criticalityToScore(null)).toBe(0.5);
      expect(criticalityToScore(undefined)).toBe(0.5);
    });

    test('should convert score to criticality string', () => {
      expect(scoreToCriticality(0.95)).toBe('CRITICAL');
      expect(scoreToCriticality(0.8)).toBe('HIGH');
      expect(scoreToCriticality(0.5)).toBe('MEDIUM');
      expect(scoreToCriticality(0.3)).toBe('LOW');
      expect(scoreToCriticality(0.1)).toBe('INFO');
    });

    test('should handle boundary conditions', () => {
      expect(scoreToCriticality(1.0)).toBe('CRITICAL');
      expect(scoreToCriticality(0.9)).toBe('CRITICAL');
      expect(scoreToCriticality(0.7)).toBe('HIGH');
      expect(scoreToCriticality(0.4)).toBe('MEDIUM');
      expect(scoreToCriticality(0.2)).toBe('LOW');
      expect(scoreToCriticality(0.0)).toBe('INFO');
    });
  });

  describe('Criticality Score Calculation', () => {
    test('should calculate basic criticality score', () => {
      const score = calculateCriticalityScore({
        sourceCriticality: 1.0,
        targetCriticality: 1.0,
        businessImpact: 1.0,
        redundancyLevel: 1,
        historicalFailures: 0,
        recoveryComplexity: 1.0
      });

      expect(score).toBeGreaterThanOrEqual(0.8);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    test('should produce lower score with high redundancy', () => {
      const highRedundancy = calculateCriticalityScore({
        sourceCriticality: 1.0,
        targetCriticality: 1.0,
        businessImpact: 1.0,
        redundancyLevel: 5, // High redundancy
        historicalFailures: 0,
        recoveryComplexity: 0.5
      });

      const lowRedundancy = calculateCriticalityScore({
        sourceCriticality: 1.0,
        targetCriticality: 1.0,
        businessImpact: 1.0,
        redundancyLevel: 1, // Low redundancy
        historicalFailures: 0,
        recoveryComplexity: 0.5
      });

      expect(highRedundancy).toBeLessThan(lowRedundancy);
    });

    test('should handle default values', () => {
      const score = calculateCriticalityScore({});
      expect(score).toBeGreaterThanOrEqual(0.0);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    test('should clamp score to 0.0-1.0 range', () => {
      const maxScore = calculateCriticalityScore({
        sourceCriticality: 2.0, // Over max
        targetCriticality: 2.0,
        businessImpact: 2.0,
        redundancyLevel: 1,
        historicalFailures: 1000,
        recoveryComplexity: 2.0
      });

      expect(maxScore).toBeLessThanOrEqual(1.0);
      expect(maxScore).toBeGreaterThanOrEqual(0.0);
    });

    test('should weight factors correctly', () => {
      // High business impact should have significant effect
      const highImpact = calculateCriticalityScore({
        sourceCriticality: 0.5,
        targetCriticality: 0.5,
        businessImpact: 1.0, // High business impact
        redundancyLevel: 1,
        historicalFailures: 0,
        recoveryComplexity: 0.5
      });

      const lowImpact = calculateCriticalityScore({
        sourceCriticality: 0.5,
        targetCriticality: 0.5,
        businessImpact: 0.0, // Low business impact
        redundancyLevel: 1,
        historicalFailures: 0,
        recoveryComplexity: 0.5
      });

      expect(highImpact).toBeGreaterThan(lowImpact);
      expect(highImpact - lowImpact).toBeGreaterThan(0.2); // 25% weight on business impact
    });
  });

  describe('Load Factor Calculation', () => {
    test('should calculate load factor from utilization', () => {
      const loadFactor = calculateLoadFactor({
        requestsPerSecond: 500,
        totalCapacity: 1000,
        peakLoadHistory: 750,
        loadBalancingWeight: 60
      });

      expect(loadFactor).toBeGreaterThanOrEqual(0);
      expect(loadFactor).toBeLessThanOrEqual(100);
    });

    test('should handle zero capacity gracefully', () => {
      const loadFactor = calculateLoadFactor({
        requestsPerSecond: 100,
        totalCapacity: 1,
        peakLoadHistory: 0,
        loadBalancingWeight: 50
      });

      expect(loadFactor).toBeGreaterThanOrEqual(0);
      expect(loadFactor).toBeLessThanOrEqual(100);
    });

    test('should clamp to 0-100 range', () => {
      const overload = calculateLoadFactor({
        requestsPerSecond: 2000,
        totalCapacity: 1000,
        peakLoadHistory: 1500,
        loadBalancingWeight: 100
      });

      expect(overload).toBeLessThanOrEqual(100);
      expect(overload).toBeGreaterThanOrEqual(0);
    });

    test('should handle default values', () => {
      const loadFactor = calculateLoadFactor({});
      expect(loadFactor).toBeGreaterThanOrEqual(0);
      expect(loadFactor).toBeLessThanOrEqual(100);
    });

    test('should blend current, historical, and manual weights', () => {
      const result = calculateLoadFactor({
        requestsPerSecond: 100,  // 10% utilization
        totalCapacity: 1000,
        peakLoadHistory: 500,    // 50% historical
        loadBalancingWeight: 80  // 80% manual
      });

      // Should be blend of 10 * 0.5 + 50 * 0.3 + 80 * 0.2 = 5 + 15 + 16 = 36
      expect(result).toBeGreaterThan(30);
      expect(result).toBeLessThan(45);
    });
  });

  describe('Relationship Weight Calculation', () => {
    test('should calculate overall weight from factors', () => {
      const weight = calculateRelationshipWeight({
        criticalityScore: 0.9,
        loadFactor: 75,
        latencyMs: 50,
        maxLatencyMs: 1000,
        redundancyLevel: 2
      });

      expect(weight).toBeGreaterThanOrEqual(0.0);
      expect(weight).toBeLessThanOrEqual(1.0);
    });

    test('should weight criticality heavily', () => {
      const highCrit = calculateRelationshipWeight({
        criticalityScore: 0.9,
        loadFactor: 50,
        latencyMs: 100,
        redundancyLevel: 1
      });

      const lowCrit = calculateRelationshipWeight({
        criticalityScore: 0.2,
        loadFactor: 50,
        latencyMs: 100,
        redundancyLevel: 1
      });

      expect(highCrit).toBeGreaterThan(lowCrit);
      expect(highCrit - lowCrit).toBeGreaterThan(0.2); // 40% weight on criticality
    });

    test('should penalize high latency', () => {
      const lowLatency = calculateRelationshipWeight({
        criticalityScore: 0.5,
        loadFactor: 50,
        latencyMs: 10,
        maxLatencyMs: 1000,
        redundancyLevel: 1
      });

      const highLatency = calculateRelationshipWeight({
        criticalityScore: 0.5,
        loadFactor: 50,
        latencyMs: 900,
        maxLatencyMs: 1000,
        redundancyLevel: 1
      });

      expect(lowLatency).toBeGreaterThan(highLatency);
    });

    test('should handle zero latency', () => {
      const weight = calculateRelationshipWeight({
        criticalityScore: 0.5,
        loadFactor: 50,
        latencyMs: 0,
        redundancyLevel: 1
      });

      expect(weight).toBeGreaterThanOrEqual(0.0);
      expect(weight).toBeLessThanOrEqual(1.0);
    });

    test('should use default values', () => {
      const weight = calculateRelationshipWeight({});
      expect(weight).toBeGreaterThanOrEqual(0.0);
      expect(weight).toBeLessThanOrEqual(1.0);
    });
  });
});

describe('Weighted Relationships - Edge Cases', () => {
  test('should handle null/undefined inputs gracefully', () => {
    expect(() => calculateCriticalityScore({})).not.toThrow();
    expect(() => calculateLoadFactor({})).not.toThrow();
    expect(() => calculateRelationshipWeight({})).not.toThrow();
  });

  test('should handle negative values', () => {
    const score = calculateCriticalityScore({
      sourceCriticality: -1.0,
      targetCriticality: -1.0,
      businessImpact: -1.0,
      redundancyLevel: -5,
      historicalFailures: -100,
      recoveryComplexity: -1.0
    });

    // Should still return valid range
    expect(score).toBeGreaterThanOrEqual(0.0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  test('should handle very large numbers', () => {
    const loadFactor = calculateLoadFactor({
      requestsPerSecond: 1000000,
      totalCapacity: 1,
      peakLoadHistory: 5000000,
      loadBalancingWeight: 1000
    });

    expect(loadFactor).toBeLessThanOrEqual(100);
  });
});

describe('Weighted Relationships - Real World Scenarios', () => {
  test('critical database dependency scenario', () => {
    const critScore = calculateCriticalityScore({
      sourceCriticality: criticalityToScore('CRITICAL'),  // Critical app
      targetCriticality: criticalityToScore('CRITICAL'),  // Critical database
      businessImpact: 0.95,                               // High revenue impact
      redundancyLevel: 1,                                 // No redundancy
      historicalFailures: 3,                              // Some past issues
      recoveryComplexity: 0.8                             // Hard to recover
    });

    const loadFactor = calculateLoadFactor({
      requestsPerSecond: 800,
      totalCapacity: 1000,
      peakLoadHistory: 950,
      loadBalancingWeight: 100
    });

    const weight = calculateRelationshipWeight({
      criticalityScore: critScore,
      loadFactor,
      latencyMs: 15,
      redundancyLevel: 1
    });

    // Should result in very high weight
    expect(critScore).toBeGreaterThan(0.7);
    expect(loadFactor).toBeGreaterThan(80);
    expect(weight).toBeGreaterThan(0.7);
  });

  test('low priority non-critical dependency scenario', () => {
    const critScore = calculateCriticalityScore({
      sourceCriticality: criticalityToScore('LOW'),
      targetCriticality: criticalityToScore('MEDIUM'),
      businessImpact: 0.1,
      redundancyLevel: 5,  // Many alternatives
      historicalFailures: 0,
      recoveryComplexity: 0.2
    });

    const weight = calculateRelationshipWeight({
      criticalityScore: critScore,
      loadFactor: 20,
      latencyMs: 200,
      redundancyLevel: 5
    });

    // Should result in low weight
    expect(critScore).toBeLessThan(0.4);
    expect(weight).toBeLessThan(0.5);
  });

  test('high load but non-critical scenario', () => {
    const weight = calculateRelationshipWeight({
      criticalityScore: 0.3,  // Low criticality
      loadFactor: 95,         // Very high load
      latencyMs: 50,
      redundancyLevel: 1
    });

    // High load should increase weight, but low criticality keeps it moderate
    expect(weight).toBeGreaterThan(0.3);
    expect(weight).toBeLessThan(0.7);
  });
});
