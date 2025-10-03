/**
 * AI Infrastructure Service
 *
 * Manages AI-specific Configuration Items and relationships
 * New CI Types:
 * - AIAgent: Autonomous AI agents
 * - A2AOrchestrator: Agent-to-Agent orchestration hubs
 * - MCPServer: Model Context Protocol servers
 * - LLMService: Large Language Model inference endpoints
 * - VectorStore: Vector embedding storage
 * - AgentWorkflow: Multi-step agent workflows
 * - KnowledgeBase: Structured knowledge repositories
 * - LLMObservability: Observability platforms
 *
 * New Relationship Types:
 * - ORCHESTRATES: Orchestrator manages agents
 * - DELEGATES_TO: Agent delegates tasks
 * - PROVIDES_CONTEXT: MCP server provides tools/data
 * - USES_MODEL: Agent uses LLM service
 * - RETRIEVES_FROM: Agent retrieves from vector store
 * - EMBEDDED_IN: Knowledge embedded in vector store
 * - MONITORED_BY: Component monitored by observability platform
 *
 * Part of Phase 4: Enhanced Relationship Modeling
 */

const neo4j = require('neo4j-driver');
const { getDriver } = require('./neo4j');

/**
 * AI CI Type Definitions
 */
const AI_CI_TYPES = {
  AIAgent: {
    label: 'AIAgent',
    requiredProperties: ['model', 'agentType', 'capabilities'],
    defaultProperties: {
      status: 'idle',
      temperature: 0.7,
      maxTokens: 4096
    }
  },
  A2AOrchestrator: {
    label: 'A2AOrchestrator',
    requiredProperties: ['orchestrationType', 'protocol'],
    defaultProperties: {
      status: 'OPERATIONAL',
      maxConcurrentTasks: 10,
      routingStrategy: 'capability-based'
    }
  },
  MCPServer: {
    label: 'MCPServer',
    requiredProperties: ['mcpVersion', 'serverType', 'providedTools'],
    defaultProperties: {
      status: 'OPERATIONAL',
      protocol: 'stdio'
    }
  },
  LLMService: {
    label: 'LLMService',
    requiredProperties: ['provider', 'modelName', 'contextWindow'],
    defaultProperties: {
      status: 'OPERATIONAL'
    }
  },
  VectorStore: {
    label: 'VectorStore',
    requiredProperties: ['storeType', 'dimensions', 'metricType'],
    defaultProperties: {
      status: 'OPERATIONAL',
      indexType: 'HNSW'
    }
  },
  AgentWorkflow: {
    label: 'AgentWorkflow',
    requiredProperties: ['workflowType', 'steps'],
    defaultProperties: {
      status: 'active',
      triggerType: 'manual'
    }
  },
  KnowledgeBase: {
    label: 'KnowledgeBase',
    requiredProperties: ['kbType', 'documentCount'],
    defaultProperties: {
      status: 'OPERATIONAL'
    }
  },
  LLMObservability: {
    label: 'LLMObservability',
    requiredProperties: ['platform', 'trackedMetrics'],
    defaultProperties: {
      status: 'OPERATIONAL',
      tracingEnabled: true,
      loggingLevel: 'info'
    }
  }
};

/**
 * AI Relationship Type Definitions
 */
const AI_RELATIONSHIP_TYPES = {
  ORCHESTRATES: {
    description: 'Orchestrator manages/coordinates agent',
    validFrom: ['A2AOrchestrator'],
    validTo: ['AIAgent'],
    properties: ['priority', 'weight']
  },
  DELEGATES_TO: {
    description: 'Agent delegates tasks to another agent',
    validFrom: ['AIAgent'],
    validTo: ['AIAgent'],
    properties: ['taskType', 'priority']
  },
  PROVIDES_CONTEXT: {
    description: 'MCP server provides tools/data to agent',
    validFrom: ['MCPServer'],
    validTo: ['AIAgent'],
    properties: ['toolName', 'permission']
  },
  USES_MODEL: {
    description: 'Agent uses LLM service for inference',
    validFrom: ['AIAgent', 'AgentWorkflow'],
    validTo: ['LLMService'],
    properties: ['requestsPerDay', 'averageCostPerCall']
  },
  RETRIEVES_FROM: {
    description: 'Agent retrieves embeddings from vector store',
    validFrom: ['AIAgent'],
    validTo: ['VectorStore'],
    properties: ['namespace', 'averageLatencyMs']
  },
  EMBEDDED_IN: {
    description: 'Knowledge base embedded in vector store',
    validFrom: ['KnowledgeBase'],
    validTo: ['VectorStore'],
    properties: ['namespace', 'totalVectors']
  },
  MONITORED_BY: {
    description: 'Component monitored by observability platform',
    validFrom: ['AIAgent', 'AgentWorkflow', 'LLMService'],
    validTo: ['LLMObservability'],
    properties: ['metricsEnabled', 'alertsEnabled']
  }
};

/**
 * Create an AI Configuration Item
 * @param {Object} params - CI parameters
 * @returns {Promise<Object>}
 */
async function createAIConfigurationItem({
  type,
  id,
  name,
  properties = {}
}) {
  const driver = getDriver();
  const session = driver.session();

  try {
    // Validate CI type
    const ciType = AI_CI_TYPES[type];
    if (!ciType) {
      throw new Error(`Invalid AI CI type: ${type}. Valid types: ${Object.keys(AI_CI_TYPES).join(', ')}`);
    }

    // Validate required properties
    for (const req of ciType.requiredProperties) {
      if (properties[req] === undefined) {
        throw new Error(`Missing required property: ${req}`);
      }
    }

    // Merge with default properties
    const finalProperties = {
      ...ciType.defaultProperties,
      ...properties,
      id,
      name,
      type,
      createdAt: new Date().toISOString()
    };

    // Create node with specific label
    const query = `
      CREATE (ci:ConfigurationItem:${ciType.label} $properties)
      RETURN ci, id(ci) AS nodeId
    `;

    const result = await session.run(query, { properties: finalProperties });

    if (result.records.length === 0) {
      throw new Error('Failed to create AI configuration item');
    }

    const record = result.records[0];
    return {
      nodeId: record.get('nodeId').toString(),
      ...record.get('ci').properties
    };

  } finally {
    await session.close();
  }
}

/**
 * Create an AI relationship
 * @param {Object} params - Relationship parameters
 * @returns {Promise<Object>}
 */
async function createAIRelationship({
  from,
  to,
  type,
  properties = {}
}) {
  const driver = getDriver();
  const session = driver.session();

  try {
    // Validate relationship type
    const relType = AI_RELATIONSHIP_TYPES[type];
    if (!relType) {
      throw new Error(`Invalid AI relationship type: ${type}. Valid types: ${Object.keys(AI_RELATIONSHIP_TYPES).join(', ')}`);
    }

    const query = `
      MATCH (source {id: $from})
      MATCH (target {id: $to})
      CREATE (source)-[r:${type} $properties]->(target)
      RETURN r, id(r) AS relId,
             labels(source) AS sourceLabels,
             labels(target) AS targetLabels
    `;

    const result = await session.run(query, {
      from,
      to,
      properties: {
        ...properties,
        createdAt: new Date().toISOString()
      }
    });

    if (result.records.length === 0) {
      throw new Error('Could not create AI relationship: nodes not found');
    }

    const record = result.records[0];
    return {
      id: record.get('relId').toString(),
      type,
      from,
      to,
      properties: record.get('r').properties
    };

  } finally {
    await session.close();
  }
}

/**
 * Get AI agent by capability
 * @param {string} capability - Required capability
 * @returns {Promise<Array>}
 */
async function findAgentsByCapability(capability) {
  const driver = getDriver();
  const session = driver.session();

  try {
    const query = `
      MATCH (agent:AIAgent)
      WHERE $capability IN agent.capabilities
        AND agent.status = 'active'
      RETURN agent
      ORDER BY agent.priority ASC
    `;

    const result = await session.run(query, { capability });

    return result.records.map(record => ({
      ...record.get('agent').properties
    }));

  } finally {
    await session.close();
  }
}

/**
 * Trace agent delegation chain
 * @param {string} agentId - Starting agent ID
 * @param {string} taskType - Task type to trace
 * @returns {Promise<Object>}
 */
async function traceAgentDelegationChain(agentId, taskType) {
  const driver = getDriver();
  const session = driver.session();

  try {
    const query = `
      MATCH path = (start:AIAgent {id: $agentId})
                   -[:DELEGATES_TO*1..5]->(worker:AIAgent)
      WHERE $taskType IN worker.capabilities
      RETURN path,
             [node IN nodes(path) | {
               id: node.id,
               name: node.name,
               agentType: node.agentType,
               model: node.model,
               capabilities: node.capabilities
             }] AS delegationChain,
             length(path) AS delegationDepth
      ORDER BY delegationDepth ASC
      LIMIT 10
    `;

    const result = await session.run(query, { agentId, taskType });

    return result.records.map(record => ({
      delegationChain: record.get('delegationChain'),
      delegationDepth: record.get('delegationDepth'),
      path: record.get('path')
    }));

  } finally {
    await session.close();
  }
}

/**
 * Calculate cost for agent operations
 * @param {string} agentId - Agent ID
 * @param {number} days - Number of days to calculate
 * @returns {Promise<Object>}
 */
async function calculateAgentCost(agentId, days = 30) {
  const driver = getDriver();
  const session = driver.session();

  try {
    const query = `
      MATCH (agent:AIAgent {id: $agentId})-[u:USES_MODEL]->(llm:LLMService)
      WITH agent, llm, u,
           coalesce(u.requestsPerDay, 0) AS reqPerDay,
           coalesce(u.averageCostPerCall, 0) AS costPerCall,
           coalesce(llm.inputPricePerMillion, 0) AS inputPrice,
           coalesce(llm.outputPricePerMillion, 0) AS outputPrice
      RETURN
        agent.name AS agentName,
        llm.modelName AS modelName,
        reqPerDay,
        costPerCall,
        reqPerDay * $days AS totalRequests,
        (reqPerDay * costPerCall * $days) AS estimatedCost,
        inputPrice,
        outputPrice
    `;

    const result = await session.run(query, { agentId, days });

    if (result.records.length === 0) {
      return {
        found: false,
        message: 'Agent or LLM usage not found'
      };
    }

    const record = result.records[0];
    return {
      found: true,
      agentName: record.get('agentName'),
      modelName: record.get('modelName'),
      requestsPerDay: record.get('reqPerDay'),
      totalRequests: record.get('totalRequests'),
      estimatedCost: record.get('estimatedCost'),
      period: `${days} days`,
      llmPricing: {
        inputPricePerMillion: record.get('inputPrice'),
        outputPricePerMillion: record.get('outputPrice')
      }
    };

  } finally {
    await session.close();
  }
}

/**
 * Find bottlenecks in AI infrastructure
 * @returns {Promise<Array>}
 */
async function findAIBottlenecks() {
  const driver = getDriver();
  const session = driver.session();

  try {
    const query = `
      // Find LLM services with high latency
      MATCH (agent:AIAgent)-[:USES_MODEL]->(llm:LLMService)
      WITH llm, count(agent) AS agentCount, llm.averageLatencyMs AS latency
      WHERE latency > 3000 // More than 3 seconds
      RETURN
        'LLM Service' AS componentType,
        llm.id AS componentId,
        llm.name AS componentName,
        'High Latency' AS issue,
        latency AS metricValue,
        agentCount AS affectedAgents
      ORDER BY latency DESC
      LIMIT 10

      UNION

      // Find vector stores with high query latency
      MATCH (agent:AIAgent)-[:RETRIEVES_FROM]->(vs:VectorStore)
      WITH vs, count(agent) AS agentCount, vs.queryLatencyMs AS latency
      WHERE latency > 100 // More than 100ms
      RETURN
        'Vector Store' AS componentType,
        vs.id AS componentId,
        vs.name AS componentName,
        'High Query Latency' AS issue,
        latency AS metricValue,
        agentCount AS affectedAgents
      ORDER BY latency DESC
      LIMIT 10

      UNION

      // Find orchestrators at capacity
      MATCH (orch:A2AOrchestrator)-[:ORCHESTRATES]->(agent:AIAgent)
      WITH orch, count(agent) AS managedAgents, orch.maxConcurrentTasks AS maxTasks
      WHERE managedAgents >= maxTasks * 0.8 // 80% capacity
      RETURN
        'Orchestrator' AS componentType,
        orch.id AS componentId,
        orch.name AS componentName,
        'Near Capacity' AS issue,
        toFloat(managedAgents) AS metricValue,
        managedAgents AS affectedAgents
      ORDER BY managedAgents DESC
      LIMIT 10
    `;

    const result = await session.run(query);

    return result.records.map(record => ({
      componentType: record.get('componentType'),
      componentId: record.get('componentId'),
      componentName: record.get('componentName'),
      issue: record.get('issue'),
      metricValue: record.get('metricValue'),
      affectedAgents: record.get('affectedAgents')
    }));

  } finally {
    await session.close();
  }
}

/**
 * Get AI infrastructure statistics
 * @returns {Promise<Object>}
 */
async function getAIInfrastructureStats() {
  const driver = getDriver();
  const session = driver.session();

  try {
    const query = `
      RETURN
        size((n:AIAgent)) AS totalAgents,
        size((n:AIAgent WHERE n.status = 'active')) AS activeAgents,
        size((n:A2AOrchestrator)) AS orchestrators,
        size((n:MCPServer)) AS mcpServers,
        size((n:LLMService)) AS llmServices,
        size((n:VectorStore)) AS vectorStores,
        size((n:AgentWorkflow)) AS workflows,
        size((n:KnowledgeBase)) AS knowledgeBases,
        size(()-[:ORCHESTRATES]->()) AS orchestrationLinks,
        size(()-[:DELEGATES_TO]->()) AS delegationLinks,
        size(()-[:USES_MODEL]->()) AS modelUsageLinks,
        size(()-[:RETRIEVES_FROM]->()) AS retrievalLinks
    `;

    const result = await session.run(query);
    const record = result.records[0];

    return {
      components: {
        aiAgents: record.get('totalAgents'),
        activeAgents: record.get('activeAgents'),
        orchestrators: record.get('orchestrators'),
        mcpServers: record.get('mcpServers'),
        llmServices: record.get('llmServices'),
        vectorStores: record.get('vectorStores'),
        workflows: record.get('workflows'),
        knowledgeBases: record.get('knowledgeBases')
      },
      relationships: {
        orchestration: record.get('orchestrationLinks'),
        delegation: record.get('delegationLinks'),
        modelUsage: record.get('modelUsageLinks'),
        retrieval: record.get('retrievalLinks')
      }
    };

  } finally {
    await session.close();
  }
}

module.exports = {
  AI_CI_TYPES,
  AI_RELATIONSHIP_TYPES,
  createAIConfigurationItem,
  createAIRelationship,
  findAgentsByCapability,
  traceAgentDelegationChain,
  calculateAgentCost,
  findAIBottlenecks,
  getAIInfrastructureStats
};
