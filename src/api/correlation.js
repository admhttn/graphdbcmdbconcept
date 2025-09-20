const express = require('express');
const { runReadQuery, runWriteQuery } = require('../services/neo4j');

const router = express.Router();

// Advanced correlation analysis
router.get('/analyze', async (req, res) => {
  try {
    const { timeWindow = '1h', minScore = 0.5 } = req.query;

    let timeFilter = '';
    switch (timeWindow) {
      case '5m':
        timeFilter = 'datetime() - duration("PT5M")';
        break;
      case '15m':
        timeFilter = 'datetime() - duration("PT15M")';
        break;
      case '1h':
        timeFilter = 'datetime() - duration("PT1H")';
        break;
      case '6h':
        timeFilter = 'datetime() - duration("PT6H")';
        break;
      default:
        timeFilter = 'datetime() - duration("PT1H")';
    }

    // Find correlated events based on temporal proximity and CI relationships
    const cypher = `
      MATCH (e1:Event)-[:AFFECTS]->(ci1:ConfigurationItem)
      MATCH (e2:Event)-[:AFFECTS]->(ci2:ConfigurationItem)
      WHERE e1.timestamp >= ${timeFilter}
        AND e2.timestamp >= ${timeFilter}
        AND e1.id <> e2.id
        AND duration.between(datetime(e1.timestamp), datetime(e2.timestamp)).seconds <= 300

      OPTIONAL MATCH path = shortestPath((ci1)-[*1..3]-(ci2))

      WITH e1, e2, ci1, ci2, path,
           CASE
             WHEN path IS NULL THEN 0.1
             WHEN length(path) = 1 THEN 0.9
             WHEN length(path) = 2 THEN 0.7
             WHEN length(path) = 3 THEN 0.5
             ELSE 0.3
           END as topologyScore,

           CASE
             WHEN duration.between(datetime(e1.timestamp), datetime(e2.timestamp)).seconds <= 60 THEN 0.9
             WHEN duration.between(datetime(e1.timestamp), datetime(e2.timestamp)).seconds <= 180 THEN 0.7
             WHEN duration.between(datetime(e1.timestamp), datetime(e2.timestamp)).seconds <= 300 THEN 0.5
             ELSE 0.2
           END as temporalScore,

           CASE
             WHEN e1.severity = e2.severity THEN 0.8
             WHEN (e1.severity IN ['CRITICAL', 'HIGH'] AND e2.severity IN ['CRITICAL', 'HIGH']) THEN 0.6
             ELSE 0.3
           END as severityScore

      WITH e1, e2, ci1, ci2, path,
           (topologyScore * 0.5 + temporalScore * 0.3 + severityScore * 0.2) as correlationScore

      WHERE correlationScore >= $minScore

      RETURN e1.id as event1Id,
             e1.message as event1Message,
             e1.severity as event1Severity,
             e1.timestamp as event1Timestamp,
             ci1.name as ci1Name,
             e2.id as event2Id,
             e2.message as event2Message,
             e2.severity as event2Severity,
             e2.timestamp as event2Timestamp,
             ci2.name as ci2Name,
             correlationScore,
             length(path) as relationshipDistance

      ORDER BY correlationScore DESC
      LIMIT 50
    `;

    const correlations = await runReadQuery(cypher, { minScore: parseFloat(minScore) });

    res.json(correlations.map(corr => ({
      correlationScore: corr.correlationScore,
      relationshipDistance: corr.relationshipDistance || null,
      event1: {
        id: corr.event1Id,
        message: corr.event1Message,
        severity: corr.event1Severity,
        timestamp: corr.event1Timestamp,
        ci: corr.ci1Name
      },
      event2: {
        id: corr.event2Id,
        message: corr.event2Message,
        severity: corr.event2Severity,
        timestamp: corr.event2Timestamp,
        ci: corr.ci2Name
      }
    })));
  } catch (error) {
    console.error('Error analyzing correlations:', error);
    res.status(500).json({ error: 'Failed to analyze correlations' });
  }
});

// Root cause analysis using graph algorithms
router.get('/root-cause/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { depth = 3 } = req.query;

    // Find potential root causes by traversing dependency graph upstream
    const cypher = `
      MATCH (e:Event {id: $eventId})-[:AFFECTS]->(affectedCI:ConfigurationItem)

      // Find upstream dependencies
      MATCH path = (affectedCI)<-[*1..${depth}]-(upstreamCI:ConfigurationItem)

      // Look for events on upstream components within time window
      MATCH (upstreamEvent:Event)-[:AFFECTS]->(upstreamCI)
      WHERE upstreamEvent.timestamp <= e.timestamp
        AND duration.between(datetime(upstreamEvent.timestamp), datetime(e.timestamp)).seconds <= 3600

      WITH e, affectedCI, upstreamCI, upstreamEvent, path,
           length(path) as distance,
           duration.between(datetime(upstreamEvent.timestamp), datetime(e.timestamp)).seconds as timeDiff

      // Calculate root cause probability
      WITH e, affectedCI, upstreamCI, upstreamEvent, distance, timeDiff,
           CASE
             WHEN distance = 1 AND timeDiff <= 300 THEN 0.9
             WHEN distance = 1 AND timeDiff <= 600 THEN 0.7
             WHEN distance = 2 AND timeDiff <= 300 THEN 0.6
             WHEN distance = 2 AND timeDiff <= 600 THEN 0.4
             WHEN distance = 3 AND timeDiff <= 300 THEN 0.3
             ELSE 0.1
           END as rootCauseProbability

      WHERE rootCauseProbability >= 0.3

      RETURN upstreamEvent.id as eventId,
             upstreamEvent.message as message,
             upstreamEvent.severity as severity,
             upstreamEvent.timestamp as timestamp,
             upstreamCI.name as ciName,
             upstreamCI.type as ciType,
             distance,
             timeDiff,
             rootCauseProbability

      ORDER BY rootCauseProbability DESC, timeDiff ASC
      LIMIT 10
    `;

    const rootCauses = await runReadQuery(cypher, { eventId, depth: Math.floor(parseInt(depth, 10)) || 3 });

    res.json({
      eventId,
      potentialRootCauses: rootCauses.map(rc => ({
        event: {
          id: rc.eventId,
          message: rc.message,
          severity: rc.severity,
          timestamp: rc.timestamp
        },
        ci: {
          name: rc.ciName,
          type: rc.ciType
        },
        analysis: {
          dependencyDistance: rc.distance,
          timeDelaySeconds: rc.timeDiff,
          probability: rc.rootCauseProbability
        }
      }))
    });
  } catch (error) {
    console.error('Error performing root cause analysis:', error);
    res.status(500).json({ error: 'Failed to perform root cause analysis' });
  }
});

// Business impact correlation
router.get('/business-impact', async (req, res) => {
  try {
    const { timeWindow = '1h' } = req.query;

    let timeFilter = '';
    switch (timeWindow) {
      case '15m':
        timeFilter = 'datetime() - duration("PT15M")';
        break;
      case '1h':
        timeFilter = 'datetime() - duration("PT1H")';
        break;
      case '6h':
        timeFilter = 'datetime() - duration("PT6H")';
        break;
      case '24h':
        timeFilter = 'datetime() - duration("P1D")';
        break;
      default:
        timeFilter = 'datetime() - duration("PT1H")';
    }

    // Correlate technical events with business services
    const cypher = `
      MATCH (e:Event)-[:AFFECTS]->(ci:ConfigurationItem)
      WHERE e.timestamp >= ${timeFilter}

      // Find business services that depend on affected CIs
      OPTIONAL MATCH (ci)-[:SUPPORTS*1..5]->(service:Service)

      WITH e, ci, service,
           CASE
             WHEN service.criticality = 'CRITICAL' THEN 1.0
             WHEN service.criticality = 'HIGH' THEN 0.8
             WHEN service.criticality = 'MEDIUM' THEN 0.5
             WHEN service.criticality = 'LOW' THEN 0.2
             ELSE 0.1
           END as serviceCriticality,

           CASE
             WHEN e.severity = 'CRITICAL' THEN 1.0
             WHEN e.severity = 'HIGH' THEN 0.8
             WHEN e.severity = 'MEDIUM' THEN 0.5
             WHEN e.severity = 'LOW' THEN 0.2
             ELSE 0.1
           END as eventSeverity

      WITH e, ci, service, (serviceCriticality * eventSeverity) as businessImpact

      WHERE businessImpact >= 0.3 OR service IS NULL

      RETURN e.id as eventId,
             e.message as eventMessage,
             e.severity as eventSeverity,
             e.timestamp as eventTimestamp,
             ci.name as ciName,
             ci.type as ciType,
             service.name as serviceName,
             service.criticality as serviceCriticality,
             businessImpact

      ORDER BY businessImpact DESC, e.timestamp DESC
      LIMIT 25
    `;

    const impacts = await runReadQuery(cypher);

    res.json(impacts.map(impact => ({
      event: {
        id: impact.eventId,
        message: impact.eventMessage,
        severity: impact.eventSeverity,
        timestamp: impact.eventTimestamp
      },
      affectedCI: {
        name: impact.ciName,
        type: impact.ciType
      },
      businessService: impact.serviceName ? {
        name: impact.serviceName,
        criticality: impact.serviceCriticality
      } : null,
      businessImpactScore: impact.businessImpact || 0.1
    })));
  } catch (error) {
    console.error('Error analyzing business impact:', error);
    res.status(500).json({ error: 'Failed to analyze business impact' });
  }
});

// Predictive correlation patterns
router.get('/patterns', async (req, res) => {
  try {
    // Find recurring event patterns that might indicate systematic issues
    const cypher = `
      MATCH (e:Event)-[:AFFECTS]->(ci:ConfigurationItem)
      WHERE e.timestamp >= datetime() - duration("P7D")

      WITH ci,
           count(e) as eventCount,
           collect(DISTINCT e.severity) as severities,
           collect(DISTINCT e.eventType) as eventTypes,
           min(e.timestamp) as firstEvent,
           max(e.timestamp) as lastEvent

      WHERE eventCount >= 3

      RETURN ci.id as ciId,
             ci.name as ciName,
             ci.type as ciType,
             eventCount,
             severities,
             eventTypes,
             firstEvent,
             lastEvent,
             duration.between(datetime(firstEvent), datetime(lastEvent)).days as timeSpanDays

      ORDER BY eventCount DESC
      LIMIT 20
    `;

    const patterns = await runReadQuery(cypher);

    res.json(patterns.map(pattern => ({
      ci: {
        id: pattern.ciId,
        name: pattern.ciName,
        type: pattern.ciType
      },
      pattern: {
        eventCount: pattern.eventCount,
        severities: pattern.severities,
        eventTypes: pattern.eventTypes,
        timeSpanDays: pattern.timeSpanDays,
        frequency: pattern.eventCount / Math.max(pattern.timeSpanDays, 1)
      },
      recommendation: pattern.eventCount >= 10 ? 'INVESTIGATE_SYSTEMATIC_ISSUE' :
                     pattern.eventCount >= 5 ? 'MONITOR_CLOSELY' : 'TRACK_TREND'
    })));
  } catch (error) {
    console.error('Error analyzing patterns:', error);
    res.status(500).json({ error: 'Failed to analyze correlation patterns' });
  }
});

// Real-time correlation engine simulation
router.post('/engine/run', async (req, res) => {
  try {
    // Simulate running the correlation engine on recent events
    const cypher = `
      MATCH (e:Event)
      WHERE e.timestamp >= datetime() - duration("PT5M")
        AND e.status = 'OPEN'
        AND (e.correlationScore IS NULL OR e.correlationScore = 0)

      WITH e
      LIMIT 20

      // Calculate correlation scores for these events
      MATCH (e)-[:AFFECTS]->(ci:ConfigurationItem)
      OPTIONAL MATCH (relatedEvent:Event)-[:AFFECTS]->(relatedCI:ConfigurationItem)
      WHERE relatedEvent.id <> e.id
        AND relatedEvent.timestamp >= e.timestamp - duration("PT10M")
        AND relatedEvent.timestamp <= e.timestamp + duration("PT10M")

      OPTIONAL MATCH path = shortestPath((ci)-[*1..3]-(relatedCI))

      WITH e, count(relatedEvent) as relatedCount,
           avg(CASE
             WHEN path IS NULL THEN 0.1
             WHEN length(path) = 1 THEN 0.9
             WHEN length(path) = 2 THEN 0.6
             ELSE 0.3
           END) as avgCorrelationScore

      SET e.correlationScore = coalesce(avgCorrelationScore, 0.0),
          e.relatedEventCount = relatedCount,
          e.lastCorrelationRun = datetime()

      RETURN e.id as eventId,
             e.message as message,
             e.correlationScore as score,
             e.relatedEventCount as relatedCount
    `;

    const results = await runWriteQuery(cypher);

    res.json({
      message: 'Correlation engine run completed',
      processedEvents: results.length,
      results: results.map(r => ({
        eventId: r.eventId,
        message: r.message,
        correlationScore: r.score || 0,
        relatedEventCount: r.relatedCount || 0
      }))
    });
  } catch (error) {
    console.error('Error running correlation engine:', error);
    res.status(500).json({ error: 'Failed to run correlation engine' });
  }
});

module.exports = router;