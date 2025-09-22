const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const { connectToNeo4j, closeConnection } = require('./services/neo4j');
const queueService = require('./services/queueService');
const cmdbRoutes = require('./api/cmdb');
const eventsRoutes = require('./api/events');
const correlationRoutes = require('./api/correlation');
const demoRoutes = require('./api/demo');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

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

// Job Management API Routes
app.post('/api/jobs', async (req, res) => {
  try {
    const { scale = 'medium', customConfig = {} } = req.body;
    const job = await queueService.createDataGenerationJob(scale, customConfig);

    // Emit job created event
    io.emit('job-created', job);

    res.json(job);
  } catch (error) {
    console.error('Failed to create job:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await queueService.getJobStatus(jobId);

    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(status);
  } catch (error) {
    console.error('Failed to get job status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await queueService.getActiveJobs();
    res.json(jobs);
  } catch (error) {
    console.error('Failed to get active jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await queueService.cancelJob(jobId);

    // Emit job cancelled event
    io.emit('job-cancelled', result);

    res.json(result);
  } catch (error) {
    console.error('Failed to cancel job:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/queue/stats', async (req, res) => {
  try {
    const stats = await queueService.getQueueStats();
    res.json(stats);
  } catch (error) {
    console.error('Failed to get queue stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/queue/scales', (req, res) => {
  try {
    const scales = queueService.getScaleConfigs();
    res.json(scales);
  } catch (error) {
    console.error('Failed to get scale configs:', error);
    res.status(500).json({ error: error.message });
  }
});

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

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected to WebSocket');

  socket.on('subscribe-job-progress', (jobId) => {
    socket.join(`job-${jobId}`);
    console.log(`Client subscribed to job progress: ${jobId}`);
  });

  socket.on('unsubscribe-job-progress', (jobId) => {
    socket.leave(`job-${jobId}`);
    console.log(`Client unsubscribed from job progress: ${jobId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected from WebSocket');
  });
});

// Export io for use in other modules
global.io = io;

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await closeConnection();
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Initialize Redis connection for queue service
    await queueService.initializeRedis();
    console.log('Connected to Redis for job queue');

    // Connect to Neo4j
    await connectToNeo4j();
    console.log('Connected to Neo4j database');

    // Start the server
    server.listen(PORT, () => {
      console.log(`CMDB Concept Server running on port ${PORT}`);
      console.log(`Neo4j Browser: http://localhost:7474`);
      console.log(`Application: http://localhost:${PORT}`);
      console.log(`WebSocket server running for real-time updates`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();