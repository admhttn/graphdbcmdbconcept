# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FancyCMDBConcept - A modern Configuration Management Database (CMDB) concept application that demonstrates advanced CMDB capabilities using graph database technology and AI-driven correlation analysis.

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
- **Backend**: Node.js with Express framework
- **Database**: Neo4j graph database
- **Frontend**: HTML5, CSS3, JavaScript with D3.js for visualizations
- **Container**: Docker Compose for easy deployment
- **Dependencies**: UUID generation, CORS support, environment configuration

### Prerequisites
- Node.js (for local development)
- Docker and Docker Compose (for containerized deployment)
- Neo4j database access

## Commands

### Development
- `npm run dev` - Start development server with auto-reload
- `npm start` - Start production server
- `npm run demo` - Run standalone demo mode (in-memory data)

### Docker Deployment
- `docker-compose up -d` - Start full stack (app + Neo4j)
- `docker-compose down` - Stop all services

### Access Points
- **Web Application**: http://localhost:3000
- **Neo4j Browser**: http://localhost:7474
- **Health Check**: http://localhost:3000/health

## Architecture

### Backend Structure
- `src/app.js` - Main application server with Neo4j integration
- `demo-app.js` - Standalone demo version with in-memory data
- `src/api/` - RESTful API routes (CMDB, Events, Correlation, Demo)
- `src/services/` - Business logic and Neo4j database services
- `src/models/` - Data models and schemas
- `src/utils/` - Utility functions

### Frontend Structure
- `public/index.html` - Main single-page application
- `public/css/` - Styling and responsive design
- `public/js/` - Client-side JavaScript modules (app, topology, events, correlation)

### API Endpoints
- `/api/cmdb/items` - Configuration items management
- `/api/cmdb/topology` - Topology data and relationships
- `/api/events` - Event management and statistics
- `/api/correlation/analyze` - Event correlation analysis
- `/api/correlation/business-impact` - Business service impact assessment
- `/api/correlation/patterns` - Pattern recognition results
- `/api/demo/` - Demo data generation and simulation

## Notes

- **Graph Database Focus**: Leverages Neo4j's graph capabilities for relationship modeling
- **Correlation Engine**: Implements time-based and topology-aware event correlation
- **Scalable Design**: Modular architecture supporting both demo and production modes
- **Visualization-Rich**: Extensive use of D3.js for interactive data visualization
- **Business-Centric**: Focus on business service mapping and impact analysis
- **Real-time Capable**: Designed for live event processing and correlation