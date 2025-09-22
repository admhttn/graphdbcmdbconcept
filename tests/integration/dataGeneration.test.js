const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const TestServer = require('../helpers/testServer');
const APIClient = require('../helpers/apiClient');

describe('Data Generation Integration Tests', () => {
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
  });

  describe('Demo Tab - Direct Data Generation', () => {
    test('should load sample data successfully', async () => {
      // Test the demo tab sample data loading
      const result = await apiClient.loadSampleData();

      expect(result).toHaveProperty('message');
      expect(result.message).toContain('Sample CMDB data loaded successfully');

      // Verify data was actually created
      const cis = await apiClient.getCIs();
      expect(cis.items).toBeDefined();
      expect(cis.items.length).toBeGreaterThan(0);

      // Verify topology relationships
      const topology = await apiClient.getTopology();
      expect(topology.nodes).toBeDefined();
      expect(topology.links).toBeDefined();
      expect(topology.nodes.length).toBeGreaterThan(0);
    });

    test('should load enterprise data successfully', async () => {
      // Test the demo tab enterprise data loading
      const result = await apiClient.loadEnterpriseData();

      expect(result).toHaveProperty('totalCIs');
      expect(result).toHaveProperty('totalRelationships');
      expect(result).toHaveProperty('datacenters');
      expect(result.totalCIs).toBeGreaterThan(10000); // Should be 17k+

      // Verify large dataset was created
      const cis = await apiClient.getCIs();
      expect(cis.totalCount).toBeGreaterThan(10000);

      // Verify enterprise-scale topology
      const topology = await apiClient.getTopology();
      expect(topology.nodes.length).toBeGreaterThan(100);
      expect(topology.links.length).toBeGreaterThan(200);
    }, 120000); // 2 minute timeout for large data generation

    test('should handle concurrent data generation requests gracefully', async () => {
      // Test multiple simultaneous requests
      const promises = [
        apiClient.loadSampleData(),
        apiClient.loadSampleData(),
        apiClient.loadSampleData()
      ];

      const results = await Promise.allSettled(promises);

      // At least one should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThanOrEqual(1);

      // Verify final state is consistent
      const cis = await apiClient.getCIs();
      expect(cis.items).toBeDefined();
    });
  });

  describe('Data Generation Tab - Worker-based Generation', () => {
    test('should create small scale job successfully', async () => {
      const jobData = { scale: 'small' };
      const job = await apiClient.createJob(jobData);

      expect(job).toHaveProperty('jobId');
      expect(job).toHaveProperty('queueId');
      expect(job.scale).toBe('small');
      expect(job.status).toBe('queued');

      // Wait for job to start processing
      await waitFor(async () => {
        const jobStatus = await apiClient.getJob(job.jobId);
        return jobStatus && (jobStatus.status === 'active' || jobStatus.status === 'completed');
      }, 30000);

      const finalJob = await apiClient.getJob(job.jobId);
      expect(['active', 'completed', 'failed']).toContain(finalJob.status);
    });

    test('should track job progress correctly', async () => {
      const job = await apiClient.createJob({ scale: 'small' });

      // Monitor job progress
      let progressUpdates = [];
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds

      while (attempts < maxAttempts) {
        try {
          const jobStatus = await apiClient.getJob(job.jobId);
          progressUpdates.push({
            timestamp: Date.now(),
            status: jobStatus.status,
            progress: jobStatus.progress || 0
          });

          if (jobStatus.status === 'completed' || jobStatus.status === 'failed') {
            break;
          }
        } catch (error) {
          console.log('Job status check failed:', error.message);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      expect(progressUpdates.length).toBeGreaterThan(0);

      // Verify progress was tracked
      const finalUpdate = progressUpdates[progressUpdates.length - 1];
      expect(['completed', 'failed', 'active']).toContain(finalUpdate.status);
    });

    test('should handle job cancellation', async () => {
      const job = await apiClient.createJob({ scale: 'medium' });

      // Wait a moment for job to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Cancel the job
      const result = await apiClient.cancelJob(job.jobId);
      expect(result).toHaveProperty('message');

      // Verify job is cancelled
      await waitFor(async () => {
        try {
          const jobStatus = await apiClient.getJob(job.jobId);
          return jobStatus.status === 'cancelled' || jobStatus.status === 'failed';
        } catch (error) {
          // Job might be removed from queue after cancellation
          return true;
        }
      }, 10000);
    });

    test('should provide accurate queue statistics', async () => {
      // Get initial stats
      const initialStats = await apiClient.getQueueStats();
      expect(initialStats).toHaveProperty('waiting');
      expect(initialStats).toHaveProperty('active');
      expect(initialStats).toHaveProperty('completed');
      expect(initialStats).toHaveProperty('failed');

      // Create a job
      const job = await apiClient.createJob({ scale: 'small' });

      // Check stats after job creation
      const updatedStats = await apiClient.getQueueStats();
      expect(updatedStats.total).toBeGreaterThanOrEqual(initialStats.total);
    });

    test('should handle invalid job parameters', async () => {
      // Test invalid scale
      const invalidJob = { scale: 'invalid-scale' };

      try {
        await apiClient.createJob(invalidJob);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.status).toBe(500);
      }
    });
  });

  describe('Data Generation Comparison', () => {
    test('should produce consistent data structures between direct and worker-based generation', async () => {
      // Test direct generation
      await testServer.cleanDatabase();
      await apiClient.loadSampleData();
      const directTopology = await apiClient.getTopology();
      const directCIs = await apiClient.getCIs();

      // Test worker-based generation
      await testServer.cleanDatabase();
      const job = await apiClient.createJob({ scale: 'small' });

      // Wait for completion
      await waitFor(async () => {
        try {
          const jobStatus = await apiClient.getJob(job.jobId);
          return jobStatus.status === 'completed';
        } catch (error) {
          return false;
        }
      }, 60000);

      const workerTopology = await apiClient.getTopology();
      const workerCIs = await apiClient.getCIs();

      // Compare data structures
      expect(directTopology).toHaveProperty('nodes');
      expect(directTopology).toHaveProperty('links');
      expect(workerTopology).toHaveProperty('nodes');
      expect(workerTopology).toHaveProperty('links');

      expect(directCIs).toHaveProperty('items');
      expect(workerCIs).toHaveProperty('items');

      // Both should have created some data
      expect(directCIs.items.length).toBeGreaterThan(0);
      expect(workerCIs.items.length).toBeGreaterThan(0);
    }, 90000);

    test('should handle scale differences appropriately', async () => {
      // Test small scale
      const smallJob = await apiClient.createJob({ scale: 'small' });
      await waitFor(async () => {
        try {
          const status = await apiClient.getJob(smallJob.jobId);
          return status.status === 'completed';
        } catch (error) {
          return false;
        }
      }, 60000);

      const smallCIs = await apiClient.getCIs();

      // Clean and test medium scale (if it completes quickly enough)
      await testServer.cleanDatabase();
      const mediumJob = await apiClient.createJob({ scale: 'medium' });

      // Give medium job some time to start
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Cancel medium job to avoid long test time
      await apiClient.cancelJob(mediumJob.jobId);

      // Verify small scale produced reasonable amount of data
      expect(smallCIs.items.length).toBeGreaterThan(50);
      expect(smallCIs.items.length).toBeLessThan(5000);
    }, 90000);
  });
});