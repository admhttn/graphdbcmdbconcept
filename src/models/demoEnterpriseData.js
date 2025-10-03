const { runWriteQuery } = require('../services/neo4j');
const { createNodesBulk, createRelationshipsBulk, checkAPOCAvailability } = require('../services/apocOperations');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

/**
 * Scalable enterprise data generator with APOC optimization
 * Accepts configuration to generate small (1K), medium (10K), large (100K), or enterprise (1M) scale data
 *
 * Performance Modes:
 * - Small (1K): Standard UNWIND batching
 * - Medium (10K): UNWIND with larger batches
 * - Large (100K+): APOC parallel processing (if available)
 */
async function createDemoEnterpriseData(config = {}) {
    // Default to small demo scale if no config provided
    const {
        totalCIs = 1000,
        regionsCount = 2,
        datacentersPerRegion = 2,
        serversPerDatacenter = 50,
        applicationsCount = 200,
        databasesCount = 20,
        eventCount = 500,
        clearExisting = false,
        useAPOC = true  // Enable APOC for large datasets
    } = config;

    const startTime = Date.now();

    console.log(`🏢 Generating enterprise CMDB data (target: ${totalCIs.toLocaleString()} CIs)...`);
    console.log(`   📍 Regions: ${regionsCount}`);
    console.log(`   🏢 Datacenters: ${regionsCount * datacentersPerRegion}`);
    console.log(`   🖥️  Servers: ${regionsCount * datacentersPerRegion * serversPerDatacenter}`);
    console.log(`   📱 Applications: ${applicationsCount}`);
    console.log(`   🗄️  Databases: ${databasesCount}`);
    console.log(`   ⚡ Events: ${eventCount}`);

    // Check APOC availability for large datasets
    const hasAPOC = useAPOC && totalCIs >= 10000 ? await checkAPOCAvailability() : false;
    if (totalCIs >= 10000 && hasAPOC) {
        console.log('   🚀 Using APOC parallel processing for optimal performance');
    }

    try {
        let totalCreated = 0;
        let totalRelationships = 0;

        // Clear existing data if requested
        if (clearExisting) {
            console.log('🗑️  Clearing existing data...');
            await runWriteQuery('MATCH (n:Event) DETACH DELETE n');
            await runWriteQuery('MATCH (n:ConfigurationItem) DETACH DELETE n');
        }

        // Step 1: Create regions
        console.log('📍 Creating regions...');
        const regionNames = ['US East', 'US West', 'US Central', 'Europe', 'Asia Pacific', 'Canada', 'Australia', 'South America', 'Middle East', 'Africa'];
        const regionLocations = ['Virginia', 'California', 'Texas', 'Ireland', 'Singapore', 'Toronto', 'Sydney', 'São Paulo', 'Dubai', 'South Africa'];

        const regions = [];
        for (let i = 0; i < Math.min(regionsCount, regionNames.length); i++) {
            const region = {
                id: `region-${i.toString().padStart(2, '0')}`,
                name: regionNames[i],
                location: regionLocations[i],
                type: 'Region',
                criticality: i < 3 ? 'CRITICAL' : 'HIGH',
                status: 'OPERATIONAL'
            };

            await runWriteQuery('CREATE (r:ConfigurationItem $props)', { props: region });
            regions.push(region);
            totalCreated++;
        }

        // Step 2: Create datacenters using UNWIND for batch creation
        console.log('🏢 Creating datacenters...');
        const datacenters = [];
        for (let i = 0; i < regions.length; i++) {
            for (let j = 1; j <= datacentersPerRegion; j++) {
                datacenters.push({
                    id: `dc-${regions[i].id}-${j.toString().padStart(2, '0')}`,
                    name: `${regions[i].name} DC ${j}`,
                    type: 'DataCenter',
                    region: regions[i].id,
                    criticality: j === 1 ? 'CRITICAL' : 'HIGH',
                    status: 'OPERATIONAL'
                });
            }
        }

        // Batch create datacenters
        await runWriteQuery(`
            UNWIND $datacenters AS dc
            CREATE (d:ConfigurationItem) SET d = dc
        `, { datacenters });
        totalCreated += datacenters.length;

        // Create region-datacenter relationships
        await runWriteQuery(`
            MATCH (dc:ConfigurationItem {type: 'DataCenter'})
            MATCH (r:ConfigurationItem {type: 'Region', id: dc.region})
            CREATE (dc)-[:LOCATED_IN]->(r)
        `);

        // Step 3: Create all servers at once (optimized)
        console.log(`🖥️  Creating servers (${serversPerDatacenter} per datacenter)...`);
        const serverTypes = ['Web', 'App', 'DB', 'Cache', 'Compute', 'Storage'];
        const allServers = [];

        // Pre-generate all server data
        for (const dc of datacenters) {
            for (let i = 1; i <= serversPerDatacenter; i++) {
                allServers.push({
                    id: `srv-${dc.id}-${i.toString().padStart(4, '0')}`,
                    name: `Server ${i} - ${dc.name}`,
                    type: 'Server',
                    datacenter: dc.id,
                    serverType: serverTypes[i % serverTypes.length],
                    cpu: `${Math.floor(Math.random() * 48) + 8} cores`,
                    memory: `${Math.pow(2, Math.floor(Math.random() * 5) + 4)}GB`,
                    criticality: i <= 5 ? 'CRITICAL' : i <= 20 ? 'HIGH' : 'MEDIUM',
                    status: Math.random() > 0.05 ? 'OPERATIONAL' : 'MAINTENANCE'
                });
            }
        }

        // Use APOC for large server counts, standard UNWIND for small
        if (hasAPOC && allServers.length > 5000) {
            const stats = await createNodesBulk(allServers, 10000);
            totalCreated += stats.nodesCreated;
        } else {
            // Fallback to batched UNWIND
            const batchSize = 1000;
            for (let i = 0; i < allServers.length; i += batchSize) {
                const batch = allServers.slice(i, i + batchSize);
                await runWriteQuery(`
                    UNWIND $servers AS srv
                    CREATE (s:ConfigurationItem) SET s = srv
                `, { servers: batch });

                if (allServers.length > 1000 && i % 5000 === 0) {
                    console.log(`   ... created ${Math.min(i + batchSize, allServers.length)}/${allServers.length} servers`);
                }
            }
            totalCreated += allServers.length;
        }

        // Create all server-datacenter relationships at once
        console.log('   Creating server-datacenter relationships...');
        await runWriteQuery(`
            MATCH (s:ConfigurationItem {type: 'Server'})
            MATCH (dc:ConfigurationItem {type: 'DataCenter', id: s.datacenter})
            MERGE (s)-[:HOSTED_IN]->(dc)
        `);

        // Step 4: Create applications (optimized)
        console.log(`📱 Creating applications (${applicationsCount})...`);
        const appTypes = ['WebApplication', 'APIService', 'Microservice', 'BackgroundService', 'MobileBackend'];
        const applications = [];

        for (let i = 1; i <= applicationsCount; i++) {
            applications.push({
                id: `app-${i.toString().padStart(5, '0')}`,
                name: `Application ${i}`,
                type: appTypes[i % appTypes.length],
                version: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}.0`,
                criticality: i <= Math.floor(applicationsCount * 0.1) ? 'CRITICAL' :
                             i <= Math.floor(applicationsCount * 0.4) ? 'HIGH' : 'MEDIUM',
                status: 'OPERATIONAL',
                environment: Math.random() > 0.2 ? 'PRODUCTION' : 'STAGING'
            });
        }

        // Use APOC for large application counts
        if (hasAPOC && applicationsCount > 5000) {
            const stats = await createNodesBulk(applications, 10000);
            totalCreated += stats.nodesCreated;
        } else {
            // Batched UNWIND for standard sizes
            const appBatchSize = 1000;
            for (let i = 0; i < applications.length; i += appBatchSize) {
                const batch = applications.slice(i, i + appBatchSize);
                await runWriteQuery(`
                    UNWIND $apps AS app
                    CREATE (a:ConfigurationItem) SET a = app
                `, { apps: batch });
            }
            totalCreated += applicationsCount;
        }

        // Step 5: Create databases (optimized)
        console.log(`🗄️  Creating databases (${databasesCount})...`);
        const dbTypes = ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Cassandra', 'Elasticsearch'];
        const databases = [];

        for (let i = 1; i <= databasesCount; i++) {
            databases.push({
                id: `db-${i.toString().padStart(5, '0')}`,
                name: `Database ${i}`,
                type: 'Database',
                dbType: dbTypes[i % dbTypes.length],
                criticality: i <= Math.floor(databasesCount * 0.25) ? 'CRITICAL' :
                             i <= Math.floor(databasesCount * 0.6) ? 'HIGH' : 'MEDIUM',
                status: 'OPERATIONAL'
            });
        }

        // Batch create databases
        if (hasAPOC && databasesCount > 5000) {
            const stats = await createNodesBulk(databases, 10000);
            totalCreated += stats.nodesCreated;
        } else {
            await runWriteQuery(`
                UNWIND $databases AS db
                CREATE (d:ConfigurationItem) SET d = db
            `, { databases });
            totalCreated += databasesCount;
        }

        // Step 6: Create business services
        console.log('💼 Creating business services...');
        const businessServices = [];
        const serviceNames = [
            'E-Commerce Platform', 'Payment Processing', 'User Authentication',
            'Customer Portal', 'Analytics Platform', 'Notification Service',
            'Inventory Management', 'Order Processing', 'Shipping Service',
            'Customer Support', 'Billing System', 'Reporting Engine'
        ];

        const bizServiceCount = Math.min(Math.floor(applicationsCount / 10), serviceNames.length);
        for (let i = 0; i < bizServiceCount; i++) {
            businessServices.push({
                id: `biz-svc-${i.toString().padStart(3, '0')}`,
                name: serviceNames[i],
                type: 'BusinessService',
                criticality: i < 3 ? 'CRITICAL' : 'HIGH',
                status: 'OPERATIONAL'
            });
        }

        await runWriteQuery(`
            UNWIND $services AS svc
            CREATE (bs:ConfigurationItem) SET bs = svc
        `, { services: businessServices });
        totalCreated += businessServices.length;

        // Step 7: Create relationships (efficient batch operations)
        console.log('🔗 Creating relationships...');

        // Apps run on servers
        await runWriteQuery(`
            MATCH (a:ConfigurationItem) WHERE a.type IN ['WebApplication', 'APIService', 'Microservice', 'MobileBackend']
            WITH collect(a) as apps
            MATCH (s:ConfigurationItem {type: 'Server'})
            WITH apps, collect(s) as servers
            UNWIND range(0, size(apps)-1) as i
            WITH apps[i] as app, servers[i % size(servers)] as server
            CREATE (app)-[:RUNS_ON]->(server)
        `);

        // Apps depend on databases
        await runWriteQuery(`
            MATCH (a:ConfigurationItem) WHERE a.type IN ['WebApplication', 'APIService', 'Microservice']
            WITH collect(a) as apps
            MATCH (d:ConfigurationItem {type: 'Database'})
            WITH apps, collect(d) as databases
            UNWIND range(0, size(apps)-1) as i
            WITH apps[i] as app, databases[i % size(databases)] as db
            CREATE (app)-[:DEPENDS_ON]->(db)
        `);

        // Databases run on servers
        await runWriteQuery(`
            MATCH (d:ConfigurationItem {type: 'Database'})
            WITH collect(d) as databases
            MATCH (s:ConfigurationItem {type: 'Server', serverType: 'DB'})
            WITH databases, collect(s) as dbServers
            UNWIND range(0, size(databases)-1) as i
            WITH databases[i] as db, dbServers[i % size(dbServers)] as server
            CREATE (db)-[:RUNS_ON]->(server)
        `);

        // Apps support business services
        await runWriteQuery(`
            MATCH (a:ConfigurationItem) WHERE a.type IN ['WebApplication', 'APIService']
            WITH collect(a) as apps
            MATCH (bs:ConfigurationItem {type: 'BusinessService'})
            WITH apps, collect(bs) as services
            UNWIND range(0, size(services)-1) as i
            WITH apps[i % size(apps)] as app, services[i] as service
            CREATE (app)-[:SUPPORTS]->(service)
        `);

        // Create some inter-app dependencies (microservices calling each other)
        await runWriteQuery(`
            MATCH (a1:ConfigurationItem) WHERE a1.type = 'Microservice'
            WITH collect(a1) as microservices
            UNWIND range(0, size(microservices)/2) as i
            WITH microservices[i] as service1, microservices[(i + 1) % size(microservices)] as service2
            WHERE service1.id <> service2.id
            CREATE (service1)-[:DEPENDS_ON]->(service2)
        `);

        // Count relationships
        const relResult = await runWriteQuery('MATCH ()-[r]->() RETURN count(r) as count');
        totalRelationships = relResult[0].count.toNumber ? relResult[0].count.toNumber() : relResult[0].count;

        // Step 8: Generate events for correlation
        console.log(`⚡ Generating events (${eventCount})...`);
        const eventTemplates = [
            { source: 'monitoring.cpu', message: 'High CPU utilization detected', severity: 'HIGH', ciType: 'Server' },
            { source: 'monitoring.memory', message: 'Memory usage critical', severity: 'HIGH', ciType: 'Server' },
            { source: 'monitoring.disk', message: 'Disk space running low', severity: 'MEDIUM', ciType: 'Server' },
            { source: 'application.api', message: 'API response time degraded', severity: 'MEDIUM', ciType: 'APIService' },
            { source: 'database.connections', message: 'Database connection pool exhausted', severity: 'CRITICAL', ciType: 'Database' },
            { source: 'application.errors', message: 'Application error rate spike', severity: 'HIGH', ciType: 'WebApplication' },
            { source: 'network.latency', message: 'Network latency increased', severity: 'MEDIUM', ciType: 'Server' },
            { source: 'service.availability', message: 'Service health check failed', severity: 'CRITICAL', ciType: 'Microservice' }
        ];

        const events = [];
        const baseTime = new Date();
        const timeRange = 30 * 60 * 1000; // 30 minutes

        // Get sample CIs of each type for event generation
        const cisByType = {};
        for (const template of eventTemplates) {
            const ciResult = await runWriteQuery(`
                MATCH (ci:ConfigurationItem {type: $ciType})
                RETURN collect(ci.id) as ids
                LIMIT 100
            `, { ciType: template.ciType });

            if (ciResult.length > 0 && ciResult[0].ids.length > 0) {
                cisByType[template.ciType] = ciResult[0].ids;
            }
        }

        // Generate events
        for (let i = 0; i < eventCount; i++) {
            const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];
            const ciIds = cisByType[template.ciType];

            if (ciIds && ciIds.length > 0) {
                const ciId = ciIds[Math.floor(Math.random() * ciIds.length)];
                const eventTime = new Date(baseTime.getTime() - Math.random() * timeRange);

                events.push({
                    id: uuidv4(),
                    source: template.source,
                    message: template.message,
                    severity: template.severity,
                    eventType: 'ALERT',
                    timestamp: eventTime.toISOString(),
                    status: Math.random() > 0.7 ? 'RESOLVED' : 'OPEN',
                    correlationScore: 0.0,
                    affectedCI: ciId,
                    metadata: JSON.stringify({ demo: true, generated: true })
                });
            }
        }

        // Batch create events
        const eventBatchSize = 500;
        for (let i = 0; i < events.length; i += eventBatchSize) {
            const batch = events.slice(i, i + eventBatchSize);
            await runWriteQuery(`
                UNWIND $events AS evt
                CREATE (e:Event) SET e = evt
                WITH e
                MATCH (ci:ConfigurationItem {id: e.affectedCI})
                CREATE (e)-[:AFFECTS]->(ci)
            `, { events: batch });
        }

        const totalTime = Date.now() - startTime;
        const timeInSeconds = (totalTime / 1000).toFixed(2);
        const timeInMinutes = (totalTime / 60000).toFixed(2);

        console.log(`✅ Enterprise CMDB generation completed!`);
        console.log(`   📊 Total CIs: ${totalCreated.toLocaleString()}`);
        console.log(`   🔗 Total Relationships: ${totalRelationships.toLocaleString()}`);
        console.log(`   🏢 Datacenters: ${datacenters.length}`);
        console.log(`   💼 Business Services: ${businessServices.length}`);
        console.log(`   ⚡ Events: ${events.length}`);
        console.log(`   ⏱️  Generation Time: ${timeInMinutes} minutes (${timeInSeconds} seconds)`);
        console.log(`   📈 Performance: ${Math.round(totalCreated / (totalTime / 1000))} CIs/second`);

        if (hasAPOC) {
            console.log(`   🚀 APOC parallel processing was used`);
        }

        return {
            totalCIs: totalCreated,
            totalRelationships,
            datacenters: datacenters.length,
            businessServices: businessServices.length,
            events: events.length,
            generationTimeMs: totalTime,
            generationTimeSeconds: parseFloat(timeInSeconds),
            generationTimeMinutes: parseFloat(timeInMinutes),
            performanceCIsPerSecond: Math.round(totalCreated / (totalTime / 1000)),
            usedAPOC: hasAPOC,
            message: 'Enterprise CMDB data generated successfully'
        };

    } catch (error) {
        console.error('❌ Error generating enterprise data:', error);
        throw error;
    }
}

module.exports = { createDemoEnterpriseData };
