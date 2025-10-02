/**
 * Unit Tests for Queue Service
 * Tests Redis queue management and job processing
 */

// Mock dependencies before requiring the service
jest.mock('bull');
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    quit: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn()
  }
}));

const queueService = require('../../src/services/queueService');
const Bull = require('bull');
const redis = require('redis');

describe('Queue Service', () => {
  let mockQueue;
  let mockRedisClient;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock queue
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
      process: jest.fn(),
      getJob: jest.fn(),
      getJobs: jest.fn().mockResolvedValue([]),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0
      }),
      clean: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    };

    Bull.mockImplementation(() => mockQueue);

    // Setup mock Redis client
    mockRedisClient = redis.createClient();
  });

  describe('Scale Configurations', () => {
    it('should export SCALE_CONFIGS constant', () => {
      expect(queueService.SCALE_CONFIGS).toBeDefined();
      expect(typeof queueService.SCALE_CONFIGS).toBe('object');
    });

    it('should have all scale sizes defined', () => {
      const { SCALE_CONFIGS } = queueService;

      expect(SCALE_CONFIGS).toHaveProperty('small');
      expect(SCALE_CONFIGS).toHaveProperty('medium');
      expect(SCALE_CONFIGS).toHaveProperty('large');
      expect(SCALE_CONFIGS).toHaveProperty('enterprise');
    });

    it('should have valid small scale configuration', () => {
      const { small } = queueService.SCALE_CONFIGS;

      expect(small.totalCIs).toBe(1000);
      expect(small.name).toBe('Small Demo');
      expect(small.regionsCount).toBeDefined();
      expect(small.estimatedDuration).toBeDefined();
    });

    it('should have valid medium scale configuration', () => {
      const { medium } = queueService.SCALE_CONFIGS;

      expect(medium.totalCIs).toBe(10000);
      expect(medium.name).toBe('Medium Demo');
      expect(medium.applicationsCount).toBeDefined();
    });

    it('should have valid large scale configuration', () => {
      const { large } = queueService.SCALE_CONFIGS;

      expect(large.totalCIs).toBe(100000);
      expect(large.name).toBe('Large Demo');
      expect(large.databasesCount).toBeDefined();
    });

    it('should have clearExisting flag in configurations', () => {
      const { SCALE_CONFIGS } = queueService;

      Object.values(SCALE_CONFIGS).forEach(config => {
        expect(config).toHaveProperty('clearExisting');
        expect(typeof config.clearExisting).toBe('boolean');
      });
    });

    it('should have increasing CI counts across scales', () => {
      const { SCALE_CONFIGS } = queueService;

      expect(SCALE_CONFIGS.small.totalCIs).toBeLessThan(SCALE_CONFIGS.medium.totalCIs);
      expect(SCALE_CONFIGS.medium.totalCIs).toBeLessThan(SCALE_CONFIGS.large.totalCIs);
    });
  });

  describe('initializeRedis', () => {
    it('should initialize Redis connection', async () => {
      await queueService.initializeRedis();

      expect(redis.createClient).toHaveBeenCalledWith({
        url: expect.stringContaining('redis://localhost:6379')
      });
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should use REDIS_URL environment variable', async () => {
      process.env.REDIS_URL = 'redis://custom-host:6380';

      // Need to reload module to pick up env var
      jest.resetModules();
      const queueServiceReloaded = require('../../src/services/queueService');

      await queueServiceReloaded.initializeRedis();

      expect(redis.createClient).toHaveBeenCalled();

      delete process.env.REDIS_URL;
    });

    it('should handle connection errors', async () => {
      mockRedisClient.connect.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(queueService.initializeRedis()).rejects.toThrow('Connection refused');
    });
  });

  describe('createDataGenerationJob', () => {
    beforeEach(async () => {
      await queueService.initializeRedis();
    });

    it('should add job to queue with correct parameters', async () => {
      const jobParams = {
        scale: 'small',
        clearExisting: false
      };

      const job = await queueService.createDataGenerationJob(jobParams);

      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          scale: 'small',
          clearExisting: false,
          jobId: expect.any(String)
        })
      );
      expect(job.id).toBe('job-123');
    });

    it('should generate unique job IDs', async () => {
      const addCalls = [];

      for (let i = 0; i < 5; i++) {
        await queueService.createDataGenerationJob({ scale: 'small' });
        addCalls.push(mockQueue.add.mock.calls[i][0].jobId);
      }

      // All job IDs should be unique
      const uniqueIds = new Set(addCalls);
      expect(uniqueIds.size).toBe(5);
    });

    it('should handle different scale sizes', async () => {
      const scales = ['small', 'medium', 'large', 'enterprise'];

      for (const scale of scales) {
        await queueService.createDataGenerationJob({ scale });
      }

      expect(mockQueue.add).toHaveBeenCalledTimes(scales.length);
    });

    it('should include timestamp in job data', async () => {
      const beforeTime = Date.now();
      await queueService.createDataGenerationJob({ scale: 'medium' });
      const afterTime = Date.now();

      const jobData = mockQueue.add.mock.calls[0][0];
      expect(jobData.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(jobData.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('getJobStatus', () => {
    beforeEach(async () => {
      await queueService.initializeRedis();
    });

    it('should retrieve job by ID', async () => {
      const mockJob = {
        id: 'job-123',
        data: { scale: 'small' },
        progress: () => 50,
        getState: jest.fn().mockResolvedValue('active')
      };

      mockQueue.getJob.mockResolvedValueOnce(mockJob);

      const status = await queueService.getJobStatus('job-123');

      expect(mockQueue.getJob).toHaveBeenCalledWith('job-123');
      expect(status).toMatchObject({
        id: 'job-123',
        state: 'active',
        progress: 50
      });
    });

    it('should handle non-existent jobs', async () => {
      mockQueue.getJob.mockResolvedValueOnce(null);

      const status = await queueService.getJobStatus('non-existent');

      expect(status).toBeNull();
    });

    it('should include job data in status', async () => {
      const mockJob = {
        id: 'job-456',
        data: { scale: 'large', clearExisting: true },
        progress: () => 75,
        getState: jest.fn().mockResolvedValue('completed')
      };

      mockQueue.getJob.mockResolvedValueOnce(mockJob);

      const status = await queueService.getJobStatus('job-456');

      expect(status.data).toEqual({ scale: 'large', clearExisting: true });
    });
  });

  describe('getQueueStats', () => {
    beforeEach(async () => {
      await queueService.initializeRedis();
    });

    it('should retrieve queue statistics', async () => {
      mockQueue.getJobCounts.mockResolvedValueOnce({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3
      });

      const stats = await queueService.getQueueStats();

      expect(stats).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3
      });
    });

    it('should handle empty queue', async () => {
      mockQueue.getJobCounts.mockResolvedValueOnce({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0
      });

      const stats = await queueService.getQueueStats();

      expect(stats.waiting).toBe(0);
      expect(stats.active).toBe(0);
    });
  });

  describe('cleanupOldJobs', () => {
    beforeEach(async () => {
      await queueService.initializeRedis();
    });

    it('should export cleanup function', () => {
      expect(queueService).toHaveProperty('cleanupOldJobs');
      expect(typeof queueService.cleanupOldJobs).toBe('function');
    });
  });

  describe('Job Progress Tracking', () => {
    beforeEach(async () => {
      await queueService.initializeRedis();
    });

    it('should store progress in Redis', async () => {
      const jobId = 'job-789';
      const progressData = {
        percent: 50,
        phase: 'Creating servers',
        itemsProcessed: 500,
        totalItems: 1000
      };

      await queueService.updateJobProgress(jobId, progressData);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringContaining(jobId),
        JSON.stringify(progressData)
      );
    });

    it('should retrieve progress from Redis', async () => {
      const jobId = 'job-789';
      const progressData = {
        percent: 75,
        phase: 'Creating relationships'
      };

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(progressData));

      const progress = await queueService.getJobProgress(jobId);

      expect(progress).toEqual(progressData);
    });

    it('should handle missing progress data', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const progress = await queueService.getJobProgress('non-existent');

      expect(progress).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle queue add failures', async () => {
      await queueService.initializeRedis();
      mockQueue.add.mockRejectedValueOnce(new Error('Queue full'));

      await expect(
        queueService.createDataGenerationJob({ scale: 'small' })
      ).rejects.toThrow('Queue full');
    });

    it('should handle getJob failures', async () => {
      await queueService.initializeRedis();
      mockQueue.getJob.mockRejectedValueOnce(new Error('Job not found'));

      await expect(
        queueService.getJobStatus('bad-id')
      ).rejects.toThrow('Job not found');
    });

    it('should handle Redis connection failures gracefully', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('Redis unavailable'));

      await expect(
        queueService.getJobProgress('job-123')
      ).rejects.toThrow('Redis unavailable');
    });
  });

  describe('Module Exports', () => {
    it('should export required functions', () => {
      expect(queueService).toHaveProperty('initializeRedis');
      expect(queueService).toHaveProperty('createDataGenerationJob');
      expect(queueService).toHaveProperty('getJobStatus');
      expect(queueService).toHaveProperty('getQueueStats');
      expect(queueService).toHaveProperty('SCALE_CONFIGS');
    });

    it('should have function type exports', () => {
      expect(typeof queueService.initializeRedis).toBe('function');
      expect(typeof queueService.createDataGenerationJob).toBe('function');
      expect(typeof queueService.getJobStatus).toBe('function');
      expect(typeof queueService.getQueueStats).toBe('function');
    });

    it('should have SCALE_CONFIGS object', () => {
      expect(typeof queueService.SCALE_CONFIGS).toBe('object');
      expect(queueService.SCALE_CONFIGS).not.toBeNull();
    });
  });
});
