const Bull = require('bull');
const redis = require('redis');
const winston = require('winston');
const crypto = require('crypto');

// Use Node.js built-in UUID generator
const uuidv4 = () => crypto.randomUUID();

// Queue configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Logging setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'queue-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Redis client for progress tracking
let redisClient;

// Job queue
const dataGenerationQueue = new Bull('data generation', REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

// Initialize Redis connection
async function initializeRedis() {
  try {
    redisClient = redis.createClient({ url: REDIS_URL });
    await redisClient.connect();
    logger.info('✅ Queue service Redis connection established');
  } catch (error) {
    logger.error('❌ Failed to connect to Redis:', error);
    throw error;
  }
}

// Data generation scale configurations
const SCALE_CONFIGS = {
  small: {
    name: 'Small Demo',
    description: '1,000 CIs - Quick demonstration',
    totalCIs: 1000,
    regionsCount: 2,
    datacentersPerRegion: 2,
    serversPerDatacenter: 50,
    applicationsCount: 200,
    databasesCount: 20,
    eventCount: 500,
    estimatedDuration: '30 seconds',
    clearExisting: false  // Preserve existing data by default
  },
  medium: {
    name: 'Medium Demo',
    description: '10,000 CIs - Comprehensive showcase',
    totalCIs: 10000,
    regionsCount: 3,
    datacentersPerRegion: 3,
    serversPerDatacenter: 200,
    applicationsCount: 2000,
    databasesCount: 200,
    eventCount: 2000,
    estimatedDuration: '5 minutes',
    clearExisting: false  // Preserve existing data by default
  },
  large: {
    name: 'Large Demo',
    description: '100,000 CIs - Enterprise scale',
    totalCIs: 100000,
    regionsCount: 5,
    datacentersPerRegion: 4,
    serversPerDatacenter: 1000,
    applicationsCount: 20000,
    databasesCount: 2000,
    eventCount: 10000,
    estimatedDuration: '30 minutes',
    clearExisting: false  // Preserve existing data by default
  },
  enterprise: {
    name: 'Enterprise Demo',
    description: '500,000 CIs - Massive scale',
    totalCIs: 500000,
    regionsCount: 8,
    datacentersPerRegion: 5,
    serversPerDatacenter: 2500,
    applicationsCount: 100000,
    databasesCount: 10000,
    eventCount: 50000,
    estimatedDuration: '2-3 hours',
    clearExisting: false  // Preserve existing data by default
  }
};

// Create a new data generation job
async function createDataGenerationJob(scale = 'medium', customConfig = {}) {
  try {
    const jobId = uuidv4();
    const config = { ...SCALE_CONFIGS[scale], ...customConfig };

    if (!config) {
      throw new Error(`Invalid scale: ${scale}. Available scales: ${Object.keys(SCALE_CONFIGS).join(', ')}`);
    }

    logger.info(`🚀 Creating data generation job ${jobId} with scale: ${scale}`);

    const job = await dataGenerationQueue.add('generate-enterprise-data', {
      jobId,
      scale,
      config,
      createdAt: new Date().toISOString()
    }, {
      priority: scale === 'enterprise' ? 10 : scale === 'large' ? 5 : 1,
      delay: 0
    });

    // Initialize progress tracking
    await updateJobProgress(jobId, {
      stage: 'queued',
      completed: 0,
      total: 100,
      percentage: 0,
      message: 'Job queued for processing',
      estimatedDuration: config.estimatedDuration,
      scale: config.name,
      totalCIs: config.totalCIs
    });

    return {
      jobId,
      queueId: job.id,
      scale,
      config: {
        name: config.name,
        description: config.description,
        totalCIs: config.totalCIs,
        estimatedDuration: config.estimatedDuration
      },
      status: 'queued',
      createdAt: new Date().toISOString()
    };

  } catch (error) {
    logger.error('❌ Failed to create data generation job:', error);
    throw error;
  }
}

// Get job status and progress
async function getJobStatus(jobId) {
  try {
    // Get progress from Redis
    const progressData = await redisClient.get(`progress:${jobId}`);
    if (!progressData) {
      return null;
    }

    const progress = JSON.parse(progressData);

    // Get job from queue
    const job = await dataGenerationQueue.getJob(jobId);

    return {
      jobId,
      queueId: job?.id,
      status: job ? (job.finishedOn ? 'completed' : job.failedReason ? 'failed' : job.processedOn ? 'active' : 'waiting') : 'unknown',
      progress,
      result: job?.returnvalue,
      error: job?.failedReason,
      createdAt: job?.timestamp,
      startedAt: job?.processedOn,
      completedAt: job?.finishedOn
    };

  } catch (error) {
    logger.error(`❌ Failed to get job status for ${jobId}:`, error);
    throw error;
  }
}

// Update job progress
async function updateJobProgress(jobId, progressData) {
  try {
    await redisClient.setEx(`progress:${jobId}`, 3600, JSON.stringify({
      ...progressData,
      lastUpdated: new Date().toISOString()
    }));
  } catch (error) {
    logger.error(`❌ Failed to update progress for job ${jobId}:`, error);
  }
}

// Get all active jobs
async function getActiveJobs() {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      dataGenerationQueue.getWaiting(),
      dataGenerationQueue.getActive(),
      dataGenerationQueue.getCompleted(),
      dataGenerationQueue.getFailed()
    ]);

    return {
      waiting: waiting.map(job => ({
        id: job.id,
        data: job.data,
        createdAt: job.timestamp
      })),
      active: active.map(job => ({
        id: job.id,
        data: job.data,
        progress: job.progress(),
        startedAt: job.processedOn
      })),
      completed: completed.slice(0, 10).map(job => ({
        id: job.id,
        data: job.data,
        result: job.returnvalue,
        completedAt: job.finishedOn
      })),
      failed: failed.slice(0, 10).map(job => ({
        id: job.id,
        data: job.data,
        error: job.failedReason,
        failedAt: job.failedOn
      }))
    };
  } catch (error) {
    logger.error('❌ Failed to get active jobs:', error);
    throw error;
  }
}

// Cancel a job
async function cancelJob(jobId) {
  try {
    const job = await dataGenerationQueue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.remove();
    await redisClient.del(`progress:${jobId}`);

    logger.info(`🗑️ Job ${jobId} cancelled and removed`);
    return { jobId, status: 'cancelled' };

  } catch (error) {
    logger.error(`❌ Failed to cancel job ${jobId}:`, error);
    throw error;
  }
}

// Get queue statistics
async function getQueueStats() {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      dataGenerationQueue.getWaiting(),
      dataGenerationQueue.getActive(),
      dataGenerationQueue.getCompleted(),
      dataGenerationQueue.getFailed(),
      dataGenerationQueue.getDelayed()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      total: waiting.length + active.length + completed.length + failed.length + delayed.length
    };
  } catch (error) {
    logger.error('❌ Failed to get queue statistics:', error);
    throw error;
  }
}

// Get available scale configurations
function getScaleConfigs() {
  return Object.entries(SCALE_CONFIGS).map(([key, config]) => ({
    id: key,
    name: config.name,
    description: config.description,
    totalCIs: config.totalCIs,
    estimatedDuration: config.estimatedDuration,
    complexity: key === 'enterprise' ? 'Very High' :
                key === 'large' ? 'High' :
                key === 'medium' ? 'Medium' : 'Low'
  }));
}

// Clean old jobs and progress data
async function cleanupOldJobs() {
  try {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const cutoff = Date.now() - maxAge;

    // Clean completed jobs older than 24 hours
    const completed = await dataGenerationQueue.getCompleted();
    for (const job of completed) {
      if (job.finishedOn && job.finishedOn < cutoff) {
        await job.remove();
        await redisClient.del(`progress:${job.data.jobId}`);
      }
    }

    // Clean failed jobs older than 24 hours
    const failed = await dataGenerationQueue.getFailed();
    for (const job of failed) {
      if (job.failedOn && job.failedOn < cutoff) {
        await job.remove();
        await redisClient.del(`progress:${job.data.jobId}`);
      }
    }

    logger.info('🧹 Old jobs cleanup completed');
  } catch (error) {
    logger.error('❌ Failed to cleanup old jobs:', error);
  }
}

// Event handlers
dataGenerationQueue.on('error', (error) => {
  logger.error('Queue error:', error);
});

dataGenerationQueue.on('waiting', (jobId) => {
  logger.info(`📋 Job ${jobId} is waiting in queue`);
});

dataGenerationQueue.on('active', (job) => {
  logger.info(`🔄 Job ${job.data.jobId} started processing`);
});

dataGenerationQueue.on('completed', (job, result) => {
  logger.info(`✅ Job ${job.data.jobId} completed successfully`);
});

dataGenerationQueue.on('failed', (job, err) => {
  logger.error(`❌ Job ${job.data.jobId} failed:`, err.message);
});

// Job processor for data generation
dataGenerationQueue.process('generate-enterprise-data', async (job) => {
  const { jobId, scale, config } = job.data;
  const { createDemoEnterpriseData } = require('../models/demoEnterpriseData');

  try {
    logger.info(`🔄 Starting data generation job ${jobId} with scale: ${scale}`);

    // Update progress: starting
    await updateJobProgress(jobId, {
      stage: 'starting',
      completed: 5,
      total: 100,
      percentage: 5,
      message: 'Initializing data generation...',
      scale: config.name,
      totalCIs: config.totalCIs
    });

    // Clear existing data if requested
    if (config.clearExisting) {
      await updateJobProgress(jobId, {
        stage: 'clearing',
        completed: 10,
        total: 100,
        percentage: 10,
        message: 'Clearing existing data...',
        scale: config.name,
        totalCIs: config.totalCIs
      });
    }

    // Update progress: generating CIs
    await updateJobProgress(jobId, {
      stage: 'generating_cis',
      completed: 20,
      total: 100,
      percentage: 20,
      message: 'Generating configuration items...',
      scale: config.name,
      totalCIs: config.totalCIs
    });

    // Generate the data using the existing function
    const result = await createDemoEnterpriseData();

    // Update progress: generating events
    await updateJobProgress(jobId, {
      stage: 'generating_events',
      completed: 80,
      total: 100,
      percentage: 80,
      message: 'Generating events and relationships...',
      scale: config.name,
      totalCIs: config.totalCIs
    });

    // Final completion
    await updateJobProgress(jobId, {
      stage: 'completed',
      completed: 100,
      total: 100,
      percentage: 100,
      message: 'Data generation completed successfully',
      scale: config.name,
      totalCIs: config.totalCIs,
      result
    });

    logger.info(`✅ Data generation job ${jobId} completed successfully`);
    return result;

  } catch (error) {
    logger.error(`❌ Data generation job ${jobId} failed:`, error);

    await updateJobProgress(jobId, {
      stage: 'failed',
      completed: 0,
      total: 100,
      percentage: 0,
      message: `Data generation failed: ${error.message}`,
      scale: config.name,
      totalCIs: config.totalCIs,
      error: error.message
    });

    throw error;
  }
});

// Schedule cleanup every hour
setInterval(cleanupOldJobs, 60 * 60 * 1000);

module.exports = {
  initializeRedis,
  createDataGenerationJob,
  getJobStatus,
  getActiveJobs,
  cancelJob,
  getQueueStats,
  getScaleConfigs,
  cleanupOldJobs,
  SCALE_CONFIGS
};