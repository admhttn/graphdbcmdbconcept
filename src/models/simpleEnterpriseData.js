const { runWriteQuery } = require('../services/neo4j');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

// Simple, working enterprise data generator focused on correlation demo
async function createSimpleEnterpriseData() {
    console.log('🏢 Generating simplified enterprise CMDB data...');

    try {
        // Clear existing data
        console.log('Clearing existing data...');
        await runWriteQuery('MATCH (n) DETACH DELETE n');

        let totalCIs = 0;
        let totalRelationships = 0;

        // Step 1: Create regions (simple)
        console.log('📍 Creating regions...');
        const regions = [
            { id: 'us-east-1', name: 'US East', location: 'Virginia' },
            { id: 'us-west-1', name: 'US West', location: 'California' },
            { id: 'eu-west-1', name: 'Europe', location: 'Ireland' }
        ];

        for (const region of regions) {
            await runWriteQuery('CREATE (r:ConfigurationItem $props)', {
                props: { ...region, type: 'Region', criticality: 'HIGH', status: 'OPERATIONAL' }
            });
            totalCIs++;
        }

        // Step 2: Create datacenters
        console.log('🏢 Creating datacenters...');
        const datacenters = [];
        for (let i = 0; i < regions.length; i++) {
            for (let j = 1; j <= 3; j++) {
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

        // Step 3: Create servers (simpler approach)
        console.log('🖥️ Creating servers...');
        for (const dc of datacenters) {
            const serverCount = 150; // 150 servers per datacenter = ~1350 total

            for (let i = 1; i <= serverCount; i++) {
                const server = {
                    id: `srv-${dc.id}-${i.toString().padStart(3, '0')}`,
                    name: `Server ${i} - ${dc.name}`,
                    type: 'Server',
                    datacenter: dc.id,
                    serverType: ['Web', 'App', 'DB', 'Cache'][i % 4],
                    criticality: i <= 10 ? 'CRITICAL' : i <= 50 ? 'HIGH' : 'MEDIUM',
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

        // Step 4: Create applications
        console.log('📱 Creating applications...');
        const appTypes = ['WebApplication', 'APIService', 'Microservice', 'BackgroundService'];
        for (let i = 1; i <= 2000; i++) {
            const app = {
                id: `app-${i.toString().padStart(5, '0')}`,
                name: `Application ${i}`,
                type: appTypes[i % appTypes.length],
                version: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}.0`,
                criticality: i <= 200 ? 'CRITICAL' : i <= 800 ? 'HIGH' : 'MEDIUM',
                status: 'OPERATIONAL',
                environment: Math.random() > 0.2 ? 'PRODUCTION' : 'STAGING'
            };

            await runWriteQuery('CREATE (a:ConfigurationItem $props)', { props: app });
            totalCIs++;
        }

        // Step 5: Create databases
        console.log('🗄️ Creating databases...');
        const dbTypes = ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis'];
        for (let i = 1; i <= 800; i++) {
            const db = {
                id: `db-${i.toString().padStart(4, '0')}`,
                name: `Database ${i}`,
                type: 'Database',
                dbType: dbTypes[i % dbTypes.length],
                criticality: i <= 80 ? 'CRITICAL' : i <= 300 ? 'HIGH' : 'MEDIUM',
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

        // Step 7: Create simple relationships (batch approach)
        console.log('🔗 Creating relationships...');

        // Apps run on servers (simplified)
        await runWriteQuery(`
            MATCH (a:ConfigurationItem) WHERE a.type IN ['WebApplication', 'APIService', 'Microservice']
            MATCH (s:ConfigurationItem {type: 'Server'})
            WHERE rand() < 0.05
            CREATE (a)-[:RUNS_ON]->(s)
        `);

        // Apps depend on databases
        await runWriteQuery(`
            MATCH (a:ConfigurationItem) WHERE a.type IN ['WebApplication', 'APIService', 'Microservice']
            MATCH (d:ConfigurationItem {type: 'Database'})
            WHERE rand() < 0.1
            CREATE (a)-[:DEPENDS_ON]->(d)
        `);

        // Microservice dependencies
        await runWriteQuery(`
            MATCH (m1:ConfigurationItem {type: 'Microservice'})
            MATCH (m2:ConfigurationItem {type: 'Microservice'})
            WHERE m1.id <> m2.id AND rand() < 0.05
            CREATE (m1)-[:DEPENDS_ON]->(m2)
        `);

        // Apps support business services
        await runWriteQuery(`
            MATCH (a:ConfigurationItem) WHERE a.type IN ['WebApplication', 'APIService']
            MATCH (bs:ConfigurationItem {type: 'BusinessService'})
            WHERE rand() < 0.3
            CREATE (a)-[:SUPPORTS]->(bs)
        `);

        // Count relationships
        const relResult = await runWriteQuery('MATCH ()-[r]->() RETURN count(r) as count');
        totalRelationships = relResult[0].count.toNumber();

        // Step 8: Generate events for correlation
        console.log('⚡ Generating events...');
        const eventTemplates = [
            { source: 'monitoring.cpu', message: 'High CPU utilization detected', severity: 'HIGH', ciType: 'Server' },
            { source: 'monitoring.memory', message: 'Memory usage critical', severity: 'HIGH', ciType: 'Server' },
            { source: 'application.api', message: 'API response time degraded', severity: 'MEDIUM', ciType: 'APIService' },
            { source: 'database.connections', message: 'Database connection pool exhausted', severity: 'CRITICAL', ciType: 'Database' },
            { source: 'application.errors', message: 'Application error rate spike', severity: 'HIGH', ciType: 'WebApplication' }
        ];

        const eventCount = 500;
        const baseTime = new Date();
        const timeRange = 6 * 60 * 60 * 1000; // 6 hours

        for (let i = 0; i < eventCount; i++) {
            const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];

            // Get random CI of the right type
            const ciResult = await runWriteQuery(`
                MATCH (ci:ConfigurationItem {type: $ciType})
                RETURN ci.id as id
                ORDER BY rand()
                LIMIT 1
            `, { ciType: template.ciType });

            if (ciResult.length > 0) {
                const ciId = ciResult[0].id;
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
                    metadata: JSON.stringify({ enterprise: true, generated: true })
                };

                await runWriteQuery(`
                    MATCH (ci:ConfigurationItem {id: $ciId})
                    CREATE (e:Event $eventData)
                    CREATE (e)-[:AFFECTS]->(ci)
                `, { eventData, ciId });
            }
        }

        console.log(`✅ Simple enterprise CMDB generation completed!`);
        console.log(`   📊 Total CIs: ${totalCIs.toLocaleString()}`);
        console.log(`   🔗 Total Relationships: ${totalRelationships.toLocaleString()}`);

        return {
            totalCIs,
            totalRelationships,
            datacenters: datacenters.length,
            businessServices: businessServices.length,
            message: 'Simple enterprise CMDB data generated successfully'
        };

    } catch (error) {
        console.error('❌ Error generating simple enterprise data:', error);
        throw error;
    }
}

module.exports = { createSimpleEnterpriseData };