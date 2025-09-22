const request = require('supertest');

class APIClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  // CMDB API methods
  async getCIs(filters = {}) {
    const queryString = new URLSearchParams(filters).toString();
    const response = await request(this.baseURL)
      .get(`/api/cmdb/items${queryString ? '?' + queryString : ''}`)
      .expect(200);
    return response.body;
  }

  async getCI(id) {
    const response = await request(this.baseURL)
      .get(`/api/cmdb/items/${id}`)
      .expect(200);
    return response.body;
  }

  async createCI(ciData) {
    const response = await request(this.baseURL)
      .post('/api/cmdb/items')
      .send(ciData)
      .expect(201);
    return response.body;
  }

  async getTopology(filters = {}) {
    const queryString = new URLSearchParams(filters).toString();
    const response = await request(this.baseURL)
      .get(`/api/cmdb/topology${queryString ? '?' + queryString : ''}`)
      .expect(200);
    return response.body;
  }

  // Events API methods
  async getEvents(filters = {}) {
    const queryString = new URLSearchParams(filters).toString();
    const response = await request(this.baseURL)
      .get(`/api/events${queryString ? '?' + queryString : ''}`)
      .expect(200);
    return response.body;
  }

  async createEvent(eventData) {
    const response = await request(this.baseURL)
      .post('/api/events')
      .send(eventData)
      .expect(201);
    return response.body;
  }

  async simulateEvent() {
    const response = await request(this.baseURL)
      .post('/api/events/simulate')
      .expect(200);
    return response.body;
  }

  async getEventStats() {
    const response = await request(this.baseURL)
      .get('/api/events/stats')
      .expect(200);
    return response.body;
  }

  // Correlation API methods
  async runCorrelationAnalysis(timeWindow = '1h') {
    const response = await request(this.baseURL)
      .get(`/api/correlation/analyze?timeWindow=${timeWindow}`)
      .expect(200);
    return response.body;
  }

  async getBusinessImpact() {
    const response = await request(this.baseURL)
      .get('/api/correlation/business-impact')
      .expect(200);
    return response.body;
  }

  async getPatterns() {
    const response = await request(this.baseURL)
      .get('/api/correlation/patterns')
      .expect(200);
    return response.body;
  }

  async runCorrelationEngine() {
    const response = await request(this.baseURL)
      .post('/api/correlation/engine/run')
      .expect(200);
    return response.body;
  }

  // Demo API methods
  async loadSampleData() {
    const response = await request(this.baseURL)
      .post('/api/demo/sample-data')
      .expect(200);
    return response.body;
  }

  async loadEnterpriseData() {
    const response = await request(this.baseURL)
      .post('/api/demo/enterprise-data')
      .expect(200);
    return response.body;
  }

  async getImpactAnalysis(componentId, direction = 'downstream', maxDepth = 4) {
    const response = await request(this.baseURL)
      .get(`/api/demo/impact-analysis/${componentId}?direction=${direction}&maxDepth=${maxDepth}`)
      .expect(200);
    return response.body;
  }

  async getGraphAdvantageExamples() {
    const response = await request(this.baseURL)
      .get('/api/demo/graph-advantage-examples')
      .expect(200);
    return response.body;
  }

  async simulateCascade() {
    const response = await request(this.baseURL)
      .post('/api/demo/simulate-cascade')
      .expect(200);
    return response.body;
  }

  // Job Management API methods
  async createJob(jobData) {
    const response = await request(this.baseURL)
      .post('/api/jobs')
      .send(jobData)
      .expect(200);
    return response.body;
  }

  async getJob(jobId) {
    const response = await request(this.baseURL)
      .get(`/api/jobs/${jobId}`)
      .expect(200);
    return response.body;
  }

  async getJobs() {
    const response = await request(this.baseURL)
      .get('/api/jobs')
      .expect(200);
    return response.body;
  }

  async cancelJob(jobId) {
    const response = await request(this.baseURL)
      .delete(`/api/jobs/${jobId}`)
      .expect(200);
    return response.body;
  }

  async getQueueStats() {
    const response = await request(this.baseURL)
      .get('/api/queue/stats')
      .expect(200);
    return response.body;
  }

  // Health check
  async getHealth() {
    const response = await request(this.baseURL)
      .get('/health')
      .expect(200);
    return response.body;
  }
}

module.exports = APIClient;