const { runWriteQuery } = require('../services/neo4j');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

// Ultra-lightweight enterprise data generator designed for memory-constrained Neo4j
async function createDemoEnterpriseData() {
    console.log('🏢 Generating demo enterprise CMDB data...');

    try {
        // Clear existing data in smaller batches to avoid memory issues
        console.log('Clearing existing data...');
        await runWriteQuery('MATCH (n:Event) DETACH DELETE n');
        await runWriteQuery('MATCH (n:ConfigurationItem) DETACH DELETE n');

        let totalCIs = 0;
        let totalRelationships = 0;

        // Step 1: Create a small but realistic enterprise structure
        console.log('📍 Creating regions...');
        const regions = [
            { id: 'us-east-1', name: 'US East', location: 'Virginia' },
            { id: 'us-west-1', name: 'US West', location: 'California' }
        ];

        for (const region of regions) {
            await runWriteQuery('CREATE (r:ConfigurationItem $props)', {
                props: { ...region, type: 'Region', criticality: 'HIGH', status: 'OPERATIONAL' }
            });
            totalCIs++;
        }

        // Step 2: Create datacenters (small scale)
        console.log('🏢 Creating datacenters...');
        const datacenters = [];
        for (let i = 0; i < regions.length; i++) {
            for (let j = 1; j <= 2; j++) {
                const dc = {
                    id: `dc-${regions[i].id}-${j.toString().padStart(2, '0')}`,
                    name: `${regions[i].name} Datacenter ${j}`,
                    type: 'DataCenter',
                    region: regions[i].id,
                    criticality: j === 1 ? 'CRITICAL' : 'HIGH',
                    status: 'OPERATIONAL'
                };

                await runWriteQuery('CREATE (dc:ConfigurationItem $props)', { props: dc });
                datacenters.push(dc);
                totalCIs++;
            }
        }

        // Step 3: Create servers (smaller batch)
        console.log('🖥️ Creating servers...');
        for (const dc of datacenters) {
            const serverCount = 50; // Much smaller number

            for (let i = 1; i <= serverCount; i++) {
                const server = {
                    id: `srv-${dc.id}-${i.toString().padStart(3, '0')}`,
                    name: `Server ${i} - ${dc.name}`,
                    type: 'Server',
                    datacenter: dc.id,
                    serverType: ['Web', 'App', 'DB', 'Cache'][i % 4],
                    criticality: i <= 5 ? 'CRITICAL' : i <= 20 ? 'HIGH' : 'MEDIUM',
                    status: Math.random() > 0.05 ? 'OPERATIONAL' : 'MAINTENANCE'
                };

                await runWriteQuery('CREATE (s:ConfigurationItem $props)', { props: server });
                totalCIs++;

                // Create hosting relationship
                await runWriteQuery(`
                    MATCH (s:ConfigurationItem {id: $serverId})
                    MATCH (dc:ConfigurationItem {id: $dcId})
                    CREATE (s)-[:HOSTED_IN]->(dc)
                `, { serverId: server.id, dcId: dc.id });
                totalRelationships++;
            }
        }

        // Step 4: Create applications (smaller scale)
        console.log('📱 Creating applications...');
        const appTypes = ['WebApplication', 'APIService', 'Microservice', 'BackgroundService'];
        for (let i = 1; i <= 100; i++) { // Much smaller number
            const app = {
                id: `app-${i.toString().padStart(3, '0')}`,
                name: `Application ${i}`,
                type: appTypes[i % appTypes.length],
                version: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}.0`,
                criticality: i <= 10 ? 'CRITICAL' : i <= 40 ? 'HIGH' : 'MEDIUM',
                status: 'OPERATIONAL',
                environment: Math.random() > 0.2 ? 'PRODUCTION' : 'STAGING'
            };

            await runWriteQuery('CREATE (a:ConfigurationItem $props)', { props: app });
            totalCIs++;
        }

        // Step 5: Create databases (small scale)
        console.log('🗄️ Creating databases...');
        const dbTypes = ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis'];
        for (let i = 1; i <= 20; i++) { // Much smaller number
            const db = {
                id: `db-${i.toString().padStart(3, '0')}`,
                name: `Database ${i}`,
                type: 'Database',
                dbType: dbTypes[i % dbTypes.length],
                criticality: i <= 5 ? 'CRITICAL' : i <= 12 ? 'HIGH' : 'MEDIUM',
                status: 'OPERATIONAL'
            };

            await runWriteQuery('CREATE (d:ConfigurationItem $props)', { props: db });
            totalCIs++;
        }

        // Step 6: Create business services
        console.log('💼 Creating business services...');
        const businessServices = [
            'E-Commerce Platform', 'Payment Processing', 'User Authentication',
            'Customer Portal', 'Analytics Platform', 'Notification Service'
        ];

        for (let i = 0; i < businessServices.length; i++) {
            const service = {
                id: `biz-svc-${i.toString().padStart(2, '0')}`,
                name: businessServices[i],
                type: 'BusinessService',
                criticality: i < 3 ? 'CRITICAL' : 'HIGH',
                status: 'OPERATIONAL'
            };

            await runWriteQuery('CREATE (bs:ConfigurationItem $props)', { props: service });
            totalCIs++;
        }

        // Step 7: Create relationships (very conservative approach)
        console.log('🔗 Creating relationships...');

        // Apps run on servers (limited)
        await runWriteQuery(`
            MATCH (a:ConfigurationItem) WHERE a.type IN ['WebApplication', 'APIService', 'Microservice']
            WITH collect(a) as apps
            MATCH (s:ConfigurationItem {type: 'Server'})
            WITH apps, collect(s) as servers
            UNWIND range(0, size(apps)-1) as i
            WITH apps[i] as app, servers[i % size(servers)] as server
            CREATE (app)-[:RUNS_ON]->(server)
        `);

        // Apps depend on databases (limited)
        await runWriteQuery(`
            MATCH (a:ConfigurationItem) WHERE a.type IN ['WebApplication', 'APIService', 'Microservice']
            WITH collect(a) as apps
            MATCH (d:ConfigurationItem {type: 'Database'})
            WITH apps, collect(d) as databases
            UNWIND range(0, size(apps)/2) as i
            WITH apps[i] as app, databases[i % size(databases)] as db
            CREATE (app)-[:DEPENDS_ON]->(db)
        `);

        // Apps support business services (limited)
        await runWriteQuery(`
            MATCH (a:ConfigurationItem) WHERE a.type IN ['WebApplication', 'APIService']
            WITH collect(a) as apps
            MATCH (bs:ConfigurationItem {type: 'BusinessService'})
            WITH apps, collect(bs) as services
            UNWIND range(0, size(services)-1) as i
            WITH apps[i % size(apps)] as app, services[i] as service
            CREATE (app)-[:SUPPORTS]->(service)
        `);

        // Count relationships
        const relResult = await runWriteQuery('MATCH ()-[r]->() RETURN count(r) as count');
        totalRelationships = relResult[0].count.toNumber();

        // Step 8: Generate a few events for correlation
        console.log('⚡ Generating events...');
        const eventTemplates = [
            { source: 'monitoring.cpu', message: 'High CPU utilization detected', severity: 'HIGH', ciType: 'Server' },
            { source: 'monitoring.memory', message: 'Memory usage critical', severity: 'HIGH', ciType: 'Server' },
            { source: 'application.api', message: 'API response time degraded', severity: 'MEDIUM', ciType: 'APIService' },
            { source: 'database.connections', message: 'Database connection pool exhausted', severity: 'CRITICAL', ciType: 'Database' },
            { source: 'application.errors', message: 'Application error rate spike', severity: 'HIGH', ciType: 'WebApplication' }
        ];

        const eventCount = 100; // Increased number of events
        const baseTime = new Date();
        const timeRange = 30 * 60 * 1000; // 30 minutes for recent events

        for (let i = 0; i < eventCount; i++) {
            const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];

            // Get random CI of the right type, with fallback to any CI
            let ciResult = await runWriteQuery(`
                MATCH (ci:ConfigurationItem {type: $ciType})
                RETURN ci.id as id
                ORDER BY rand()
                LIMIT 1
            `, { ciType: template.ciType });

            // If no CI of specific type found, use any CI
            if (ciResult.length === 0) {
                ciResult = await runWriteQuery(`
                    MATCH (ci:ConfigurationItem)
                    RETURN ci.id as id
                    ORDER BY rand()
                    LIMIT 1
                `);
            }

            if (ciResult.length > 0) {
                const ciId = ciResult[0].id;
                // Create events more recently and spread across last 30 minutes
                const eventTime = new Date(baseTime.getTime() - Math.random() * timeRange);

                const eventData = {
                    id: uuidv4(),
                    source: template.source,
                    message: template.message,
                    severity: template.severity,
                    eventType: 'ALERT',
                    timestamp: eventTime.toISOString(),
                    status: Math.random() > 0.7 ? 'RESOLVED' : 'OPEN',
                    correlationScore: 0.0,
                    metadata: JSON.stringify({ demo: true, generated: true })
                };

                await runWriteQuery(`
                    MATCH (ci:ConfigurationItem {id: $ciId})
                    CREATE (e:Event $eventData)
                    CREATE (e)-[:AFFECTS]->(ci)
                `, { eventData, ciId });
            }
        }

        console.log(`✅ Demo enterprise CMDB generation completed!`);
        console.log(`   📊 Total CIs: ${totalCIs.toLocaleString()}`);
        console.log(`   🔗 Total Relationships: ${totalRelationships.toLocaleString()}`);

        return {
            totalCIs,
            totalRelationships,
            datacenters: datacenters.length,
            businessServices: businessServices.length,
            message: 'Demo enterprise CMDB data generated successfully'
        };

    } catch (error) {
        console.error('❌ Error generating demo enterprise data:', error);
        throw error;
    }
}

module.exports = { createDemoEnterpriseData };