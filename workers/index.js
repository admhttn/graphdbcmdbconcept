const Bull = require('bull');
const redis = require('redis');
const neo4j = require('neo4j-driver');
const winston = require('winston');
const crypto = require('crypto');
const io = require('socket.io-client');

// Use Node.js built-in UUID generator
const uuidv4 = () => crypto.randomUUID();

// Worker configuration
// SECURITY NOTE: Default values are intentionally insecure to force proper configuration
// Always set these environment variables in production:
// - NEO4J_PASSWORD: Use a strong password, never the default
// - REDIS_URL: Use authentication for Redis in production
// - NEO4J_URI: Use secure connection strings in production
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'CHANGE_ME_INSECURE_DEFAULT';
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY) || 3;
const APP_SERVER_URL = process.env.APP_SERVER_URL || 'http://app:3000';

// Logging setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'cmdb-worker' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Database connections
let driver;
let redisClient;
let socket;

async function initializeConnections() {
  try {
    // Initialize Neo4j driver
    driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD), {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 60000,
      maxTransactionRetryTime: 30000
    });

    // Verify Neo4j connection
    await driver.verifyConnectivity();
    logger.info('✅ Neo4j connection established');

    // Initialize Redis client
    redisClient = redis.createClient({ url: REDIS_URL });
    await redisClient.connect();
    logger.info('✅ Redis connection established');

    // Initialize Socket.IO client connection
    socket = io(APP_SERVER_URL, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    socket.on('connect', () => {
      logger.info('✅ WebSocket connection established to main app');
    });

    socket.on('disconnect', () => {
      logger.warn('⚠️ WebSocket disconnected from main app');
    });

    socket.on('connect_error', (error) => {
      logger.error('❌ WebSocket connection error:', error.message);
    });

  } catch (error) {
    logger.error('❌ Failed to initialize connections:', error);
    process.exit(1);
  }
}

// Job queue setup
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

// Progress tracking helper
async function updateProgress(jobId, stage, completed, total, message) {
  const progressData = {
    stage,
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
    message,
    timestamp: new Date().toISOString()
  };

  await redisClient.setEx(`progress:${jobId}`, 3600, JSON.stringify(progressData));
  logger.info(`Progress [${jobId}]: ${stage} - ${completed}/${total} (${progressData.percentage}%) - ${message}`);

  // Broadcast progress update via WebSocket
  if (socket && socket.connected) {
    socket.emit('job-progress', {
      jobId,
      ...progressData
    });
  }
}

// Batch processing function for CIs
async function processCIBatch(session, cis, jobId, batchIndex, totalBatches) {
  const batchSize = cis.length;
  logger.info(`Processing CI batch ${batchIndex + 1}/${totalBatches} with ${batchSize} items`);

  const transaction = session.beginTransaction();

  try {
    // Create CIs in batch using UNWIND for performance
    const ciQuery = `
      UNWIND $cis AS ci
      CREATE (c:ConfigurationItem)
      SET c = ci
      RETURN count(c) as created
    `;

    const result = await transaction.run(ciQuery, { cis });
    const created = result.records[0]?.get('created')?.toNumber() || 0;

    await transaction.commit();

    await updateProgress(
      jobId,
      'configuration-items',
      (batchIndex + 1) * batchSize,
      totalBatches * batchSize,
      `Created ${created} configuration items in batch ${batchIndex + 1}`
    );

    return created;

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// Batch processing function for relationships
async function processRelationshipBatch(session, relationships, jobId, batchIndex, totalBatches) {
  const batchSize = relationships.length;
  logger.info(`Processing relationship batch ${batchIndex + 1}/${totalBatches} with ${batchSize} items`);

  const transaction = session.beginTransaction();

  try {
    // Create relationships in batch
    const relQuery = `
      UNWIND $relationships AS rel
      MATCH (from:ConfigurationItem {id: rel.from})
      MATCH (to:ConfigurationItem {id: rel.to})
      CALL apoc.create.relationship(from, rel.type, {}, to) YIELD rel as r
      RETURN count(r) as created
    `;

    const result = await transaction.run(relQuery, { relationships });
    const created = result.records[0]?.get('created')?.toNumber() || 0;

    await transaction.commit();

    await updateProgress(
      jobId,
      'relationships',
      (batchIndex + 1) * batchSize,
      totalBatches * batchSize,
      `Created ${created} relationships in batch ${batchIndex + 1}`
    );

    return created;

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// Main data generation job processor
dataGenerationQueue.process('generate-enterprise-data', WORKER_CONCURRENCY, async (job) => {
  const { jobId, scale, config } = job.data;
  const session = driver.session({ database: 'neo4j' });

  try {
    logger.info(`🚀 Starting enterprise data generation job ${jobId} at scale: ${scale}`);

    // Stage 1: Clear existing data
    await updateProgress(jobId, 'initialization', 0, 100, 'Clearing existing data...');

    // Clear data in batches to avoid memory issues
    let deletedCount = 0;
    const batchSize = 1000;
    let totalNodes = 0;

    // First, get total node count for progress tracking
    const countResult = await session.run('MATCH (n) RETURN count(n) as total');
    totalNodes = countResult.records[0].get('total').toNumber();

    if (totalNodes > 0) {
      logger.info(`Clearing ${totalNodes} existing nodes in batches of ${batchSize}...`);

      while (true) {
        const deleteResult = await session.run(`
          MATCH (n)
          WITH n LIMIT ${batchSize}
          DETACH DELETE n
          RETURN count(*) as deleted
        `);

        const deleted = deleteResult.records[0]?.get('deleted').toNumber() || 0;
        if (deleted === 0) break;

        deletedCount += deleted;
        const progress = Math.min(100, Math.round((deletedCount / totalNodes) * 100));
        await updateProgress(jobId, 'initialization', progress, 100, `Cleared ${deletedCount}/${totalNodes} nodes...`);

        // Small delay to prevent overwhelming the database
        if (deletedCount < totalNodes) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    await updateProgress(jobId, 'initialization', 100, 100, 'Data cleared successfully');

    // Stage 2: Generate configuration items
    await updateProgress(jobId, 'configuration-items', 0, config.totalCIs, 'Generating configuration items...');

    const { cis, relationships } = await generateEnterpriseData(config);

    // Process CIs in batches
    const ciBatchSize = 1000;
    const ciBatches = [];
    for (let i = 0; i < cis.length; i += ciBatchSize) {
      ciBatches.push(cis.slice(i, i + ciBatchSize));
    }

    let totalCIsCreated = 0;
    for (let i = 0; i < ciBatches.length; i++) {
      const created = await processCIBatch(session, ciBatches[i], jobId, i, ciBatches.length);
      totalCIsCreated += created;

      // Update job progress
      job.progress(Math.round(((i + 1) / ciBatches.length) * 50)); // 50% for CIs
    }

    // Stage 3: Create relationships
    await updateProgress(jobId, 'relationships', 0, relationships.length, 'Creating relationships...');

    const relBatchSize = 2000;
    const relBatches = [];
    for (let i = 0; i < relationships.length; i += relBatchSize) {
      relBatches.push(relationships.slice(i, i + relBatchSize));
    }

    let totalRelsCreated = 0;
    for (let i = 0; i < relBatches.length; i++) {
      const created = await processRelationshipBatch(session, relBatches[i], jobId, i, relBatches.length);
      totalRelsCreated += created;

      // Update job progress
      job.progress(50 + Math.round(((i + 1) / relBatches.length) * 30)); // 30% for relationships
    }

    // Stage 4: Generate events
    await updateProgress(jobId, 'events', 0, config.eventCount, 'Generating events...');
    const eventsCreated = await generateEvents(session, config.eventCount, jobId);
    job.progress(90);

    // Stage 5: Complete
    await updateProgress(jobId, 'completed', 100, 100, 'Data generation completed successfully!');
    job.progress(100);

    const result = {
      jobId,
      totalCIs: totalCIsCreated,
      totalRelationships: totalRelsCreated,
      totalEvents: eventsCreated,
      scale,
      completedAt: new Date().toISOString()
    };

    logger.info(`✅ Job ${jobId} completed: ${totalCIsCreated} CIs, ${totalRelsCreated} relationships, ${eventsCreated} events`);
    return result;

  } catch (error) {
    logger.error(`❌ Job ${jobId} failed:`, error);
    await updateProgress(jobId, 'error', 0, 100, `Error: ${error.message}`);
    throw error;
  } finally {
    await session.close();
  }
});

// Enterprise data generation function
async function generateEnterpriseData(config) {
  const { scale, regionsCount, datacentersPerRegion, serversPerDatacenter, applicationsCount, databasesCount } = config;

  const cis = [];
  const relationships = [];

  // Generate regions
  const regions = [];
  const regionNames = ['US East', 'US West', 'Europe', 'Asia Pacific', 'South America'];
  for (let i = 0; i < regionsCount; i++) {
    const region = {
      id: `region-${i.toString().padStart(3, '0')}`,
      name: regionNames[i % regionNames.length],
      type: 'Region',
      status: 'OPERATIONAL',
      criticality: 'HIGH'
    };
    regions.push(region);
    cis.push(region);
  }

  // Generate datacenters
  const datacenters = [];
  regions.forEach((region, regionIdx) => {
    for (let i = 0; i < datacentersPerRegion; i++) {
      const dc = {
        id: `dc-${region.id}-${i.toString().padStart(2, '0')}`,
        name: `${region.name} Datacenter ${i + 1}`,
        type: 'DataCenter',
        status: 'OPERATIONAL',
        criticality: i === 0 ? 'CRITICAL' : 'HIGH',
        region: region.id
      };
      datacenters.push(dc);
      cis.push(dc);

      // Create region relationship
      relationships.push({
        from: dc.id,
        to: region.id,
        type: 'LOCATED_IN'
      });
    }
  });

  // Generate servers
  const servers = [];
  datacenters.forEach((dc, dcIdx) => {
    for (let i = 0; i < serversPerDatacenter; i++) {
      const serverTypes = ['Web', 'App', 'Database', 'Cache', 'Storage', 'Compute'];
      const server = {
        id: `srv-${dc.id}-${i.toString().padStart(4, '0')}`,
        name: `${serverTypes[i % serverTypes.length]} Server ${i + 1} - ${dc.name}`,
        type: 'Server',
        serverType: serverTypes[i % serverTypes.length],
        status: Math.random() > 0.05 ? 'OPERATIONAL' : 'MAINTENANCE',
        criticality: i < 5 ? 'CRITICAL' : i < 20 ? 'HIGH' : 'MEDIUM',
        datacenter: dc.id
      };
      servers.push(server);
      cis.push(server);

      // Create datacenter relationship
      relationships.push({
        from: server.id,
        to: dc.id,
        type: 'HOSTED_IN'
      });
    }
  });

  // Generate applications
  const applications = [];
  const appTypes = ['WebApplication', 'APIService', 'Microservice', 'BackgroundService', 'MobileApp'];
  for (let i = 0; i < applicationsCount; i++) {
    const app = {
      id: `app-${i.toString().padStart(5, '0')}`,
      name: `Application ${i + 1}`,
      type: appTypes[i % appTypes.length],
      version: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
      status: 'OPERATIONAL',
      criticality: i < applicationsCount * 0.1 ? 'CRITICAL' :
                  i < applicationsCount * 0.3 ? 'HIGH' :
                  i < applicationsCount * 0.7 ? 'MEDIUM' : 'LOW',
      environment: Math.random() > 0.3 ? 'PRODUCTION' : Math.random() > 0.5 ? 'STAGING' : 'DEVELOPMENT'
    };
    applications.push(app);
    cis.push(app);

    // Connect to random servers
    const randomServers = servers.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
    randomServers.forEach(server => {
      relationships.push({
        from: app.id,
        to: server.id,
        type: 'RUNS_ON'
      });
    });
  }

  // Generate databases
  const databases = [];
  const dbTypes = ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Cassandra', 'Elasticsearch'];
  for (let i = 0; i < databasesCount; i++) {
    const db = {
      id: `db-${i.toString().padStart(4, '0')}`,
      name: `Database ${i + 1}`,
      type: 'Database',
      dbType: dbTypes[i % dbTypes.length],
      status: 'OPERATIONAL',
      criticality: i < databasesCount * 0.2 ? 'CRITICAL' :
                  i < databasesCount * 0.5 ? 'HIGH' : 'MEDIUM'
    };
    databases.push(db);
    cis.push(db);

    // Connect to database servers
    const dbServers = servers.filter(s => s.serverType === 'Database');
    if (dbServers.length > 0) {
      const randomDbServer = dbServers[Math.floor(Math.random() * dbServers.length)];
      relationships.push({
        from: db.id,
        to: randomDbServer.id,
        type: 'HOSTED_ON'
      });
    }
  }

  // Generate business services
  const businessServices = [
    'E-Commerce Platform', 'Payment Processing', 'User Authentication', 'Customer Portal',
    'Analytics Platform', 'Notification Service', 'Content Management', 'Order Management',
    'Inventory Management', 'Financial Reporting', 'Security Monitoring', 'Data Backup'
  ];

  businessServices.forEach((serviceName, idx) => {
    const service = {
      id: `biz-svc-${idx.toString().padStart(3, '0')}`,
      name: serviceName,
      type: 'BusinessService',
      status: 'OPERATIONAL',
      criticality: idx < 4 ? 'CRITICAL' : idx < 8 ? 'HIGH' : 'MEDIUM'
    };
    cis.push(service);

    // Connect to applications
    const serviceApps = applications.slice(idx * 3, (idx + 1) * 3);
    serviceApps.forEach(app => {
      relationships.push({
        from: app.id,
        to: service.id,
        type: 'SUPPORTS'
      });
    });
  });

  // Create application dependencies
  applications.forEach((app, idx) => {
    // Connect to databases
    if (idx < databases.length) {
      relationships.push({
        from: app.id,
        to: databases[idx % databases.length].id,
        type: 'DEPENDS_ON'
      });
    }

    // Create microservice dependencies
    if (app.type === 'Microservice' && Math.random() > 0.5) {
      const otherServices = applications.filter(a => a.type === 'APIService' || a.type === 'Microservice');
      if (otherServices.length > 0) {
        const dependency = otherServices[Math.floor(Math.random() * otherServices.length)];
        if (dependency.id !== app.id) {
          relationships.push({
            from: app.id,
            to: dependency.id,
            type: 'DEPENDS_ON'
          });
        }
      }
    }
  });

  return { cis, relationships };
}

// Event generation function
async function generateEvents(session, eventCount, jobId) {
  const eventTemplates = [
    { message: 'High CPU utilization detected', severity: 'HIGH', type: 'PERFORMANCE', ciTypes: ['Server'] },
    { message: 'Memory usage critical', severity: 'CRITICAL', type: 'PERFORMANCE', ciTypes: ['Server'] },
    { message: 'API response time degraded', severity: 'MEDIUM', type: 'PERFORMANCE', ciTypes: ['APIService', 'WebApplication'] },
    { message: 'Database connection pool exhausted', severity: 'CRITICAL', type: 'DATABASE', ciTypes: ['Database'] },
    { message: 'Service unavailable', severity: 'HIGH', type: 'AVAILABILITY', ciTypes: ['WebApplication', 'APIService', 'Microservice'] },
    { message: 'Network latency increased', severity: 'MEDIUM', type: 'NETWORK', ciTypes: ['Server', 'DataCenter'] },
    { message: 'Disk space running low', severity: 'MEDIUM', type: 'CAPACITY', ciTypes: ['Server'] },
    { message: 'Security alert detected', severity: 'HIGH', type: 'SECURITY', ciTypes: ['Server', 'WebApplication'] }
  ];

  const baseTime = new Date();
  const timeRange = 24 * 60 * 60 * 1000; // 24 hours
  let eventsCreated = 0;

  const eventBatchSize = 500;
  for (let batch = 0; batch < Math.ceil(eventCount / eventBatchSize); batch++) {
    const batchEvents = [];
    const batchStart = batch * eventBatchSize;
    const batchEnd = Math.min(batchStart + eventBatchSize, eventCount);

    for (let i = batchStart; i < batchEnd; i++) {
      const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];
      const eventTime = new Date(baseTime.getTime() - Math.random() * timeRange);

      const event = {
        id: uuidv4(),
        message: template.message,
        severity: template.severity,
        eventType: template.type,
        timestamp: eventTime.toISOString(),
        status: Math.random() > 0.3 ? 'OPEN' : Math.random() > 0.5 ? 'ACKNOWLEDGED' : 'RESOLVED',
        correlationScore: 0.0,
        metadata: JSON.stringify({
          generated: true,
          scale: 'enterprise',
          batch: batch + 1
        })
      };

      batchEvents.push(event);
    }

    // Create events and link to random CIs
    const eventQuery = `
      UNWIND $events AS event
      CREATE (e:Event)
      SET e = event
      WITH e
      MATCH (ci:ConfigurationItem)
      WHERE rand() < 0.01
      WITH e, ci
      LIMIT 1
      CREATE (e)-[:AFFECTS]->(ci)
      RETURN count(e) as created
    `;

    const result = await session.run(eventQuery, { events: batchEvents });
    const created = result.records[0]?.get('created')?.toNumber() || 0;
    eventsCreated += created;

    await updateProgress(
      jobId,
      'events',
      eventsCreated,
      eventCount,
      `Created ${created} events in batch ${batch + 1}`
    );
  }

  return eventsCreated;
}

// Error handling
dataGenerationQueue.on('error', (error) => {
  logger.error('Queue error:', error);
});

dataGenerationQueue.on('waiting', (jobId) => {
  logger.info(`Job ${jobId} is waiting`);
});

dataGenerationQueue.on('active', (job, jobPromise) => {
  logger.info(`Job ${job.id} started processing`);
});

dataGenerationQueue.on('completed', (job, result) => {
  logger.info(`Job ${job.id} completed:`, result);
});

dataGenerationQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed:`, err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('🛑 SIGTERM received, shutting down gracefully...');
  await dataGenerationQueue.close();
  await driver.close();
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('🛑 SIGINT received, shutting down gracefully...');
  await dataGenerationQueue.close();
  await driver.close();
  await redisClient.quit();
  process.exit(0);
});

// Initialize and start worker
async function startWorker() {
  try {
    await initializeConnections();
    logger.info(`🚀 CMDB Data Generation Worker started with concurrency: ${WORKER_CONCURRENCY}`);
    logger.info('📊 Monitoring dashboard: http://localhost:8081');
  } catch (error) {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  }
}

startWorker();