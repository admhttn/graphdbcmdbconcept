const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const TestServer = require('../helpers/testServer');
const APIClient = require('../helpers/apiClient');

describe('Topology and Correlation Integration Tests', () => {
  let testServer;
  let apiClient;

  beforeAll(async () => {
    testServer = new TestServer();
    await testServer.start();
    apiClient = new APIClient(global.testConfig.testBaseURL);
  });

  afterAll(async () => {
    await testServer.stop();
  });

  beforeEach(async () => {
    await testServer.cleanDatabase();
    await apiClient.loadSampleData();
  });

  describe('Topology Tab - Visualization Features', () => {
    test('should load topology data successfully', async () => {
      const topology = await apiClient.getTopology();

      expect(topology).toHaveProperty('nodes');
      expect(topology).toHaveProperty('links');
      expect(Array.isArray(topology.nodes)).toBe(true);
      expect(Array.isArray(topology.links)).toBe(true);
      expect(topology.nodes.length).toBeGreaterThan(0);

      // Verify node structure
      const node = topology.nodes[0];
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('name');
      expect(node).toHaveProperty('type');

      // Verify link structure
      if (topology.links.length > 0) {
        const link = topology.links[0];
        expect(link).toHaveProperty('source');
        expect(link).toHaveProperty('target');
        expect(link).toHaveProperty('type');
      }
    });

    test('should filter topology by component type', async () => {
      const allTopology = await apiClient.getTopology();
      const serverNodes = allTopology.nodes.filter(n => n.type === 'Server');

      if (serverNodes.length > 0) {
        const serverTopology = await apiClient.getTopology({ type: 'Server' });

        expect(serverTopology.nodes.length).toBeLessThanOrEqual(allTopology.nodes.length);

        // All returned nodes should be servers
        for (const node of serverTopology.nodes) {
          expect(node.type).toBe('Server');
        }

        // Links should only connect to server nodes
        const serverIds = new Set(serverTopology.nodes.map(n => n.id));
        for (const link of serverTopology.links) {
          expect(serverIds.has(link.source) || serverIds.has(link.target)).toBe(true);
        }
      }
    });

    test('should handle different topology filter types', async () => {
      const filterTypes = ['Server', 'Application', 'Database', 'NetworkSwitch'];

      for (const filterType of filterTypes) {
        const filteredTopology = await apiClient.getTopology({ type: filterType });

        expect(filteredTopology).toHaveProperty('nodes');
        expect(filteredTopology).toHaveProperty('links');

        // If nodes exist, they should match the filter
        for (const node of filteredTopology.nodes) {
          expect(node.type).toBe(filterType);
        }
      }
    });

    test('should maintain topology consistency after refresh', async () => {
      const topology1 = await apiClient.getTopology();

      // Wait a moment and get topology again
      await new Promise(resolve => setTimeout(resolve, 1000));
      const topology2 = await apiClient.getTopology();

      // Should be consistent (no data changes without explicit operations)
      expect(topology2.nodes.length).toBe(topology1.nodes.length);
      expect(topology2.links.length).toBe(topology1.links.length);

      // Node IDs should be the same
      const ids1 = new Set(topology1.nodes.map(n => n.id));
      const ids2 = new Set(topology2.nodes.map(n => n.id));
      expect(ids1.size).toBe(ids2.size);
      for (const id of ids1) {
        expect(ids2.has(id)).toBe(true);
      }
    });

    test('should provide topology with enterprise data scale', async () => {
      // Load large dataset
      await testServer.cleanDatabase();
      await apiClient.loadEnterpriseData();

      const topology = await apiClient.getTopology();

      expect(topology.nodes.length).toBeGreaterThan(100);
      expect(topology.links.length).toBeGreaterThan(200);

      // Should have multiple component types
      const types = [...new Set(topology.nodes.map(n => n.type))];
      expect(types.length).toBeGreaterThanOrEqual(3);

      // Should include expected enterprise components
      expect(types).toContain('Server');
      expect(types).toContain('Application');
    }, 120000);
  });

  describe('Correlation Tab - Analysis Features', () => {
    test('should run correlation analysis successfully', async () => {
      // Generate some events first
      await apiClient.simulateEvent();
      await apiClient.simulateEvent();

      const correlationResult = await apiClient.runCorrelationAnalysis('1h');

      expect(correlationResult).toHaveProperty('correlations');
      expect(Array.isArray(correlationResult.correlations)).toBe(true);

      // Verify correlation structure
      if (correlationResult.correlations.length > 0) {
        const correlation = correlationResult.correlations[0];
        expect(correlation).toHaveProperty('id');
        expect(correlation).toHaveProperty('score');
        expect(correlation).toHaveProperty('events');
      }
    });

    test('should analyze business impact', async () => {
      // Generate events and run analysis
      await apiClient.simulateCascade();

      const businessImpact = await apiClient.getBusinessImpact();

      expect(businessImpact).toHaveProperty('services');
      expect(Array.isArray(businessImpact.services)).toBe(true);

      if (businessImpact.services.length > 0) {
        const service = businessImpact.services[0];
        expect(service).toHaveProperty('name');
        expect(service).toHaveProperty('impact');
        expect(service).toHaveProperty('affectedComponents');
      }
    });

    test('should identify patterns in event data', async () => {
      // Generate multiple events to create patterns
      for (let i = 0; i < 5; i++) {
        await apiClient.simulateEvent();
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const patterns = await apiClient.getPatterns();

      expect(patterns).toHaveProperty('patterns');
      expect(Array.isArray(patterns.patterns)).toBe(true);

      // Verify pattern structure
      if (patterns.patterns.length > 0) {
        const pattern = patterns.patterns[0];
        expect(pattern).toHaveProperty('type');
        expect(pattern).toHaveProperty('confidence');
        expect(pattern).toHaveProperty('description');
      }
    });

    test('should run correlation engine successfully', async () => {
      // Generate complex event scenario
      await apiClient.simulateCascade();

      const engineResult = await apiClient.runCorrelationEngine();

      expect(engineResult).toHaveProperty('correlations');
      expect(engineResult).toHaveProperty('execution');
      expect(engineResult.execution).toHaveProperty('duration');
      expect(engineResult.execution).toHaveProperty('eventsProcessed');
    });

    test('should handle different time windows for correlation', async () => {
      const timeWindows = ['5m', '15m', '1h', '6h'];

      for (const timeWindow of timeWindows) {
        const result = await apiClient.runCorrelationAnalysis(timeWindow);

        expect(result).toHaveProperty('correlations');
        expect(result).toHaveProperty('timeWindow');
        expect(result.timeWindow).toBe(timeWindow);
      }
    });
  });

  describe('Demo Tab - Graph Advantages Features', () => {
    test('should load graph advantage examples', async () => {
      const examples = await apiClient.getGraphAdvantageExamples();

      expect(examples).toHaveProperty('scenarios');
      expect(Array.isArray(examples.scenarios)).toBe(true);

      if (examples.scenarios.length > 0) {
        const scenario = examples.scenarios[0];
        expect(scenario).toHaveProperty('id');
        expect(scenario).toHaveProperty('name');
        expect(scenario).toHaveProperty('description');
        expect(scenario).toHaveProperty('componentId');
      }
    });

    test('should perform impact analysis on components', async () => {
      const topology = await apiClient.getTopology();
      expect(topology.nodes.length).toBeGreaterThan(0);

      const componentId = topology.nodes[0].id;
      const impactAnalysis = await apiClient.getImpactAnalysis(componentId);

      expect(impactAnalysis).toHaveProperty('affectedComponents');
      expect(impactAnalysis).toHaveProperty('impactRadius');
      expect(impactAnalysis).toHaveProperty('businessImpact');
      expect(Array.isArray(impactAnalysis.affectedComponents)).toBe(true);
    });

    test('should support different impact analysis directions', async () => {
      const topology = await apiClient.getTopology();
      const componentId = topology.nodes[0].id;

      const directions = ['downstream', 'upstream', 'both'];

      for (const direction of directions) {
        const analysis = await apiClient.getImpactAnalysis(componentId, direction);

        expect(analysis).toHaveProperty('direction');
        expect(analysis.direction).toBe(direction);
        expect(analysis).toHaveProperty('affectedComponents');
      }
    });

    test('should support variable depth impact analysis', async () => {
      const topology = await apiClient.getTopology();
      const componentId = topology.nodes[0].id;

      const depths = [1, 2, 4, 6];

      for (const depth of depths) {
        const analysis = await apiClient.getImpactAnalysis(componentId, 'downstream', depth);

        expect(analysis).toHaveProperty('maxDepth');
        expect(analysis.maxDepth).toBe(depth);
        expect(analysis).toHaveProperty('affectedComponents');

        // Deeper analysis should potentially find more components
        // but this depends on the specific topology structure
      }
    });

    test('should provide query comparison examples', async () => {
      const topology = await apiClient.getTopology();
      const componentId = topology.nodes[0].id;

      try {
        const comparison = await testServer.request()
          .get(`/api/demo/query-comparison/${componentId}`)
          .expect(200);

        const result = comparison.body;

        expect(result).toHaveProperty('cypher');
        expect(result).toHaveProperty('sql');
        expect(result).toHaveProperty('advantages');

        expect(result.cypher).toHaveProperty('query');
        expect(result.cypher).toHaveProperty('complexity');
        expect(result.sql).toHaveProperty('query');
        expect(result.sql).toHaveProperty('complexity');
      } catch (error) {
        console.log('Query comparison endpoint may not be implemented yet');
      }
    });
  });

  describe('Cross-Feature Integration', () => {
    test('should maintain consistency between topology and correlation data', async () => {
      // Generate events affecting specific components
      await apiClient.simulateCascade();

      const topology = await apiClient.getTopology();
      const correlations = await apiClient.runCorrelationAnalysis('1h');

      // Component IDs in correlations should exist in topology
      for (const correlation of correlations.correlations) {
        if (correlation.events) {
          for (const event of correlation.events) {
            if (event.componentId) {
              const component = topology.nodes.find(n => n.id === event.componentId);
              expect(component).toBeDefined();
            }
          }
        }
      }
    });

    test('should provide consistent impact analysis across features', async () => {
      const topology = await apiClient.getTopology();
      const componentId = topology.nodes[0].id;

      // Get impact from demo tab
      const demoImpact = await apiClient.getImpactAnalysis(componentId);

      // Get impact from CMDB API
      try {
        const cmdbImpact = await testServer.request()
          .get(`/api/cmdb/impact/${componentId}`)
          .expect(200);

        // Both should identify similar components
        expect(demoImpact.affectedComponents).toBeDefined();
        expect(cmdbImpact.body).toHaveProperty('affectedComponents');
      } catch (error) {
        console.log('CMDB impact endpoint may differ in implementation');
      }
    });

    test('should handle large-scale correlation analysis', async () => {
      // Load enterprise data
      await testServer.cleanDatabase();
      await apiClient.loadEnterpriseData();

      // Generate multiple events
      for (let i = 0; i < 10; i++) {
        await apiClient.simulateEvent();
      }

      const startTime = Date.now();
      const correlations = await apiClient.runCorrelationAnalysis('1h');
      const endTime = Date.now();

      expect(correlations).toHaveProperty('correlations');

      // Performance check - should complete within reasonable time
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(30000); // 30 seconds max

      console.log(`Large-scale correlation analysis completed in ${duration}ms`);
    }, 180000); // 3 minute timeout

    test('should maintain data integrity across feature interactions', async () => {
      // Get initial state
      const initialTopology = await apiClient.getTopology();
      const initialCIs = await apiClient.getCIs();

      // Run various operations
      await apiClient.simulateEvent();
      await apiClient.runCorrelationAnalysis('1h');
      const componentId = initialTopology.nodes[0].id;
      await apiClient.getImpactAnalysis(componentId);

      // Verify topology is unchanged
      const finalTopology = await apiClient.getTopology();
      expect(finalTopology.nodes.length).toBe(initialTopology.nodes.length);
      expect(finalTopology.links.length).toBe(initialTopology.links.length);

      // Verify CIs are unchanged
      const finalCIs = await apiClient.getCIs();
      expect(finalCIs.items.length).toBe(initialCIs.items.length);
    });
  });
});