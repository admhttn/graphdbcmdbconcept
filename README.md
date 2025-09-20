# Fancy CMDB Concept

A modern Configuration Management Database (CMDB) concept application demonstrating:

- Graph-based CI relationship modeling using Neo4j
- AI-driven event correlation and analysis
- Modern observability integration
- Real-time dependency mapping and impact analysis

## Quick Start

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

2. Start with Docker Compose:
   ```bash
   docker-compose up -d
   ```

3. Access the application:
   - Web UI: http://localhost:3000
   - Neo4j Browser: http://localhost:7474

## Architecture

- **Backend**: Node.js/Express API
- **Database**: Neo4j Graph Database
- **Frontend**: Simple HTML/CSS/JS
- **Container**: Docker Compose

## Key Features

- Dynamic CI relationship discovery
- Event-driven correlation engine
- Topology-aware impact analysis
- Business service mapping
- Real-time dependency visualization