# Deployment Guide

This guide covers various deployment scenarios for the CMDB application.

## Quick Start

### Local Development
```bash
# 1. Clone and install dependencies
git clone <repository-url>
cd graphdbcmdbconcept
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your configuration

# 3. Start with Docker (recommended)
docker-compose up -d

# 4. Or start services individually
# Start Neo4j and Redis separately, then:
npm run dev
```

### Demo Mode (No Database Required)
```bash
npm run demo
# Access at http://localhost:3000
```

## Environment Setup

### Prerequisites
- **Node.js**: Version 18 or higher
- **Docker**: For containerized deployment (recommended)
- **Neo4j**: Version 5.x (if running locally)
- **Redis**: Version 7.x (if using queue features)

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required settings
NODE_ENV=production|development|test
PORT=3000
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_secure_password

# Optional Redis (for background jobs)
REDIS_URL=redis://localhost:6379
```

## Docker Deployment

### Full Stack with Docker Compose

The easiest way to deploy the complete application:

```bash
# Production deployment
docker-compose up -d

# Development with file watching
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# View logs
docker-compose logs -f app

# Scale workers
docker-compose up -d --scale data-worker=5
```

### Services Included
- **Neo4j**: Graph database with APOC plugins
- **Redis**: Job queue and caching
- **Redis Commander**: Queue monitoring UI
- **Application**: Main CMDB application
- **Data Workers**: Background job processors

### Service Access Points
- Application: http://localhost:3000
- Neo4j Browser: http://localhost:7474
- Redis Commander: http://localhost:8081

### Docker Configuration

#### Application Container
```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

#### Memory and Resource Limits
- **Neo4j**: 6GB memory limit, 3GB heap
- **Redis**: 1GB memory limit
- **Application**: 2GB memory limit per instance

## Manual Deployment

### Local Installation

1. **Install Node.js dependencies**:
   ```bash
   npm ci --production
   ```

2. **Set up Neo4j**:
   ```bash
   # Download and install Neo4j 5.x
   # Enable APOC plugin
   # Set authentication: neo4j/your_password
   # Start Neo4j service
   ```

3. **Set up Redis** (optional):
   ```bash
   # Install and start Redis
   redis-server
   ```

4. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

5. **Start application**:
   ```bash
   npm start
   ```

### Production Considerations

#### Database Configuration
```bash
# Neo4j production settings
NEO4J_server_memory_heap_initial__size=2G
NEO4J_server_memory_heap_max__size=4G
NEO4J_server_memory_pagecache_size=2G
NEO4J_dbms_memory_transaction_total_max=8G
```

#### Application Security
- Change default Neo4j password
- Configure CORS for production domains
- Set up proper logging
- Implement rate limiting
- Use environment variables for secrets

## Cloud Deployment

### AWS Deployment

#### Using ECS with Fargate
```yaml
# docker-compose.aws.yml
version: '3.8'
services:
  app:
    image: your-registry/cmdb-app:latest
    environment:
      - NEO4J_URI=bolt://your-neo4j-cluster:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - REDIS_URL=redis://your-elasticache:6379
    ports:
      - "3000:3000"
```

#### Using EC2
1. Launch EC2 instance with Docker
2. Install Docker Compose
3. Deploy using docker-compose
4. Configure load balancer and auto-scaling

### Azure Deployment

#### Container Instances
```bash
# Create resource group
az group create --name cmdb-rg --location eastus

# Deploy container group
az container create \
  --resource-group cmdb-rg \
  --name cmdb-app \
  --image your-registry/cmdb-app:latest \
  --ports 3000 \
  --environment-variables \
    NODE_ENV=production \
    NEO4J_URI=bolt://your-cosmos-gremlin:443
```

### Google Cloud Platform

#### Cloud Run
```yaml
# cloudrun.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: cmdb-app
spec:
  template:
    spec:
      containers:
      - image: gcr.io/your-project/cmdb-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEO4J_URI
          value: "bolt://your-neo4j:7687"
```

## Kubernetes Deployment

### Basic Kubernetes Configuration

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cmdb-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cmdb-app
  template:
    metadata:
      labels:
        app: cmdb-app
    spec:
      containers:
      - name: cmdb-app
        image: your-registry/cmdb-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEO4J_URI
          valueFrom:
            secretKeyRef:
              name: cmdb-secrets
              key: neo4j-uri
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: cmdb-service
spec:
  selector:
    app: cmdb-app
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### Helm Chart

```yaml
# helm/values.yaml
image:
  repository: your-registry/cmdb-app
  tag: latest

service:
  type: LoadBalancer
  port: 80

ingress:
  enabled: true
  hosts:
    - cmdb.yourdomain.com

neo4j:
  uri: bolt://neo4j-cluster:7687
  username: neo4j
  password: your-password

redis:
  enabled: true
  url: redis://redis-cluster:6379
```

## Monitoring and Health Checks

### Health Check Endpoints
- **Application health**: `GET /health`
- **Database connectivity**: `GET /api/cmdb/database/stats`
- **Detailed metrics**: `GET /metrics` (if enabled)

### Monitoring Setup

#### Prometheus Configuration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'cmdb-app'
    static_configs:
      - targets: ['cmdb-app:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

#### Docker Health Checks
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

## Performance Optimization

### Database Optimization
- **Indexes**: Create indexes on frequently queried properties
- **Connection pooling**: Configure appropriate pool sizes
- **Query optimization**: Use EXPLAIN and PROFILE for slow queries

### Application Optimization
- **Caching**: Implement Redis caching for frequent queries
- **Connection limits**: Configure database connection limits
- **Resource monitoring**: Monitor memory and CPU usage

### Scaling Strategies
- **Horizontal scaling**: Add more application instances
- **Database scaling**: Use Neo4j clustering for high availability
- **Background jobs**: Scale worker processes separately

## Backup and Recovery

### Database Backup
```bash
# Neo4j backup (if using Neo4j Enterprise)
neo4j-admin backup --from=bolt://localhost:7687 --backup-dir=/backups

# Export data for Community Edition
CALL apoc.export.cypher.all("backup.cypher", {})
```

### Application Data
```bash
# Backup configuration and logs
tar -czf app-backup-$(date +%Y%m%d).tar.gz \
  .env logs/ data/
```

### Automated Backup Script
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/$DATE"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker exec cmdb-neo4j neo4j-admin backup \
  --backup-dir=/backups/$DATE

# Backup Redis data
docker exec cmdb-redis redis-cli BGSAVE

# Backup application configuration
cp .env $BACKUP_DIR/
cp docker-compose.yml $BACKUP_DIR/

echo "Backup completed: $BACKUP_DIR"
```

## Security Considerations

### Production Security Checklist
- [ ] Change default database passwords
- [ ] Use environment variables for secrets
- [ ] Configure CORS for production domains
- [ ] Implement API rate limiting
- [ ] Set up SSL/TLS certificates
- [ ] Regular security updates
- [ ] Network security (firewalls, VPCs)
- [ ] Access logging and monitoring

### Network Security
```yaml
# docker-compose.prod.yml
networks:
  cmdb-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

## Troubleshooting

### Common Deployment Issues

#### Container Won't Start
```bash
# Check logs
docker-compose logs app

# Check resource limits
docker stats

# Verify environment variables
docker exec app env
```

#### Database Connection Issues
```bash
# Test Neo4j connectivity
docker exec neo4j cypher-shell -u neo4j -p password

# Check network connectivity
docker exec app nc -zv neo4j 7687
```

#### Performance Issues
```bash
# Monitor resource usage
docker stats

# Check database performance
docker exec neo4j neo4j-admin memrec
```

### Log Analysis
```bash
# Application logs
docker-compose logs -f app

# Database logs
docker-compose logs -f neo4j

# System logs
journalctl -u docker
```

This deployment guide covers the most common deployment scenarios. For specific cloud providers or custom requirements, adapt the configurations accordingly.