const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { connectToNeo4j, closeConnection } = require('./services/neo4j');
const cmdbRoutes = require('./api/cmdb');
const eventsRoutes = require('./api/events');
const correlationRoutes = require('./api/correlation');
const demoRoutes = require('./api/demo');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/cmdb', cmdbRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/correlation', correlationRoutes);
app.use('/api/demo', demoRoutes);

// Serve main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await closeConnection();
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Connect to Neo4j
    await connectToNeo4j();
    console.log('Connected to Neo4j database');

    // Start the server
    app.listen(PORT, () => {
      console.log(`CMDB Concept Server running on port ${PORT}`);
      console.log(`Neo4j Browser: http://localhost:7474`);
      console.log(`Application: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();