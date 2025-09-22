const { runWriteQuery } = require('../services/neo4j');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

// Enterprise-scale CMDB data generation for 50,000+ CIs
class EnterpriseDataGenerator {
    constructor() {
        this.createdCIs = [];
        this.relationships = [];
        this.businessServices = [];
        this.customerSegments = [];
        this.datacenters = [];
        this.regions = [];
    }

    // Generate enterprise-scale CMDB with 50,000+ CIs
    async generateEnterpriseData() {
        console.log('🏢 Generating enterprise-scale CMDB data (50,000+ CIs)...');

        try {
            // Clear existing data
            console.log('Clearing existing data...');
            await runWriteQuery('MATCH (n) DETACH DELETE n');

            // Step 1: Create foundational infrastructure (2,000 CIs)
            await this.createFoundationalInfrastructure();

            // Step 2: Create compute infrastructure (15,000 CIs)
            await this.createComputeInfrastructure();

            // Step 3: Create applications and services (20,000 CIs)
            await this.createApplicationsAndServices();

            // Step 4: Create databases and storage (8,000 CIs)
            await this.createDatabasesAndStorage();

            // Step 5: Create monitoring and security (3,000 CIs)
            await this.createMonitoringAndSecurity();

            // Step 6: Create business services and customers (2,000 CIs)
            await this.createBusinessServicesAndCustomers();

            // Step 7: Create all relationships (complex enterprise topology)
            await this.createEnterpriseRelationships();

            // Step 8: Generate realistic events for correlation
            await this.generateEnterpriseEvents();

            const totalCIs = this.createdCIs.length;
            const totalRelationships = this.relationships.length;

            console.log(`✅ Enterprise CMDB generation completed!`);
            console.log(`   📊 Total CIs: ${totalCIs.toLocaleString()}`);
            console.log(`   🔗 Total Relationships: ${totalRelationships.toLocaleString()}`);
            console.log(`   🏢 Datacenters: ${this.datacenters.length}`);
            console.log(`   🌍 Regions: ${this.regions.length}`);
            console.log(`   💼 Business Services: ${this.businessServices.length}`);

            return {
                totalCIs,
                totalRelationships,
                datacenters: this.datacenters.length,
                businessServices: this.businessServices.length,
                message: 'Enterprise-scale CMDB data generated successfully'
            };
        } catch (error) {
            console.error('❌ Error generating enterprise data:', error);
            throw error;
        }
    }

    // Step 1: Create foundational infrastructure (regions, datacenters, networks)
    async createFoundationalInfrastructure() {
        console.log('🌍 Creating foundational infrastructure...');

        // Create global regions
        const regions = [
            { name: 'US East', location: 'Virginia, USA', code: 'us-east-1', customerBase: 40 },
            { name: 'US West', location: 'California, USA', code: 'us-west-1', customerBase: 25 },
            { name: 'US Central', location: 'Texas, USA', code: 'us-central-1', customerBase: 20 },
            { name: 'Europe', location: 'Ireland', code: 'eu-west-1', customerBase: 15 },
            { name: 'Asia Pacific', location: 'Singapore', code: 'ap-southeast-1', customerBase: 10 },
            { name: 'Canada', location: 'Toronto', code: 'ca-central-1', customerBase: 8 },
            { name: 'Australia', location: 'Sydney', code: 'ap-southeast-2', customerBase: 5 }
        ];

        for (const region of regions) {
            const regionCI = {
                id: `region-${region.code}`,
                name: region.name,
                type: 'Region',
                location: region.location,
                code: region.code,
                customerBase: region.customerBase,
                criticality: region.customerBase > 30 ? 'CRITICAL' : region.customerBase > 15 ? 'HIGH' : 'MEDIUM',
                status: 'OPERATIONAL',
                createdAt: new Date().toISOString()
            };

            await this.createCI(regionCI);
            this.regions.push(regionCI);
        }

        // Create datacenters (3-5 per major region)
        for (const region of this.regions) {
            const dcCount = region.customerBase > 20 ? 5 : region.customerBase > 10 ? 3 : 2;

            for (let i = 1; i <= dcCount; i++) {
                const dcCI = {
                    id: `dc-${region.code}-${i.toString().padStart(2, '0')}`,
                    name: `${region.name} Datacenter ${i}`,
                    type: 'DataCenter',
                    region: region.code,
                    location: region.location,
                    criticality: i === 1 ? 'CRITICAL' : i === 2 ? 'HIGH' : 'MEDIUM',
                    status: 'OPERATIONAL',
                    capacity: 'HIGH',
                    tier: i <= 2 ? 'TIER_3' : 'TIER_2',
                    createdAt: new Date().toISOString()
                };

                await this.createCI(dcCI);
                this.datacenters.push(dcCI);

                // Create network infrastructure per datacenter
                await this.createDatacenterNetworking(dcCI, region);
            }
        }
    }

    // Create networking infrastructure for each datacenter
    async createDatacenterNetworking(datacenter, region) {
        const dcId = datacenter.id;

        // Core networking components
        const networkComponents = [
            // Firewalls
            { type: 'Firewall', count: 2, prefix: 'fw', criticality: 'CRITICAL' },
            // Core switches
            { type: 'CoreSwitch', count: 4, prefix: 'sw-core', criticality: 'CRITICAL' },
            // Distribution switches
            { type: 'DistributionSwitch', count: 8, prefix: 'sw-dist', criticality: 'HIGH' },
            // Access switches
            { type: 'AccessSwitch', count: 20, prefix: 'sw-access', criticality: 'MEDIUM' },
            // Load balancers
            { type: 'LoadBalancer', count: 6, prefix: 'lb', criticality: 'HIGH' },
            // Routers
            { type: 'Router', count: 3, prefix: 'rtr', criticality: 'HIGH' }
        ];

        for (const component of networkComponents) {
            for (let i = 1; i <= component.count; i++) {
                const networkCI = {
                    id: `${component.prefix}-${dcId}-${i.toString().padStart(2, '0')}`,
                    name: `${component.type} ${i} - ${datacenter.name}`,
                    type: component.type,
                    datacenter: dcId,
                    region: region.code,
                    criticality: component.criticality,
                    status: Math.random() > 0.02 ? 'OPERATIONAL' : 'MAINTENANCE',
                    vendor: this.getRandomVendor(component.type),
                    createdAt: new Date().toISOString()
                };

                await this.createCI(networkCI);
            }
        }
    }

    // Step 2: Create compute infrastructure (5,000 CIs - optimized for correlation demo)
    async createComputeInfrastructure() {
        console.log('🖥️  Creating compute infrastructure...');

        let serverCount = 0;
        const targetServers = 5000;

        for (const datacenter of this.datacenters) {
            // Calculate servers per datacenter based on region importance
            const region = this.regions.find(r => r.code === datacenter.region);
            const baseServers = Math.floor(targetServers / this.datacenters.length);
            const multiplier = region.customerBase > 30 ? 1.5 : region.customerBase > 15 ? 1.2 : 0.8;
            const serversInDC = Math.floor(baseServers * multiplier);

            // Create server racks and servers
            const rackCount = Math.ceil(serversInDC / 42); // 42 servers per rack

            for (let rackNum = 1; rackNum <= rackCount; rackNum++) {
                // Create rack
                const rackCI = {
                    id: `rack-${datacenter.id}-${rackNum.toString().padStart(3, '0')}`,
                    name: `Rack ${rackNum} - ${datacenter.name}`,
                    type: 'ServerRack',
                    datacenter: datacenter.id,
                    capacity: 42,
                    powerUsage: Math.floor(Math.random() * 8000 + 2000),
                    criticality: 'MEDIUM',
                    status: 'OPERATIONAL',
                    createdAt: new Date().toISOString()
                };

                await this.createCI(rackCI);

                // Create servers in rack
                const serversInRack = Math.min(42, serversInDC - ((rackNum - 1) * 42));

                for (let serverNum = 1; serverNum <= serversInRack; serverNum++) {
                    if (serverCount >= targetServers) break;

                    const serverType = this.getServerType();
                    const serverCI = {
                        id: `srv-${datacenter.id}-${rackNum.toString().padStart(3, '0')}-${serverNum.toString().padStart(2, '0')}`,
                        name: `${serverType.name} ${serverNum} - Rack ${rackNum}`,
                        type: 'Server',
                        serverType: serverType.type,
                        datacenter: datacenter.id,
                        rack: rackCI.id,
                        cpu: serverType.cpu,
                        memory: serverType.memory,
                        storage: serverType.storage,
                        os: serverType.os,
                        criticality: serverType.criticality,
                        status: Math.random() > 0.01 ? 'OPERATIONAL' : 'MAINTENANCE',
                        createdAt: new Date().toISOString()
                    };

                    await this.createCI(serverCI);
                    serverCount++;
                }

                if (serverCount >= targetServers) break;
            }

            if (serverCount >= targetServers) break;
        }

        console.log(`   Created ${serverCount.toLocaleString()} servers across ${this.datacenters.length} datacenters`);
    }

    // Step 3: Create applications and services (8,000 CIs - optimized for correlation demo)
    async createApplicationsAndServices() {
        console.log('📱 Creating applications and microservices...');

        let appCount = 0;
        const targetApps = 8000;

        // Application categories with realistic distributions
        const appCategories = [
            { type: 'WebApplication', ratio: 0.25, criticality: 'HIGH' },
            { type: 'APIService', ratio: 0.20, criticality: 'HIGH' },
            { type: 'Microservice', ratio: 0.30, criticality: 'MEDIUM' },
            { type: 'BackgroundService', ratio: 0.15, criticality: 'MEDIUM' },
            { type: 'ReportingService', ratio: 0.05, criticality: 'LOW' },
            { type: 'AnalyticsService', ratio: 0.05, criticality: 'MEDIUM' }
        ];

        for (const category of appCategories) {
            const appsInCategory = Math.floor(targetApps * category.ratio);

            for (let i = 1; i <= appsInCategory; i++) {
                const appCI = {
                    id: `app-${category.type.toLowerCase()}-${i.toString().padStart(5, '0')}`,
                    name: `${category.type} ${i}`,
                    type: category.type,
                    version: this.getRandomVersion(),
                    technology: this.getRandomTechnology(category.type),
                    criticality: this.getVariedCriticality(category.criticality),
                    status: Math.random() > 0.02 ? 'OPERATIONAL' : 'DEPLOYMENT',
                    environment: Math.random() > 0.2 ? 'PRODUCTION' : Math.random() > 0.5 ? 'STAGING' : 'DEVELOPMENT',
                    createdAt: new Date().toISOString()
                };

                await this.createCI(appCI);
                appCount++;
            }
        }

        console.log(`   Created ${appCount.toLocaleString()} applications and services`);
    }

    // Step 4: Create databases and storage (3,000 CIs - optimized for correlation demo)
    async createDatabasesAndStorage() {
        console.log('🗄️  Creating databases and storage systems...');

        let dbCount = 0;
        const targetDBs = 3000;

        const dbTypes = [
            { type: 'PostgreSQL', ratio: 0.30, criticality: 'HIGH' },
            { type: 'MySQL', ratio: 0.25, criticality: 'HIGH' },
            { type: 'MongoDB', ratio: 0.15, criticality: 'MEDIUM' },
            { type: 'Redis', ratio: 0.10, criticality: 'HIGH' },
            { type: 'Elasticsearch', ratio: 0.08, criticality: 'MEDIUM' },
            { type: 'Oracle', ratio: 0.07, criticality: 'CRITICAL' },
            { type: 'Cassandra', ratio: 0.03, criticality: 'MEDIUM' },
            { type: 'InfluxDB', ratio: 0.02, criticality: 'LOW' }
        ];

        for (const dbType of dbTypes) {
            const dbsOfType = Math.floor(targetDBs * dbType.ratio);

            for (let i = 1; i <= dbsOfType; i++) {
                const dbCI = {
                    id: `db-${dbType.type.toLowerCase()}-${i.toString().padStart(5, '0')}`,
                    name: `${dbType.type} Database ${i}`,
                    type: 'Database',
                    dbType: dbType.type,
                    version: this.getRandomDBVersion(dbType.type),
                    size: this.getRandomDBSize(),
                    criticality: this.getVariedCriticality(dbType.criticality),
                    status: Math.random() > 0.01 ? 'OPERATIONAL' : 'BACKUP_RUNNING',
                    environment: Math.random() > 0.15 ? 'PRODUCTION' : Math.random() > 0.5 ? 'STAGING' : 'DEVELOPMENT',
                    createdAt: new Date().toISOString()
                };

                await this.createCI(dbCI);
                dbCount++;
            }
        }

        console.log(`   Created ${dbCount.toLocaleString()} databases and storage systems`);
    }

    // Step 5: Create monitoring and security (1,000 CIs - optimized for correlation demo)
    async createMonitoringAndSecurity() {
        console.log('🔒 Creating monitoring and security systems...');

        let secCount = 0;
        const targetSec = 1000;

        const securityTypes = [
            { type: 'MonitoringAgent', ratio: 0.40, criticality: 'MEDIUM' },
            { type: 'SecurityScanner', ratio: 0.15, criticality: 'HIGH' },
            { type: 'LogCollector', ratio: 0.20, criticality: 'MEDIUM' },
            { type: 'MetricsCollector', ratio: 0.15, criticality: 'MEDIUM' },
            { type: 'ComplianceChecker', ratio: 0.05, criticality: 'HIGH' },
            { type: 'VulnerabilityScanner', ratio: 0.05, criticality: 'HIGH' }
        ];

        for (const secType of securityTypes) {
            const itemsOfType = Math.floor(targetSec * secType.ratio);

            for (let i = 1; i <= itemsOfType; i++) {
                const secCI = {
                    id: `sec-${secType.type.toLowerCase()}-${i.toString().padStart(5, '0')}`,
                    name: `${secType.type} ${i}`,
                    type: secType.type,
                    version: this.getRandomVersion(),
                    criticality: secType.criticality,
                    status: Math.random() > 0.02 ? 'OPERATIONAL' : 'UPDATING',
                    createdAt: new Date().toISOString()
                };

                await this.createCI(secCI);
                secCount++;
            }
        }

        console.log(`   Created ${secCount.toLocaleString()} monitoring and security components`);
    }

    // Step 6: Create business services and customers (2,000 CIs)
    async createBusinessServicesAndCustomers() {
        console.log('💼 Creating business services and customer segments...');

        // Create business services
        const businessServices = [
            'E-Commerce Platform', 'Customer Portal', 'Payment Processing', 'User Authentication',
            'Product Catalog', 'Order Management', 'Inventory System', 'Customer Support',
            'Analytics Platform', 'Reporting Service', 'Content Management', 'Email Service',
            'Notification System', 'Search Service', 'Recommendation Engine', 'Fraud Detection',
            'Risk Assessment', 'Compliance Monitoring', 'Data Pipeline', 'Machine Learning Platform'
        ];

        for (let i = 0; i < businessServices.length; i++) {
            const serviceCI = {
                id: `svc-business-${i.toString().padStart(3, '0')}`,
                name: businessServices[i],
                type: 'BusinessService',
                criticality: i < 8 ? 'CRITICAL' : i < 16 ? 'HIGH' : 'MEDIUM',
                sla: i < 8 ? '99.9%' : i < 16 ? '99.5%' : '99.0%',
                owner: this.getRandomTeam(),
                status: 'OPERATIONAL',
                createdAt: new Date().toISOString()
            };

            await this.createCI(serviceCI);
            this.businessServices.push(serviceCI);
        }

        // Create customer segments
        const customerSegments = [
            { name: 'Enterprise Customers', size: 2000, revenue: 50000, criticality: 'CRITICAL' },
            { name: 'SMB Customers', size: 15000, revenue: 15000, criticality: 'HIGH' },
            { name: 'Retail Customers', size: 250000, revenue: 5000, criticality: 'HIGH' },
            { name: 'Premium Subscribers', size: 50000, revenue: 12000, criticality: 'HIGH' },
            { name: 'Free Tier Users', size: 1000000, revenue: 500, criticality: 'MEDIUM' },
            { name: 'Trial Users', size: 100000, revenue: 0, criticality: 'LOW' }
        ];

        for (let i = 0; i < customerSegments.length; i++) {
            const segment = customerSegments[i];
            const customerCI = {
                id: `customer-segment-${i.toString().padStart(3, '0')}`,
                name: segment.name,
                type: 'CustomerSegment',
                size: segment.size,
                revenue_per_hour: segment.revenue,
                criticality: segment.criticality,
                status: 'ACTIVE',
                createdAt: new Date().toISOString()
            };

            await this.createCI(customerCI);
            this.customerSegments.push(customerCI);
        }

        console.log(`   Created ${this.businessServices.length} business services and ${this.customerSegments.length} customer segments`);
    }

    // Helper method to create a CI and add to tracking
    async createCI(ciData) {
        const cypher = 'CREATE (ci:ConfigurationItem $ciData) RETURN ci.id';
        await runWriteQuery(cypher, { ciData });
        this.createdCIs.push(ciData);
    }

    // Utility methods for realistic data generation
    getServerType() {
        const types = [
            { type: 'Web', name: 'Web Server', cpu: '16 cores', memory: '32GB', storage: '500GB SSD', os: 'Ubuntu 22.04', criticality: 'HIGH' },
            { type: 'App', name: 'Application Server', cpu: '32 cores', memory: '64GB', storage: '1TB SSD', os: 'RHEL 8', criticality: 'CRITICAL' },
            { type: 'DB', name: 'Database Server', cpu: '64 cores', memory: '256GB', storage: '5TB SSD', os: 'RHEL 8', criticality: 'CRITICAL' },
            { type: 'Cache', name: 'Cache Server', cpu: '16 cores', memory: '128GB', storage: '500GB SSD', os: 'Ubuntu 22.04', criticality: 'HIGH' },
            { type: 'Compute', name: 'Compute Node', cpu: '32 cores', memory: '128GB', storage: '2TB SSD', os: 'Ubuntu 22.04', criticality: 'MEDIUM' },
            { type: 'Storage', name: 'Storage Server', cpu: '8 cores', memory: '32GB', storage: '20TB HDD', os: 'Ubuntu 22.04', criticality: 'HIGH' }
        ];
        return types[Math.floor(Math.random() * types.length)];
    }

    getRandomVendor(componentType) {
        const vendors = {
            'Firewall': ['Cisco', 'Palo Alto', 'Fortinet', 'Check Point'],
            'CoreSwitch': ['Cisco', 'Juniper', 'Arista', 'HPE'],
            'LoadBalancer': ['F5', 'Citrix', 'HAProxy', 'NGINX'],
            'Router': ['Cisco', 'Juniper', 'HPE', 'Arista']
        };
        const vendorList = vendors[componentType] || ['Generic', 'Dell', 'HPE', 'Cisco'];
        return vendorList[Math.floor(Math.random() * vendorList.length)];
    }

    getRandomVersion() {
        const major = Math.floor(Math.random() * 5) + 1;
        const minor = Math.floor(Math.random() * 10);
        const patch = Math.floor(Math.random() * 20);
        return `${major}.${minor}.${patch}`;
    }

    getRandomTechnology(appType) {
        const tech = {
            'WebApplication': ['React', 'Angular', 'Vue.js', 'Django', 'Rails'],
            'APIService': ['Node.js', 'Spring Boot', 'Django REST', 'Express', 'FastAPI'],
            'Microservice': ['Node.js', 'Go', 'Python', 'Java', '.NET Core'],
            'BackgroundService': ['Python', 'Java', 'Go', 'Node.js', 'C++']
        };
        const techList = tech[appType] || ['Generic', 'Custom', 'Legacy'];
        return techList[Math.floor(Math.random() * techList.length)];
    }

    getRandomDBVersion(dbType) {
        const versions = {
            'PostgreSQL': ['15.4', '14.9', '13.12', '12.16'],
            'MySQL': ['8.0.34', '8.0.33', '5.7.43'],
            'MongoDB': ['7.0.2', '6.0.9', '5.0.21'],
            'Redis': ['7.2.1', '7.0.12', '6.2.13'],
            'Oracle': ['21c', '19c', '18c']
        };
        const versionList = versions[dbType] || ['1.0.0'];
        return versionList[Math.floor(Math.random() * versionList.length)];
    }

    getRandomDBSize() {
        const sizes = ['50GB', '100GB', '250GB', '500GB', '1TB', '2TB', '5TB', '10TB'];
        return sizes[Math.floor(Math.random() * sizes.length)];
    }

    getRandomTeam() {
        const teams = ['Platform Team', 'DevOps Team', 'Security Team', 'Data Team', 'Frontend Team', 'Backend Team', 'Mobile Team', 'Analytics Team'];
        return teams[Math.floor(Math.random() * teams.length)];
    }

    getVariedCriticality(baseCriticality) {
        const variations = {
            'CRITICAL': ['CRITICAL', 'CRITICAL', 'HIGH', 'CRITICAL'],
            'HIGH': ['HIGH', 'HIGH', 'MEDIUM', 'HIGH', 'CRITICAL'],
            'MEDIUM': ['MEDIUM', 'MEDIUM', 'LOW', 'HIGH'],
            'LOW': ['LOW', 'LOW', 'MEDIUM']
        };
        const options = variations[baseCriticality] || ['MEDIUM'];
        return options[Math.floor(Math.random() * options.length)];
    }

    // Create realistic enterprise relationships (Step 7)
    async createEnterpriseRelationships() {
        console.log('🔗 Creating enterprise relationships...');

        let relationshipCount = 0;

        // 1. Regional and datacenter relationships
        await this.createInfrastructureRelationships();

        // 2. Server hosting and rack relationships
        await this.createComputeRelationships();

        // 3. Application deployment relationships
        await this.createApplicationRelationships();

        // 4. Database hosting relationships
        await this.createDatabaseRelationships();

        // 5. Service dependency relationships
        await this.createServiceDependencyRelationships();

        // 6. Business service mappings
        await this.createBusinessServiceMappings();

        // 7. Customer service relationships
        await this.createCustomerServiceRelationships();

        // 8. Monitoring relationships
        await this.createMonitoringRelationships();

        console.log(`   Created ${this.relationships.length.toLocaleString()} enterprise relationships`);
    }

    async createInfrastructureRelationships() {
        // Datacenters in regions
        for (const datacenter of this.datacenters) {
            await this.createRelationship(datacenter.id, `region-${datacenter.region}`, 'LOCATED_IN');
        }

        // Network components in datacenters
        const networkTypes = ['Firewall', 'CoreSwitch', 'DistributionSwitch', 'AccessSwitch', 'LoadBalancer', 'Router'];
        for (const networkType of networkTypes) {
            const query = `
                MATCH (n:ConfigurationItem {type: $type})
                MATCH (dc:ConfigurationItem {type: 'DataCenter'})
                WHERE n.datacenter = dc.id
                CREATE (n)-[:HOSTED_IN]->(dc)
            `;
            await runWriteQuery(query, { type: networkType });
        }

        // Network topology (switches connect to other switches, etc.)
        await this.createNetworkTopology();
    }

    async createNetworkTopology() {
        // Core switches connect to distribution switches
        const coreToDistQuery = `
            MATCH (core:ConfigurationItem {type: 'CoreSwitch'})
            MATCH (dist:ConfigurationItem {type: 'DistributionSwitch'})
            WHERE core.datacenter = dist.datacenter
            WITH core, dist
            WHERE rand() < 0.7
            CREATE (dist)-[:CONNECTS_TO]->(core)
        `;
        await runWriteQuery(coreToDistQuery);

        // Distribution switches connect to access switches
        const distToAccessQuery = `
            MATCH (dist:ConfigurationItem {type: 'DistributionSwitch'})
            MATCH (access:ConfigurationItem {type: 'AccessSwitch'})
            WHERE dist.datacenter = access.datacenter
            WITH dist, access
            WHERE rand() < 0.4
            CREATE (access)-[:CONNECTS_TO]->(dist)
        `;
        await runWriteQuery(distToAccessQuery);
    }

    async createComputeRelationships() {
        // Servers in racks
        const serverRackQuery = `
            MATCH (server:ConfigurationItem {type: 'Server'})
            MATCH (rack:ConfigurationItem {type: 'ServerRack'})
            WHERE server.rack = rack.id
            CREATE (server)-[:HOSTED_IN]->(rack)
        `;
        await runWriteQuery(serverRackQuery);

        // Racks in datacenters
        const rackDCQuery = `
            MATCH (rack:ConfigurationItem {type: 'ServerRack'})
            MATCH (dc:ConfigurationItem {type: 'DataCenter'})
            WHERE rack.datacenter = dc.id
            CREATE (rack)-[:HOSTED_IN]->(dc)
        `;
        await runWriteQuery(rackDCQuery);

        // Servers connect to access switches (network connectivity)
        const serverNetworkQuery = `
            MATCH (server:ConfigurationItem {type: 'Server'})
            MATCH (access:ConfigurationItem {type: 'AccessSwitch'})
            WHERE server.datacenter = access.datacenter
            WITH server, access
            WHERE rand() < 0.05
            CREATE (server)-[:CONNECTS_TO]->(access)
        `;
        await runWriteQuery(serverNetworkQuery);
    }

    async createApplicationRelationships() {
        // Applications run on servers
        const appServerQuery = `
            MATCH (app:ConfigurationItem)
            WHERE app.type IN ['WebApplication', 'APIService', 'Microservice', 'BackgroundService', 'ReportingService', 'AnalyticsService']
            MATCH (server:ConfigurationItem {type: 'Server'})
            WHERE server.environment = app.environment OR (server.environment IS NULL AND app.environment = 'PRODUCTION')
            WITH app, server
            WHERE rand() < 0.003
            CREATE (app)-[:RUNS_ON]->(server)
        `;
        await runWriteQuery(appServerQuery);

        // Microservice dependencies (create service mesh)
        const microserviceDepQuery = `
            MATCH (ms1:ConfigurationItem {type: 'Microservice'})
            MATCH (ms2:ConfigurationItem {type: 'Microservice'})
            WHERE ms1.id <> ms2.id AND ms1.environment = ms2.environment
            WITH ms1, ms2
            WHERE rand() < 0.01
            CREATE (ms1)-[:DEPENDS_ON]->(ms2)
        `;
        await runWriteQuery(microserviceDepQuery);

        // API services depend on microservices
        const apiMicroserviceQuery = `
            MATCH (api:ConfigurationItem {type: 'APIService'})
            MATCH (ms:ConfigurationItem {type: 'Microservice'})
            WHERE api.environment = ms.environment
            WITH api, ms
            WHERE rand() < 0.05
            CREATE (api)-[:DEPENDS_ON]->(ms)
        `;
        await runWriteQuery(apiMicroserviceQuery);

        // Web applications depend on API services
        const webApiQuery = `
            MATCH (web:ConfigurationItem {type: 'WebApplication'})
            MATCH (api:ConfigurationItem {type: 'APIService'})
            WHERE web.environment = api.environment
            WITH web, api
            WHERE rand() < 0.1
            CREATE (web)-[:DEPENDS_ON]->(api)
        `;
        await runWriteQuery(webApiQuery);
    }

    async createDatabaseRelationships() {
        // Databases run on database servers
        const dbServerQuery = `
            MATCH (db:ConfigurationItem {type: 'Database'})
            MATCH (server:ConfigurationItem {type: 'Server'})
            WHERE server.serverType = 'DB' AND (server.environment = db.environment OR server.environment IS NULL)
            WITH db, server
            WHERE rand() < 0.05
            CREATE (db)-[:RUNS_ON]->(server)
        `;
        await runWriteQuery(dbServerQuery);

        // Applications depend on databases
        const appDbQuery = `
            MATCH (app:ConfigurationItem)
            WHERE app.type IN ['WebApplication', 'APIService', 'Microservice', 'BackgroundService']
            MATCH (db:ConfigurationItem {type: 'Database'})
            WHERE app.environment = db.environment
            WITH app, db
            WHERE rand() < 0.02
            CREATE (app)-[:DEPENDS_ON]->(db)
        `;
        await runWriteQuery(appDbQuery);

        // Database replication relationships
        const dbReplicationQuery = `
            MATCH (db1:ConfigurationItem {type: 'Database'})
            MATCH (db2:ConfigurationItem {type: 'Database'})
            WHERE db1.id <> db2.id AND db1.dbType = db2.dbType AND db1.environment = db2.environment
            WITH db1, db2
            WHERE rand() < 0.1
            CREATE (db1)-[:REPLICATES_TO]->(db2)
        `;
        await runWriteQuery(dbReplicationQuery);
    }

    async createServiceDependencyRelationships() {
        // Load balancers route to web applications
        const lbWebQuery = `
            MATCH (lb:ConfigurationItem {type: 'LoadBalancer'})
            MATCH (web:ConfigurationItem {type: 'WebApplication'})
            MATCH (server:ConfigurationItem {type: 'Server'})
            WHERE (web)-[:RUNS_ON]->(server) AND server.datacenter = lb.datacenter
            WITH lb, web
            WHERE rand() < 0.1
            CREATE (lb)-[:ROUTES_TO]->(web)
        `;
        await runWriteQuery(lbWebQuery);

        // Monitoring agents monitor servers
        const monitoringQuery = `
            MATCH (monitor:ConfigurationItem {type: 'MonitoringAgent'})
            MATCH (server:ConfigurationItem {type: 'Server'})
            WITH monitor, server
            WHERE rand() < 0.01
            CREATE (monitor)-[:MONITORS]->(server)
        `;
        await runWriteQuery(monitoringQuery);

        // Security scanners scan applications
        const securityQuery = `
            MATCH (scanner:ConfigurationItem {type: 'SecurityScanner'})
            MATCH (app:ConfigurationItem)
            WHERE app.type IN ['WebApplication', 'APIService', 'Microservice']
            WITH scanner, app
            WHERE rand() < 0.005
            CREATE (scanner)-[:SCANS]->(app)
        `;
        await runWriteQuery(securityQuery);
    }

    async createBusinessServiceMappings() {
        // Business services supported by applications
        for (const businessService of this.businessServices) {
            const supportingAppsQuery = `
                MATCH (app:ConfigurationItem)
                WHERE app.type IN ['WebApplication', 'APIService', 'Microservice']
                  AND app.environment = 'PRODUCTION'
                WITH app
                WHERE rand() < 0.1
                MATCH (service:ConfigurationItem {id: $serviceId})
                CREATE (app)-[:SUPPORTS]->(service)
            `;
            await runWriteQuery(supportingAppsQuery, { serviceId: businessService.id });
        }
    }

    async createCustomerServiceRelationships() {
        // Customer segments use business services
        for (const customer of this.customerSegments) {
            for (const service of this.businessServices) {
                if (Math.random() < 0.6) { // 60% chance customers use any given service
                    await this.createRelationship(customer.id, service.id, 'USES');
                }
            }
        }
    }

    async createMonitoringRelationships() {
        // Log collectors collect from applications
        const logCollectorQuery = `
            MATCH (collector:ConfigurationItem {type: 'LogCollector'})
            MATCH (app:ConfigurationItem)
            WHERE app.type IN ['WebApplication', 'APIService', 'Microservice', 'BackgroundService']
            WITH collector, app
            WHERE rand() < 0.01
            CREATE (collector)-[:COLLECTS_FROM]->(app)
        `;
        await runWriteQuery(logCollectorQuery);

        // Metrics collectors collect from servers
        const metricsQuery = `
            MATCH (collector:ConfigurationItem {type: 'MetricsCollector'})
            MATCH (server:ConfigurationItem {type: 'Server'})
            WITH collector, server
            WHERE rand() < 0.005
            CREATE (collector)-[:COLLECTS_FROM]->(server)
        `;
        await runWriteQuery(metricsQuery);
    }

    async createRelationship(fromId, toId, type) {
        const cypher = `
            MATCH (from:ConfigurationItem {id: $fromId})
            MATCH (to:ConfigurationItem {id: $toId})
            CREATE (from)-[:${type}]->(to)
        `;
        try {
            await runWriteQuery(cypher, { fromId, toId });
            this.relationships.push({ from: fromId, to: toId, type });
        } catch (error) {
            // Silently ignore relationship creation errors (nodes might not exist)
        }
    }

    // Generate realistic events for correlation (Step 8)
    async generateEnterpriseEvents() {
        console.log('⚡ Generating enterprise events for correlation...');

        const eventCount = 2000; // Generate 2000 recent events (optimized)
        const timeRange = 24 * 60 * 60 * 1000; // Last 24 hours
        const baseTime = new Date();

        const eventTemplates = [
            // Infrastructure events
            { source: 'monitoring.cpu', severity: 'HIGH', type: 'PERFORMANCE', message: 'High CPU utilization detected', ciTypes: ['Server'] },
            { source: 'monitoring.memory', severity: 'MEDIUM', type: 'PERFORMANCE', message: 'Memory usage threshold exceeded', ciTypes: ['Server'] },
            { source: 'monitoring.disk', severity: 'HIGH', type: 'STORAGE', message: 'Disk space critical', ciTypes: ['Server'] },
            { source: 'network.interface', severity: 'CRITICAL', type: 'NETWORK', message: 'Network interface down', ciTypes: ['CoreSwitch', 'DistributionSwitch'] },
            { source: 'network.latency', severity: 'MEDIUM', type: 'PERFORMANCE', message: 'Network latency spike detected', ciTypes: ['Router', 'LoadBalancer'] },

            // Application events
            { source: 'application.api', severity: 'HIGH', type: 'PERFORMANCE', message: 'API response time degraded', ciTypes: ['APIService', 'WebApplication'] },
            { source: 'application.errors', severity: 'HIGH', type: 'APPLICATION', message: 'Application error rate spike', ciTypes: ['WebApplication', 'Microservice'] },
            { source: 'application.crash', severity: 'CRITICAL', type: 'AVAILABILITY', message: 'Application service crashed', ciTypes: ['APIService', 'Microservice'] },
            { source: 'application.deployment', severity: 'INFO', type: 'CHANGE', message: 'Application deployment completed', ciTypes: ['WebApplication', 'APIService'] },

            // Database events
            { source: 'database.connections', severity: 'CRITICAL', type: 'DATABASE', message: 'Database connection pool exhausted', ciTypes: ['Database'] },
            { source: 'database.performance', severity: 'HIGH', type: 'PERFORMANCE', message: 'Slow database queries detected', ciTypes: ['Database'] },
            { source: 'database.replication', severity: 'MEDIUM', type: 'DATA', message: 'Database replication lag detected', ciTypes: ['Database'] },
            { source: 'database.backup', severity: 'LOW', type: 'BACKUP', message: 'Database backup completed', ciTypes: ['Database'] },

            // Security events
            { source: 'security.scanner', severity: 'HIGH', type: 'SECURITY', message: 'Security vulnerability detected', ciTypes: ['WebApplication', 'APIService'] },
            { source: 'security.access', severity: 'MEDIUM', type: 'SECURITY', message: 'Suspicious access pattern detected', ciTypes: ['LoadBalancer', 'APIService'] },
            { source: 'compliance.check', severity: 'LOW', type: 'COMPLIANCE', message: 'Compliance check completed', ciTypes: ['Database', 'WebApplication'] }
        ];

        for (let i = 0; i < eventCount; i++) {
            const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];

            // Get a random CI of the appropriate type
            const ciType = template.ciTypes[Math.floor(Math.random() * template.ciTypes.length)];
            const randomCIQuery = `
                MATCH (ci:ConfigurationItem {type: $ciType})
                RETURN ci.id as id
                ORDER BY rand()
                LIMIT 1
            `;

            try {
                const ciResult = await runReadQuery(randomCIQuery, { ciType });
                if (ciResult.length === 0) continue;

                const ciId = ciResult[0].id;

                // Generate event with realistic timing
                const eventTime = new Date(baseTime.getTime() - Math.random() * timeRange);

                const eventData = {
                    id: uuidv4(),
                    source: template.source,
                    message: template.message,
                    severity: this.getVariedSeverity(template.severity),
                    eventType: template.type,
                    timestamp: eventTime.toISOString(),
                    status: Math.random() > 0.8 ? 'RESOLVED' : Math.random() > 0.6 ? 'ACKNOWLEDGED' : 'OPEN',
                    correlationScore: 0.0,
                    metadata: JSON.stringify({
                        generated: true,
                        enterprise: true,
                        value: Math.floor(Math.random() * 100),
                        threshold: Math.floor(Math.random() * 80) + 20
                    })
                };

                // Create event and link to CI
                const createEventQuery = `
                    MATCH (ci:ConfigurationItem {id: $ciId})
                    CREATE (e:Event $eventData)
                    CREATE (e)-[:AFFECTS]->(ci)
                `;

                await runWriteQuery(createEventQuery, { eventData, ciId });

            } catch (error) {
                // Continue if event creation fails
                continue;
            }
        }

        console.log(`   Generated ${eventCount.toLocaleString()} enterprise events for correlation analysis`);
    }

    getVariedSeverity(baseSeverity) {
        const variations = {
            'CRITICAL': ['CRITICAL', 'CRITICAL', 'HIGH'],
            'HIGH': ['HIGH', 'HIGH', 'MEDIUM', 'CRITICAL'],
            'MEDIUM': ['MEDIUM', 'MEDIUM', 'LOW', 'HIGH'],
            'LOW': ['LOW', 'LOW', 'MEDIUM'],
            'INFO': ['INFO', 'LOW']
        };
        const options = variations[baseSeverity] || ['MEDIUM'];
        return options[Math.floor(Math.random() * options.length)];
    }
}

// Export the generator
async function createEnterpriseScaleCMDB() {
    const generator = new EnterpriseDataGenerator();
    return await generator.generateEnterpriseData();
}

module.exports = {
    EnterpriseDataGenerator,
    createEnterpriseScaleCMDB
};