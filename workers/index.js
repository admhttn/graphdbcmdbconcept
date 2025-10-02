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

// Batch processing function for CIs with detailed progress
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

    // Count CI types in this batch for detailed reporting
    const typeCounts = cis.reduce((acc, ci) => {
      acc[ci.type] = (acc[ci.type] || 0) + 1;
      return acc;
    }, {});

    const typeBreakdown = Object.entries(typeCounts)
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ');

    await updateProgress(
      jobId,
      'configuration-items',
      (batchIndex + 1) * batchSize,
      totalBatches * batchSize,
      `Created ${created} CIs in batch ${batchIndex + 1}/${totalBatches} - ${typeBreakdown} → Neo4j`
    );

    return created;

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// Batch processing function for relationships with detailed progress
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

    // Count relationship types in this batch for detailed reporting
    const relTypeCounts = relationships.reduce((acc, rel) => {
      acc[rel.type] = (acc[rel.type] || 0) + 1;
      return acc;
    }, {});

    const relTypeBreakdown = Object.entries(relTypeCounts)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');

    await updateProgress(
      jobId,
      'relationships',
      (batchIndex + 1) * batchSize,
      totalBatches * batchSize,
      `Created ${created} relationships in batch ${batchIndex + 1}/${totalBatches} - ${relTypeBreakdown} → Neo4j`
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

    // Stage 1: Clear existing data (only if clearExisting is true)
    if (config.clearExisting !== false) {
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
    } else {
      await updateProgress(jobId, 'initialization', 100, 100, 'Skipping data clearing - preserving existing data');
      logger.info(`Preserving existing data as requested (clearExisting=false)`);
    }

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
  const { scale, regionsCount, datacentersPerRegion, serversPerDatacenter, applicationsCount, databasesCount, clearExisting } = config;

  const cis = [];
  const relationships = [];

  // Use unique ID prefix when preserving existing data to avoid conflicts
  const idSuffix = clearExisting === false ? `-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : '';

  // Generate regions
  const regions = [];
  const regionNames = ['US East', 'US West', 'Europe', 'Asia Pacific', 'South America'];
  for (let i = 0; i < regionsCount; i++) {
    const region = {
      id: `region-${i.toString().padStart(3, '0')}${idSuffix}`,
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
        id: `dc-${region.id.replace(idSuffix, '')}-${i.toString().padStart(2, '0')}${idSuffix}`,
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
        id: `srv-${dc.id.replace(idSuffix, '')}-${i.toString().padStart(4, '0')}${idSuffix}`,
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
      id: `app-${i.toString().padStart(5, '0')}${idSuffix}`,
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

    // Connect to multiple random servers (2-5 per app for redundancy)
    const serverCount = Math.floor(Math.random() * 4) + 2; // 2-5 servers
    const randomServers = servers.sort(() => 0.5 - Math.random()).slice(0, serverCount);
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
      id: `db-${i.toString().padStart(4, '0')}${idSuffix}`,
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
      id: `biz-svc-${idx.toString().padStart(3, '0')}${idSuffix}`,
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

  // Create rich application dependencies with higher density
  applications.forEach((app, idx) => {
    // Each application depends on 1-3 databases
    const dbCount = Math.floor(Math.random() * 3) + 1; // 1-3 databases
    const appDatabases = databases.sort(() => 0.5 - Math.random()).slice(0, Math.min(dbCount, databases.length));
    appDatabases.forEach(db => {
      relationships.push({
        from: app.id,
        to: db.id,
        type: 'DEPENDS_ON'
      });
    });

    // Create microservice dependencies (80% probability instead of 50%)
    if ((app.type === 'Microservice' || app.type === 'APIService') && Math.random() > 0.2) {
      const otherServices = applications.filter(a =>
        (a.type === 'APIService' || a.type === 'Microservice') && a.id !== app.id
      );
      if (otherServices.length > 0) {
        // Each microservice depends on 1-2 other services
        const depCount = Math.floor(Math.random() * 2) + 1;
        const dependencies = otherServices.sort(() => 0.5 - Math.random()).slice(0, depCount);
        dependencies.forEach(dependency => {
          relationships.push({
            from: app.id,
            to: dependency.id,
            type: 'DEPENDS_ON'
          });
        });
      }
    }

    // Web applications depend on API services
    if (app.type === 'WebApplication') {
      const apiServices = applications.filter(a => a.type === 'APIService');
      if (apiServices.length > 0) {
        const apiCount = Math.floor(Math.random() * 2) + 1; // 1-2 APIs
        const usedAPIs = apiServices.sort(() => 0.5 - Math.random()).slice(0, apiCount);
        usedAPIs.forEach(api => {
          relationships.push({
            from: app.id,
            to: api.id,
            type: 'USES'
          });
        });
      }
    }
  });

  // Add network relationships for servers (creates more graph depth)
  const webServers = servers.filter(s => s.serverType === 'Web');
  const appServers = servers.filter(s => s.serverType === 'App');

  // Web servers connect to app servers
  webServers.forEach(webServer => {
    if (appServers.length > 0 && Math.random() > 0.3) {
      const targetAppServer = appServers[Math.floor(Math.random() * appServers.length)];
      relationships.push({
        from: webServer.id,
        to: targetAppServer.id,
        type: 'CONNECTS_TO'
      });
    }
  });

  return { cis, relationships };
}

// Event generation function with guaranteed CI linkage
async function generateEvents(session, eventCount, jobId) {
  const eventTemplates = [
    { message: 'High CPU utilization detected', severity: 'HIGH', type: 'PERFORMANCE', ciTypes: ['Server'], source: 'monitoring.cpu' },
    { message: 'Memory usage critical', severity: 'CRITICAL', type: 'PERFORMANCE', ciTypes: ['Server'], source: 'monitoring.memory' },
    { message: 'API response time degraded', severity: 'MEDIUM', type: 'PERFORMANCE', ciTypes: ['APIService', 'WebApplication'], source: 'application.api' },
    { message: 'Database connection pool exhausted', severity: 'CRITICAL', type: 'DATABASE', ciTypes: ['Database'], source: 'database.connections' },
    { message: 'Service unavailable', severity: 'HIGH', type: 'AVAILABILITY', ciTypes: ['WebApplication', 'APIService', 'Microservice'], source: 'service.health' },
    { message: 'Network latency increased', severity: 'MEDIUM', type: 'NETWORK', ciTypes: ['Server', 'DataCenter'], source: 'network.latency' },
    { message: 'Disk space running low', severity: 'MEDIUM', type: 'CAPACITY', ciTypes: ['Server'], source: 'storage.disk' },
    { message: 'Security alert detected', severity: 'HIGH', type: 'SECURITY', ciTypes: ['Server', 'WebApplication'], source: 'security.ids' },
    { message: 'Application error rate spike', severity: 'HIGH', type: 'APPLICATION', ciTypes: ['WebApplication', 'APIService', 'Microservice'], source: 'application.errors' },
    { message: 'Database query performance degraded', severity: 'MEDIUM', type: 'DATABASE', ciTypes: ['Database'], source: 'database.performance' }
  ];

  const baseTime = new Date();
  const timeRange = 2 * 60 * 60 * 1000; // 2 hours for better correlation (not 24 hours)
  let eventsCreated = 0;
  let eventsLinked = 0;

  const eventBatchSize = 100; // Smaller batches for better CI targeting
  for (let batch = 0; batch < Math.ceil(eventCount / eventBatchSize); batch++) {
    const batchStart = batch * eventBatchSize;
    const batchEnd = Math.min(batchStart + eventBatchSize, eventCount);
    const currentBatchSize = batchEnd - batchStart;

    // Process each event template type separately to ensure proper CI targeting
    for (const template of eventTemplates) {
      const eventsForTemplate = Math.ceil(currentBatchSize / eventTemplates.length);
      if (eventsForTemplate === 0) continue;

      // Get target CIs for this template type
      const ciTypeList = template.ciTypes.map(t => `'${t}'`).join(', ');
      const ciQuery = `
        MATCH (ci:ConfigurationItem)
        WHERE ci.type IN [${ciTypeList}]
        RETURN ci.id as id, ci.type as type, ci.name as name
        ORDER BY rand()
        LIMIT ${eventsForTemplate}
      `;

      const ciResults = await session.run(ciQuery);

      if (ciResults.records.length === 0) {
        logger.warn(`No CIs found for types: ${template.ciTypes.join(', ')}`);
        continue;
      }

      // Create events with guaranteed CI linkage
      const eventsWithCIs = ciResults.records.map((record, idx) => {
        const ciId = record.get('id');
        const ciType = record.get('type');
        const ciName = record.get('name');

        // Create time-clustered events for correlation (within 30 min window)
        const clusterWindow = 30 * 60 * 1000; // 30 minutes
        const clusterBase = baseTime.getTime() - (batch * clusterWindow);
        const eventTime = new Date(clusterBase - Math.random() * clusterWindow);

        return {
          event: {
            id: uuidv4(),
            message: `${template.message} on ${ciType} ${ciName}`,
            severity: template.severity,
            eventType: template.type,
            source: template.source,
            timestamp: eventTime.toISOString(),
            status: Math.random() > 0.7 ? 'OPEN' : Math.random() > 0.5 ? 'ACKNOWLEDGED' : 'RESOLVED',
            correlationScore: 0.0,
            metadata: JSON.stringify({
              generated: true,
              scale: 'enterprise',
              batch: batch + 1,
              template: template.type,
              targetCIType: ciType
            })
          },
          ciId: ciId
        };
      });

      // Bulk insert events with CI relationships
      const insertQuery = `
        UNWIND $eventsWithCIs AS item
        CREATE (e:Event)
        SET e = item.event
        WITH e, item.ciId
        MATCH (ci:ConfigurationItem {id: item.ciId})
        CREATE (e)-[:AFFECTS]->(ci)
        RETURN count(e) as created
      `;

      const result = await session.run(insertQuery, { eventsWithCIs });
      const created = result.records[0]?.get('created')?.toNumber() || 0;
      eventsCreated += created;
      eventsLinked += created;
    }

    await updateProgress(
      jobId,
      'events',
      eventsCreated,
      eventCount,
      `Created ${eventsCreated} events (${eventsLinked} linked to CIs) in batch ${batch + 1}/${Math.ceil(eventCount / eventBatchSize)}`
    );
  }

  logger.info(`✅ Event generation complete: ${eventsCreated} events created, ${eventsLinked} linked to CIs (${Math.round((eventsLinked/eventsCreated)*100)}% linkage)`);
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