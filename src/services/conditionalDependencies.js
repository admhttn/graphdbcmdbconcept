/**
 * Conditional Dependencies Service
 *
 * Manages relationships that activate/deactivate based on system state
 * Supports:
 * - Health-based failover (primary fails → standby activates)
 * - Load-based scaling (high load → backup routes activate)
 * - Scheduled dependencies (time-based activation)
 * - Manual conditional relationships
 * - What-if scenario simulation
 *
 * Part of Phase 3: Enhanced Relationship Modeling
 */

const neo4j = require('neo4j-driver');
const { getDriver } = require('./neo4j');
const EventEmitter = require('events');

class ConditionalDependencyEngine extends EventEmitter {
  constructor() {
    super();
    this.driver = getDriver();
    this.activationHandlers = new Map();
    this.evaluationInterval = null;
    this.registerHandlers();
  }

  /**
   * Register condition type handlers
   */
  registerHandlers() {
    this.activationHandlers.set('health-based', this.handleHealthBased.bind(this));
    this.activationHandlers.set('load-based', this.handleLoadBased.bind(this));
    this.activationHandlers.set('scheduled', this.handleScheduled.bind(this));
    this.activationHandlers.set('manual', this.handleManual.bind(this));
  }

  /**
   * Start continuous evaluation of conditional dependencies
   * @param {number} intervalMs - Evaluation interval in milliseconds (default: 30000)
   */
  startEvaluation(intervalMs = 30000) {
    if (this.evaluationInterval) {
      console.warn('Evaluation already running');
      return;
    }

    console.log(`Starting conditional dependency evaluation (interval: ${intervalMs}ms)`);
    this.evaluationInterval = setInterval(() => {
      this.evaluateConditions().catch(error => {
        console.error('Error during conditional evaluation:', error);
      });
    }, intervalMs);
  }

  /**
   * Stop continuous evaluation
   */
  stopEvaluation() {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
      console.log('Stopped conditional dependency evaluation');
    }
  }

  /**
   * Evaluate all conditional dependencies and activate as needed
   * @returns {Promise<Object>} Evaluation results
   */
  async evaluateConditions() {
    const session = this.driver.session();

    try {
      // Find all conditional dependencies that might need evaluation
      const query = `
        MATCH (source)-[r]->(target)
        WHERE r.conditionType IS NOT NULL
        RETURN source, r, target, type(r) AS relType, id(r) AS relId
      `;

      const result = await session.run(query);
      const evaluations = {
        total: result.records.length,
        activated: 0,
        deactivated: 0,
        unchanged: 0,
        errors: []
      };

      for (const record of result.records) {
        try {
          const source = record.get('source');
          const relationship = record.get('r');
          const target = record.get('target');
          const conditionType = relationship.properties.conditionType;

          const handler = this.activationHandlers.get(conditionType);
          if (handler) {
            const action = await handler(source, relationship, target);
            if (action === 'activated') evaluations.activated++;
            else if (action === 'deactivated') evaluations.deactivated++;
            else evaluations.unchanged++;
          }
        } catch (error) {
          evaluations.errors.push({
            relationship: record.get('relId').toString(),
            error: error.message
          });
        }
      }

      this.emit('evaluation-complete', evaluations);
      return evaluations;

    } finally {
      await session.close();
    }
  }

  /**
   * Handle health-based conditional activation
   * Activates when primary CI health fails
   */
  async handleHealthBased(source, relationship, target) {
    const condition = relationship.properties.activationCondition;
    if (!condition) return 'unchanged';

    const requiredHealth = condition.primaryHealth; // 'FAILED' or 'DEGRADED'
    const currentlyActive = relationship.properties.isActive || false;

    // Check if source health matches activation condition
    if (source.properties.status === requiredHealth) {
      const failureThreshold = condition.failureThreshold || 1;

      // Check consecutive failures (would need to track this in real implementation)
      const shouldActivate = !currentlyActive && target.properties.status === 'OPERATIONAL';

      if (shouldActivate) {
        await this.activateRelationship(relationship.identity, {
          reason: `Health-based failover: ${source.properties.status}`,
          sourceHealth: source.properties.status,
          targetHealth: target.properties.status
        });

        this.emit('failover-activated', {
          source: source.properties.id,
          target: target.properties.id,
          reason: `Health-based failover: ${source.properties.status}`,
          rpo: relationship.properties.rpoMinutes,
          rto: relationship.properties.rtoMinutes
        });

        return 'activated';
      }
    } else if (currentlyActive && source.properties.status === 'OPERATIONAL') {
      // Deactivate failover when primary recovers
      await this.deactivateRelationship(relationship.identity, 'Primary recovered');

      this.emit('failover-deactivated', {
        source: source.properties.id,
        target: target.properties.id,
        reason: 'Primary recovered'
      });

      return 'deactivated';
    }

    return 'unchanged';
  }

  /**
   * Handle load-based conditional activation
   * Activates when load exceeds threshold
   */
  async handleLoadBased(source, relationship, target) {
    const condition = relationship.properties.activationCondition;
    if (!condition) return 'unchanged';

    const currentLoad = source.properties.currentLoad || 0;
    const threshold = condition.threshold || 80;
    const currentlyActive = relationship.properties.isActive || false;

    if (currentLoad >= threshold && !currentlyActive) {
      // Check cooldown period
      const lastDeactivated = relationship.properties.lastDeactivated;
      const cooldownPeriod = condition.cooldownPeriod || 600; // seconds

      if (lastDeactivated) {
        const secondsSince = (Date.now() - new Date(lastDeactivated).getTime()) / 1000;
        if (secondsSince < cooldownPeriod) {
          return 'unchanged'; // Still in cooldown
        }
      }

      await this.activateRelationship(relationship.identity, {
        reason: `Load-based scaling: ${currentLoad}% load`,
        currentLoad,
        threshold
      });

      return 'activated';

    } else if (currentLoad < threshold * 0.8 && currentlyActive) {
      // Deactivate when load drops below 80% of threshold
      await this.deactivateRelationship(relationship.identity, 'Load decreased');
      return 'deactivated';
    }

    return 'unchanged';
  }

  /**
   * Handle scheduled conditional activation
   * Activates based on cron schedule
   */
  async handleScheduled(source, relationship, target) {
    const condition = relationship.properties.activationCondition;
    if (!condition) return 'unchanged';

    const now = new Date();
    const nextActivation = condition.nextActivation ? new Date(condition.nextActivation) : null;
    const duration = condition.duration || 3600; // seconds
    const currentlyActive = relationship.properties.isActive || false;

    if (nextActivation && now >= nextActivation && !currentlyActive) {
      await this.activateRelationship(relationship.identity, {
        reason: 'Scheduled activation',
        schedule: condition.schedule
      });
      return 'activated';
    }

    // Check if active duration has expired
    if (currentlyActive) {
      const lastActivated = relationship.properties.lastActivated;
      if (lastActivated) {
        const activeSeconds = (now.getTime() - new Date(lastActivated).getTime()) / 1000;
        if (activeSeconds >= duration) {
          await this.deactivateRelationship(relationship.identity, 'Scheduled duration expired');
          return 'deactivated';
        }
      }
    }

    return 'unchanged';
  }

  /**
   * Handle manual conditional activation
   * Only activates via explicit API call
   */
  async handleManual(source, relationship, target) {
    // Manual relationships don't auto-activate
    return 'unchanged';
  }

  /**
   * Activate a conditional relationship
   * @param {number} relationshipId - Neo4j relationship identity
   * @param {Object} metadata - Activation metadata
   */
  async activateRelationship(relationshipId, metadata = {}) {
    const session = this.driver.session();

    try {
      const query = `
        MATCH ()-[r]->()
        WHERE id(r) = $relId
        SET r.isActive = true,
            r.lastActivated = datetime(),
            r.activationCount = coalesce(r.activationCount, 0) + 1,
            r.activationReason = $reason,
            r.activationMetadata = $metadata
        RETURN r, startNode(r).id AS sourceId, endNode(r).id AS targetId
      `;

      const result = await session.run(query, {
        relId: neo4j.int(relationshipId),
        reason: metadata.reason || 'Condition met',
        metadata: JSON.stringify(metadata)
      });

      if (result.records.length > 0) {
        console.log(`Activated conditional relationship ${relationshipId}: ${metadata.reason}`);
      }

    } finally {
      await session.close();
    }
  }

  /**
   * Deactivate a conditional relationship
   * @param {number} relationshipId - Neo4j relationship identity
   * @param {string} reason - Deactivation reason
   */
  async deactivateRelationship(relationshipId, reason) {
    const session = this.driver.session();

    try {
      const query = `
        MATCH ()-[r]->()
        WHERE id(r) = $relId
        SET r.isActive = false,
            r.lastDeactivated = datetime(),
            r.deactivationReason = $reason
        RETURN r
      `;

      await session.run(query, {
        relId: neo4j.int(relationshipId),
        reason
      });

      console.log(`Deactivated conditional relationship ${relationshipId}: ${reason}`);

    } finally {
      await session.close();
    }
  }
}

// Singleton instance
let engineInstance = null;

/**
 * Get or create conditional dependency engine instance
 * @returns {ConditionalDependencyEngine}
 */
function getEngine() {
  if (!engineInstance) {
    engineInstance = new ConditionalDependencyEngine();
  }
  return engineInstance;
}

/**
 * Create a conditional relationship
 * @param {Object} params - Relationship parameters
 * @returns {Promise<Object>}
 */
async function createConditionalRelationship({
  from,
  to,
  type,
  conditionType,
  activationCondition,
  properties = {},
  priority = 1,
  automaticFailover = true
}) {
  const driver = getDriver();
  const session = driver.session();

  try {
    const query = `
      MATCH (source:ConfigurationItem {id: $from})
      MATCH (target:ConfigurationItem {id: $to})
      CREATE (source)-[r:${type}]->(target)
      SET r.conditionType = $conditionType,
          r.activationCondition = $activationCondition,
          r.isActive = false,
          r.priority = $priority,
          r.automaticFailover = $automaticFailover,
          r.activationCount = 0,
          r.createdAt = datetime(),
          r += $properties
      RETURN r, id(r) AS relId
    `;

    const result = await session.run(query, {
      from,
      to,
      conditionType,
      activationCondition: JSON.stringify(activationCondition),
      priority,
      automaticFailover,
      properties
    });

    if (result.records.length === 0) {
      throw new Error('Could not create conditional relationship: CIs not found');
    }

    const record = result.records[0];
    return {
      id: record.get('relId').toString(),
      type,
      from,
      to,
      conditionType,
      activationCondition,
      isActive: false,
      priority,
      properties: record.get('r').properties
    };

  } finally {
    await session.close();
  }
}

/**
 * Get all currently active conditional relationships
 * @returns {Promise<Array>}
 */
async function getActiveConditionalRelationships() {
  const driver = getDriver();
  const session = driver.session();

  try {
    const query = `
      MATCH (source)-[r]->(target)
      WHERE r.conditionType IS NOT NULL
        AND r.isActive = true
      RETURN
        source.id AS sourceId,
        source.name AS sourceName,
        target.id AS targetId,
        target.name AS targetName,
        type(r) AS relType,
        r.conditionType AS conditionType,
        r.lastActivated AS lastActivated,
        r.activationReason AS activationReason,
        r.priority AS priority
      ORDER BY r.priority ASC, r.lastActivated DESC
    `;

    const result = await session.run(query);

    return result.records.map(record => ({
      sourceId: record.get('sourceId'),
      sourceName: record.get('sourceName'),
      targetId: record.get('targetId'),
      targetName: record.get('targetName'),
      relationshipType: record.get('relType'),
      conditionType: record.get('conditionType'),
      lastActivated: record.get('lastActivated'),
      activationReason: record.get('activationReason'),
      priority: record.get('priority')
    }));

  } finally {
    await session.close();
  }
}

/**
 * Generate failover plan for a CI
 * @param {string} ciId - Configuration Item ID
 * @returns {Promise<Object>} Failover plan
 */
async function generateFailoverPlan(ciId) {
  const driver = getDriver();
  const session = driver.session();

  try {
    const query = `
      MATCH (primary:ConfigurationItem {id: $ciId})
      MATCH (primary)-[r:FAILS_OVER_TO]->(standby:ConfigurationItem)
      WHERE r.isActive = false
        AND standby.status = 'OPERATIONAL'
      WITH primary, standby, r
      ORDER BY r.priority ASC

      // Find affected applications
      MATCH (app:Application)-[:DEPENDS_ON*1..3]->(primary)

      RETURN
        primary.id AS primaryId,
        primary.name AS primaryName,
        primary.status AS primaryStatus,
        collect(DISTINCT {
          standbyId: standby.id,
          standbyName: standby.name,
          standbyStatus: standby.status,
          priority: r.priority,
          rpo: r.rpoMinutes,
          rto: r.rtoMinutes,
          automaticFailover: r.automaticFailover,
          conditionType: r.conditionType
        }) AS failoverTargets,
        collect(DISTINCT {
          appId: app.id,
          appName: app.name,
          appType: app.type
        }) AS affectedApplications
    `;

    const result = await session.run(query, { ciId });

    if (result.records.length === 0) {
      return {
        found: false,
        message: 'No failover plan configured for this CI'
      };
    }

    const record = result.records[0];
    return {
      found: true,
      primary: {
        id: record.get('primaryId'),
        name: record.get('primaryName'),
        status: record.get('primaryStatus')
      },
      failoverTargets: record.get('failoverTargets'),
      affectedApplications: record.get('affectedApplications'),
      totalTargets: record.get('failoverTargets').length,
      impactedApps: record.get('affectedApplications').length
    };

  } finally {
    await session.close();
  }
}

/**
 * Simulate what-if scenario for condition activation
 * @param {Object} scenario - Scenario parameters
 * @returns {Promise<Object>} Simulation results
 */
async function simulateConditionActivation(scenario) {
  const { ciId, stateChanges } = scenario;
  const driver = getDriver();
  const session = driver.session();

  try {
    // 1. Get current topology
    const topologyQuery = `
      MATCH (ci:ConfigurationItem {id: $ciId})
      OPTIONAL MATCH (ci)-[r]-(connected)
      RETURN ci, collect({rel: r, node: connected}) AS connections
    `;

    const topologyResult = await session.run(topologyQuery, { ciId });

    if (topologyResult.records.length === 0) {
      throw new Error(`CI not found: ${ciId}`);
    }

    // 2. Simulate state changes
    const ci = topologyResult.records[0].get('ci');
    const connections = topologyResult.records[0].get('connections');

    const simulatedState = {
      ...ci.properties,
      ...stateChanges
    };

    // 3. Evaluate which relationships would activate
    const activatedRelationships = [];
    const deactivatedRelationships = [];

    for (const conn of connections) {
      const rel = conn.rel;
      if (!rel || !rel.properties.conditionType) continue;

      const condition = rel.properties.activationCondition;
      let wouldActivate = false;

      // Simple simulation logic
      if (rel.properties.conditionType === 'health-based') {
        wouldActivate = simulatedState.status === 'FAILED';
      } else if (rel.properties.conditionType === 'load-based') {
        const threshold = JSON.parse(condition).threshold || 80;
        wouldActivate = simulatedState.currentLoad >= threshold;
      }

      if (wouldActivate && !rel.properties.isActive) {
        activatedRelationships.push({
          type: rel.type,
          target: conn.node.properties.id,
          targetName: conn.node.properties.name,
          conditionType: rel.properties.conditionType
        });
      } else if (!wouldActivate && rel.properties.isActive) {
        deactivatedRelationships.push({
          type: rel.type,
          target: conn.node.properties.id,
          targetName: conn.node.properties.name
        });
      }
    }

    // 4. Calculate impact
    const impact = {
      affectedCIs: activatedRelationships.length + deactivatedRelationships.length,
      cascadeDepth: activatedRelationships.length > 0 ? 2 : 0 // Simplified
    };

    return {
      ciId,
      currentState: ci.properties,
      simulatedState,
      stateChanges,
      activatedRelationships,
      deactivatedRelationships,
      impact
    };

  } finally {
    await session.close();
  }
}

module.exports = {
  getEngine,
  createConditionalRelationship,
  getActiveConditionalRelationships,
  generateFailoverPlan,
  simulateConditionActivation,
  ConditionalDependencyEngine
};
