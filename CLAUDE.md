# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FancyCMDBConcept** - A modern Configuration Management Database (CMDB) concept application that demonstrates advanced CMDB capabilities using graph database technology and AI-driven correlation analysis.

### Project Structure Quick Reference
```
graphdbcmdbconcept/
├── src/                    # Backend application code
│   ├── app.js             # Main server entry point (production)
│   ├── api/               # REST API route handlers
│   ├── services/          # Business logic and database services
│   └── models/            # Data models and sample data
├── demo-app.js            # Standalone demo server (in-memory)
├── public/                # Frontend static files
│   ├── index.html         # Single-page application
│   ├── css/styles.css     # Main stylesheet
│   └── js/                # Client-side JavaScript modules
├── docker-compose.yml     # Multi-service container orchestration
├── package.json           # Node.js dependencies and scripts
└── CLAUDE.md             # This documentation file
```

## Key Features

### Core CMDB Functionality
- **Configuration Items (CIs)**: Management of IT infrastructure components (servers, applications, databases, network devices)
- **Relationship Modeling**: Dynamic CI relationships using graph database (Neo4j)
- **Topology Visualization**: Real-time dependency mapping with interactive D3.js visualizations
- **Health Monitoring**: System status tracking and health metrics

### Advanced Capabilities
- **AI-Driven Event Correlation**: Automated correlation of IT events using graph algorithms
- **Business Impact Analysis**: Service-centric impact assessment for events
- **Pattern Recognition**: Historical pattern analysis for predictive insights
- **Root Cause Analysis**: Topology-aware incident analysis
- **Real-time Event Processing**: Live event ingestion and correlation

### Web Interface
- **Multi-tab Dashboard**: Overview, Topology, Events, Correlation, and Demo sections
- **Interactive Topology**: Zoomable, filterable network diagrams
- **Event Management**: Real-time event monitoring with severity filtering
- **Correlation Analysis**: Visual correlation results and business impact assessment
- **Demo Mode**: Sample data generation and simulation capabilities

## Development Setup

### Technology Stack
- **Backend**: Node.js 18+ with Express 5.x framework
- **Database**: Neo4j 5.x graph database with APOC procedures
- **Queue System**: Redis 7.x for job processing and caching
- **Frontend**: Vanilla JavaScript with D3.js v7 for visualizations
- **Real-time**: Socket.IO for live updates
- **Container**: Docker Compose for orchestrated deployment
- **Testing**: Jest for unit/integration tests

### Prerequisites
- Node.js 18+ (for local development)
- Docker and Docker Compose (recommended for full stack)
- Neo4j database access (local or containerized)

## Commands

### Development Commands
- `npm run dev` - Start development server with nodemon auto-reload
- `npm start` - Start production server (src/app.js)
- `npm run demo` - Run standalone demo mode with in-memory data (demo-app.js)

### Testing Commands
- `npm test` - Run all tests with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage reports
- `npm run test:integration` - Run integration tests only
- `npm run test:e2e` - Run end-to-end tests with Puppeteer

### Docker Deployment
- `docker-compose up -d` - Start full stack (app + Neo4j + Redis)
- `docker-compose down` - Stop all services and remove containers
- `docker-compose logs -f app` - Follow application logs
- `docker-compose exec neo4j cypher-shell` - Access Neo4j shell

### Access Points
- **Web Application**: http://localhost:3000
- **Neo4j Browser**: http://localhost:7474 (neo4j/password)
- **Redis Commander**: http://localhost:8081 (queue monitoring)
- **Health Check**: http://localhost:3000/health

## Architecture

### Backend Structure
```
src/
├── app.js                 # Main server (Neo4j + Socket.IO + Express)
├── api/
│   ├── cmdb.js           # CMDB operations and database stats
│   ├── events.js         # Event management and filtering
│   ├── correlation.js    # Event correlation and business impact
│   └── demo.js           # Demo data generation endpoints
├── services/
│   ├── neo4j.js          # Neo4j connection and query utilities
│   ├── neo4j-simple.js   # Simplified Neo4j operations
│   └── queueService.js   # Redis-based job queue management
└── models/
    ├── sampleData.js     # Basic sample CI data
    ├── simpleEnterpriseData.js  # Simple enterprise topology
    └── demoEnterpriseData.js    # Complex enterprise demo data
```

### Frontend Structure
```
public/
├── index.html            # Main SPA with tab navigation
├── css/styles.css        # Responsive design and component styles
└── js/
    ├── app.js           # Main application logic and tab management
    ├── topology.js      # D3.js topology visualization
    ├── topology-simple.js # Simplified topology renderer
    ├── correlation.js   # Event correlation analysis UI
    ├── browse.js        # CMDB data browser interface
    └── dataGeneration.js # Demo data generation controls
```

## API Documentation

### CMDB API (`/api/cmdb`)

#### Database Statistics
- **GET** `/api/cmdb/database/stats` - Comprehensive database metrics
  ```json
  {
    "nodes": { "total": 1250, "configItems": 800, "events": 350, "services": 100 },
    "relationships": { "total": 2400, "dependencies": 1200, "affects": 800, "contains": 400 },
    "labels": ["ConfigurationItem", "Event", "Service", "Application"],
    "relationshipTypes": ["DEPENDS_ON", "AFFECTS", "CONTAINS", "RUNS_ON"]
  }
  ```

#### Configuration Items
- **GET** `/api/cmdb/items` - List all configuration items with filtering
  - Query params: `type`, `status`, `limit`, `offset`
- **POST** `/api/cmdb/items` - Create new configuration item
- **GET** `/api/cmdb/items/:id` - Get specific CI with relationships
- **PUT** `/api/cmdb/items/:id` - Update configuration item
- **DELETE** `/api/cmdb/items/:id` - Delete configuration item

#### Topology
- **GET** `/api/cmdb/topology` - Full topology graph data for visualization
- **GET** `/api/cmdb/topology/simple` - Simplified topology for performance
- **POST** `/api/cmdb/topology/filter` - Filter topology by criteria

### Events API (`/api/events`)

#### Event Management
- **GET** `/api/events` - List events with filtering
  - Query params: `severity`, `limit`, `since`
- **POST** `/api/events` - Create new event
- **GET** `/api/events/stats` - Event statistics and metrics

### Correlation API (`/api/correlation`)

#### Analysis Operations
- **POST** `/api/correlation/analyze` - Analyze event correlations
- **GET** `/api/correlation/business-impact` - Business service impact analysis
- **GET** `/api/correlation/patterns` - Historical pattern recognition

### Demo API (`/api/demo`)

#### Data Generation
- **POST** `/api/demo/generate/simple` - Generate simple demo data
- **POST** `/api/demo/generate/enterprise` - Generate enterprise topology
- **DELETE** `/api/demo/clear` - Clear all demo data
- **GET** `/api/demo/status` - Check generation status

## Data Models

### Configuration Item Schema
```javascript
{
  id: "uuid-string",
  name: "Server-001",
  type: "server|application|database|network|service",
  status: "operational|degraded|failed|maintenance",
  properties: {
    environment: "production|staging|development",
    location: "datacenter-1",
    ipAddress: "192.168.1.100",
    // ... type-specific properties
  },
  relationships: [
    { type: "DEPENDS_ON", target: "another-ci-id" },
    { type: "CONTAINS", target: "child-ci-id" }
  ]
}
```

### Event Schema
```javascript
{
  id: "uuid-string",
  title: "High CPU Usage",
  description: "CPU utilization above 90%",
  severity: "critical|major|minor|warning|info",
  timestamp: "2024-01-01T12:00:00Z",
  source: "monitoring-system",
  affectedCI: "ci-uuid",
  correlationId: "correlation-uuid",
  businessImpact: {
    severity: "high|medium|low",
    affectedServices: ["service-1", "service-2"]
  }
}
```

## Development Workflow

### Setting Up Development Environment
1. **Clone repository**: `git clone <repo-url>`
2. **Install dependencies**: `npm install`
3. **Start services**: `docker-compose up -d neo4j redis`
4. **Run development server**: `npm run dev`
5. **Access application**: http://localhost:3000

### Making Changes
1. **Backend changes**: Edit files in `src/` directory
2. **Frontend changes**: Edit files in `public/` directory
3. **Database changes**: Modify queries in `src/services/neo4j.js`
4. **API changes**: Update route handlers in `src/api/`

### Testing Workflow
1. **Run tests**: `npm test`
2. **Check coverage**: `npm run test:coverage`
3. **Integration tests**: `npm run test:integration`
4. **Manual testing**: Use demo data generation in web interface

## Database Configuration

### Neo4j Setup
- **Default credentials**: neo4j/password (change in production)
- **APOC procedures**: Enabled for advanced graph operations
- **Memory configuration**: 3GB heap, 1GB page cache (for enterprise data)
- **Bolt connection**: bolt://localhost:7687

### Environment Variables
```bash
# Database connection
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Redis configuration
REDIS_URL=redis://localhost:6379

# Application settings
NODE_ENV=development
PORT=3000
```

## File Descriptions

### Critical Files
- **src/app.js:40** - Health check endpoint for monitoring
- **src/services/neo4j.js:15** - Database connection verification
- **src/api/cmdb.js:25** - Database statistics query execution
- **public/js/app.js** - Tab navigation and main UI logic
- **public/js/topology.js** - D3.js graph visualization engine
- **docker-compose.yml:70** - Application service configuration

### Configuration Files
- **package.json:6** - NPM scripts for development and testing
- **jest.config.js** - Jest testing framework configuration
- **.dockerignore** - Docker build context exclusions

## Troubleshooting

### Common Issues

#### Neo4j Connection Issues
- **Symptom**: "Failed to connect to Neo4j" error
- **Solutions**:
  1. Check if Neo4j is running: `docker-compose ps`
  2. Verify credentials in environment variables
  3. Ensure port 7687 is accessible
  4. Check Docker network connectivity

#### Memory Issues with Large Datasets
- **Symptom**: Slow queries or out-of-memory errors
- **Solutions**:
  1. Increase Neo4j heap size in docker-compose.yml
  2. Use pagination for large result sets
  3. Add query timeouts and limits
  4. Monitor memory usage in Neo4j browser

#### Frontend Visualization Performance
- **Symptom**: Slow or unresponsive topology visualization
- **Solutions**:
  1. Use simplified topology endpoint for large graphs
  2. Implement node/edge filtering
  3. Add zoom-based level-of-detail rendering
  4. Consider virtualization for very large datasets

### Debug Commands
```bash
# Check service status
docker-compose ps

# View application logs
docker-compose logs -f app

# Access Neo4j shell
docker-compose exec neo4j cypher-shell -u neo4j -p password

# Check Redis queue status
docker-compose exec redis redis-cli

# Run specific test file
npm test -- --testNamePattern="CMDB API"
```

## Performance Optimization

### Database Optimization
- **Indexing**: Ensure proper indexes on frequently queried properties
- **Query optimization**: Use EXPLAIN and PROFILE for slow queries
- **Batch operations**: Use Neo4j transactions for bulk operations
- **Connection pooling**: Configure appropriate pool sizes

### Frontend Optimization
- **D3.js performance**: Implement canvas rendering for large graphs
- **Data loading**: Use pagination and lazy loading
- **Caching**: Implement client-side caching for static data
- **Bundle optimization**: Minimize and compress JavaScript assets

## Security Considerations

### Database Security
- **Authentication**: Change default Neo4j passwords
- **Network security**: Restrict database access to application only
- **Query injection**: Use parameterized queries
- **Backup strategy**: Regular automated backups

### Application Security
- **Input validation**: Validate all API inputs
- **CORS configuration**: Restrict origins in production
- **Error handling**: Don't expose sensitive information in errors
- **Logging**: Log security events and access attempts

## Notes

- **Graph Database Focus**: Leverages Neo4j's graph capabilities for relationship modeling
- **Correlation Engine**: Implements time-based and topology-aware event correlation
- **Scalable Design**: Modular architecture supporting both demo and production modes
- **Visualization-Rich**: Extensive use of D3.js for interactive data visualization
- **Business-Centric**: Focus on business service mapping and impact analysis
- **Real-time Capable**: Designed for live event processing and correlation