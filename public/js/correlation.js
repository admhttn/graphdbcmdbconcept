// Correlation analysis functionality
class CorrelationAnalysis {
    constructor() {
        this.init();
    }

    init() {
        if (window.logInfo) {
            window.logInfo('Correlation analysis module initializing');
        }
        this.bindEvents();
        if (window.logSuccess) {
            window.logSuccess('Correlation analysis module initialized');
        }
    }

    bindEvents() {
        document.getElementById('run-correlation')?.addEventListener('click', () => {
            this.runCorrelationAnalysis();
        });

        document.getElementById('run-engine')?.addEventListener('click', () => {
            this.runCorrelationEngine();
        });


        // Real-time correlation analysis

        document.getElementById('start-realtime-stream')?.addEventListener('click', () => {
            this.startRealtimeEventStream();
        });

        document.getElementById('stop-realtime-stream')?.addEventListener('click', () => {
            this.stopRealtimeEventStream();
        });

        // Auto-load patterns when correlation tab becomes active
        this.setupTabWatcher();
    }

    setupTabWatcher() {
        // Watch for correlation tab activation
        const correlationTabBtn = document.querySelector('[data-tab="correlation"]');
        if (correlationTabBtn) {
            correlationTabBtn.addEventListener('click', () => {
                // Load patterns automatically when tab is activated
                setTimeout(() => {
                    this.loadPatterns();
                }, 100);
            });
        }

        // Also load patterns if correlation tab is already active on page load
        if (document.getElementById('correlation')?.classList.contains('active')) {
            setTimeout(() => {
                this.loadPatterns();
            }, 500);
        }
    }

    async runCorrelationAnalysis() {
        try {
            const timeWindow = document.getElementById('time-window')?.value || '1h';

            if (window.logInfo) {
                window.logInfo(`Starting correlation analysis with time window: ${timeWindow}`);
            }

            // Show loading state
            document.getElementById('correlations-list').innerHTML = '<div class="loading">Analyzing correlations...</div>';
            document.getElementById('business-impact').innerHTML = '<div class="loading">Analyzing business impact...</div>';

            // Run correlation analysis
            const [correlationsResponse, impactResponse] = await Promise.all([
                fetch(`/api/correlation/analyze?timeWindow=${timeWindow}&minScore=0.3`),
                fetch(`/api/correlation/business-impact?timeWindow=${timeWindow}`)
            ]);

            const correlations = await correlationsResponse.json();
            const impacts = await impactResponse.json();

            if (window.logSuccess) {
                window.logSuccess(`Correlation analysis completed: ${correlations.length} correlations, ${impacts.length} impacts`);
            }

            this.displayCorrelations(correlations);
            this.displayBusinessImpact(impacts);

        } catch (error) {
            if (window.logError) {
                window.logError('Correlation analysis failed', { error: error.message });
            }
            console.error('Error running correlation analysis:', error);
            this.showError('Failed to run correlation analysis');
        }
    }

    async runCorrelationEngine() {
        try {
            if (window.logInfo) {
                window.logInfo('Starting correlation engine');
            }

            document.getElementById('correlations-list').innerHTML = '<div class="loading">Running correlation engine...</div>';

            const response = await fetch('/api/correlation/engine/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();

            if (window.logSuccess) {
                window.logSuccess(`Correlation engine completed: ${result.processedEvents} events processed, ${result.results.length} results`);
            }

            // Show engine results
            const engineResults = `
                <div class="correlation-item">
                    <h4>Correlation Engine Results</h4>
                    <p><strong>Processed Events:</strong> ${result.processedEvents}</p>
                    <div class="engine-results">
                        ${result.results.map(r => `
                            <div class="result-item">
                                <div><strong>Event:</strong> ${r.message}</div>
                                <div><strong>Score:</strong> ${r.correlationScore.toFixed(3)}</div>
                                <div><strong>Related Events:</strong> ${r.relatedEventCount}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            document.getElementById('correlations-list').innerHTML = engineResults;

            if (window.app) {
                window.app.showNotification('Correlation engine completed successfully', 'success');
            }

        } catch (error) {
            if (window.logError) {
                window.logError('Correlation engine failed', { error: error.message });
            }
            console.error('Error running correlation engine:', error);
            this.showError('Failed to run correlation engine');
        }
    }

    displayCorrelations(correlations) {
        const container = document.getElementById('correlations-list');

        if (correlations.length === 0) {
            container.innerHTML = '<div class="loading">No correlations found</div>';
            return;
        }

        // Sort correlations by timestamp for timeline view
        const sortedCorrelations = correlations.sort((a, b) => {
            const timeA = new Date(Math.min(new Date(a.event1.timestamp), new Date(a.event2.timestamp)));
            const timeB = new Date(Math.min(new Date(b.event1.timestamp), new Date(b.event2.timestamp)));
            return timeA - timeB;
        });

        container.innerHTML = `
            <div class="correlation-timeline">
                ${this.renderCorrelationTimeline(sortedCorrelations)}
            </div>
            <div class="correlation-details">
                ${sortedCorrelations.map(corr => this.renderCorrelationItem(corr)).join('')}
            </div>
        `;
    }

    renderCorrelationTimeline(correlations) {
        if (correlations.length === 0) return '';

        const allTimes = correlations.flatMap(corr => [
            new Date(corr.event1.timestamp),
            new Date(corr.event2.timestamp)
        ]);
        const minTime = Math.min(...allTimes);
        const maxTime = Math.max(...allTimes);
        const timeSpan = maxTime - minTime;

        return `
            <div class="timeline-header">
                <h4>📈 Correlation Timeline</h4>
                <span class="timeline-span">Time span: ${this.formatDuration(timeSpan)}</span>
            </div>
            <div class="timeline-container">
                <div class="timeline-axis">
                    ${correlations.map((corr, index) => {
                        const event1Time = new Date(corr.event1.timestamp);
                        const event2Time = new Date(corr.event2.timestamp);
                        const earlierTime = Math.min(event1Time, event2Time);
                        const laterTime = Math.max(event1Time, event2Time);

                        const startPosition = timeSpan > 0 ? ((earlierTime - minTime) / timeSpan) * 100 : 0;
                        const endPosition = timeSpan > 0 ? ((laterTime - minTime) / timeSpan) * 100 : 100;
                        const width = Math.max(endPosition - startPosition, 2);

                        return `
                            <div class="timeline-correlation"
                                 style="left: ${startPosition}%; width: ${width}%;"
                                 data-correlation-index="${index}">
                                <div class="timeline-bar ${this.getScoreClass(corr.correlationScore)}"
                                     title="Score: ${corr.correlationScore.toFixed(3)}">
                                    <span class="timeline-score">${corr.correlationScore.toFixed(2)}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="timeline-labels">
                    <span class="timeline-start">${this.formatTimestamp(new Date(minTime))}</span>
                    <span class="timeline-end">${this.formatTimestamp(new Date(maxTime))}</span>
                </div>
            </div>
        `;
    }

    renderCorrelationItem(corr) {
        const timeDiff = Math.abs(new Date(corr.event1.timestamp) - new Date(corr.event2.timestamp));

        return `
            <div class="correlation-item enhanced">
                <div class="correlation-header">
                    <div class="correlation-score ${this.getScoreClass(corr.correlationScore)}">
                        Score: ${corr.correlationScore.toFixed(3)}
                    </div>
                    <div class="correlation-timing">
                        Time diff: ${this.formatDuration(timeDiff)}
                    </div>
                </div>

                <div class="correlation-events">
                    <div class="event-pair">
                        <div class="event-1">
                            <div class="event-header">
                                <strong>${corr.event1.ci}</strong>
                                <span class="severity-badge severity-${corr.event1.severity.toLowerCase()}">${corr.event1.severity}</span>
                            </div>
                            <div class="event-message">${corr.event1.message}</div>
                            <div class="event-meta">
                                <span class="event-time">${this.formatTimestamp(corr.event1.timestamp)}</span>
                            </div>
                        </div>
                        <div class="correlation-arrow">
                            <div class="arrow-line"></div>
                            <div class="arrow-head">→</div>
                        </div>
                        <div class="event-2">
                            <div class="event-header">
                                <strong>${corr.event2.ci}</strong>
                                <span class="severity-badge severity-${corr.event2.severity.toLowerCase()}">${corr.event2.severity}</span>
                            </div>
                            <div class="event-message">${corr.event2.message}</div>
                            <div class="event-meta">
                                <span class="event-time">${this.formatTimestamp(corr.event2.timestamp)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="correlation-insights">
                        ${corr.relationshipDistance !== null ? `
                            <div class="insight-item">
                                <span class="insight-label">🔗 Topology:</span>
                                <span class="insight-value">${corr.relationshipDistance} hop dependency chain</span>
                            </div>
                        ` : `
                            <div class="insight-item">
                                <span class="insight-label">🔗 Topology:</span>
                                <span class="insight-value">No direct dependency relationship</span>
                            </div>
                        `}

                        <div class="insight-item">
                            <span class="insight-label">⏱️ Temporal:</span>
                            <span class="insight-value">${timeDiff < 60000 ? 'High temporal proximity' :
                                                      timeDiff < 300000 ? 'Medium temporal proximity' : 'Low temporal proximity'}</span>
                        </div>

                        <div class="insight-item">
                            <span class="insight-label">🎯 Severity:</span>
                            <span class="insight-value">${corr.event1.severity === corr.event2.severity ? 'Matching severity levels' : 'Different severity levels'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    displayBusinessImpact(impacts) {
        const container = document.getElementById('business-impact');

        if (impacts.length === 0) {
            container.innerHTML = '<div class="loading">No business impact detected</div>';
            return;
        }

        // Calculate total impact and sort by impact score
        const sortedImpacts = impacts.sort((a, b) => b.businessImpactScore - a.businessImpactScore);
        const totalImpactScore = impacts.reduce((sum, impact) => sum + impact.businessImpactScore, 0);
        const criticalImpacts = impacts.filter(impact => impact.businessImpactScore >= 0.7).length;
        const highImpacts = impacts.filter(impact => impact.businessImpactScore >= 0.4).length;

        // Group impacts by business service
        const serviceGroups = {};
        impacts.forEach(impact => {
            const serviceName = impact.businessService?.name || 'No Service';
            if (!serviceGroups[serviceName]) {
                serviceGroups[serviceName] = [];
            }
            serviceGroups[serviceName].push(impact);
        });

        container.innerHTML = `
            <div class="business-impact-summary">
                <h4>📊 Business Impact Summary</h4>
                <div class="impact-metrics">
                    <div class="metric-item">
                        <span class="metric-label">Total Impact Score:</span>
                        <span class="metric-value">${totalImpactScore.toFixed(2)}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Critical Impacts:</span>
                        <span class="metric-value critical">${criticalImpacts}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">High+ Impacts:</span>
                        <span class="metric-value high">${highImpacts}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Services Affected:</span>
                        <span class="metric-value">${Object.keys(serviceGroups).filter(s => s !== 'No Service').length}</span>
                    </div>
                </div>
            </div>

            <div class="business-impact-details">
                ${Object.entries(serviceGroups).map(([serviceName, serviceImpacts]) => `
                    <div class="service-group">
                        <div class="service-header">
                            <h5>${serviceName === 'No Service' ? '🔧 Infrastructure Events' : '🏢 ' + serviceName}</h5>
                            <span class="service-impact-count">${serviceImpacts.length} events</span>
                        </div>
                        <div class="service-impacts">
                            ${serviceImpacts.map(impact => this.renderBusinessImpactItem(impact)).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderBusinessImpactItem(impact) {
        // Calculate estimated revenue impact (simplified calculation)
        let revenueEstimate = 0;
        if (impact.businessService) {
            revenueEstimate = impact.businessImpactScore * 10000; // $10k/hour baseline
            if (impact.businessService.criticality === 'CRITICAL') revenueEstimate *= 2;
            if (impact.businessService.criticality === 'HIGH') revenueEstimate *= 1.5;
        }

        const timeSinceEvent = Date.now() - new Date(impact.event.timestamp);
        const urgencyLevel = timeSinceEvent < 300000 ? 'high' : timeSinceEvent < 1800000 ? 'medium' : 'low';

        return `
            <div class="impact-item enhanced">
                <div class="impact-header">
                    <div class="impact-score ${this.getImpactClass(impact.businessImpactScore)}">
                        Impact: ${impact.businessImpactScore.toFixed(2)}
                    </div>
                    <div class="impact-urgency urgency-${urgencyLevel}">
                        ${urgencyLevel === 'high' ? '🚨' : urgencyLevel === 'medium' ? '⚠️' : '📋'}
                        ${urgencyLevel.toUpperCase()}
                    </div>
                    <div class="impact-timestamp">${this.formatTimestamp(impact.event.timestamp)}</div>
                </div>

                <div class="impact-content">
                    <div class="impact-event">
                        <div class="event-severity">
                            <span class="severity-badge severity-${impact.event.severity.toLowerCase()}">${impact.event.severity}</span>
                        </div>
                        <div class="event-message">${impact.event.message}</div>
                    </div>

                    <div class="impact-details">
                        <div class="detail-item">
                            <span class="detail-label">🖥️ Component:</span>
                            <span class="detail-value">${impact.affectedCI.name} (${impact.affectedCI.type})</span>
                        </div>

                        ${impact.businessService ? `
                            <div class="detail-item">
                                <span class="detail-label">🏢 Service:</span>
                                <span class="detail-value">
                                    ${impact.businessService.name}
                                    <span class="service-criticality-badge ${impact.businessService.criticality.toLowerCase()}">
                                        ${impact.businessService.criticality}
                                    </span>
                                </span>
                            </div>
                        ` : `
                            <div class="detail-item">
                                <span class="detail-label">🏢 Service:</span>
                                <span class="detail-value no-service">No direct business service</span>
                            </div>
                        `}

                        ${revenueEstimate > 0 ? `
                            <div class="detail-item revenue-impact">
                                <span class="detail-label">💰 Revenue Risk:</span>
                                <span class="detail-value revenue-value">~$${Math.round(revenueEstimate).toLocaleString()}/hour</span>
                            </div>
                        ` : ''}
                    </div>

                    <div class="impact-recommendations">
                        ${this.generateImpactRecommendations(impact)}
                    </div>
                </div>
            </div>
        `;
    }

    generateImpactRecommendations(impact) {
        const recommendations = [];

        if (impact.businessImpactScore >= 0.7) {
            recommendations.push('🔴 Immediate escalation required');
        } else if (impact.businessImpactScore >= 0.4) {
            recommendations.push('🟡 Monitor closely and prepare escalation');
        } else {
            recommendations.push('🟢 Standard monitoring sufficient');
        }

        if (impact.businessService?.criticality === 'CRITICAL') {
            recommendations.push('📞 Notify business stakeholders');
        }

        if (impact.event.severity === 'CRITICAL') {
            recommendations.push('🛠️ Engage emergency response team');
        }

        return recommendations.length > 0 ? `
            <div class="recommendations">
                <span class="recommendations-label">Recommendations:</span>
                <ul class="recommendations-list">
                    ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        ` : '';
    }

    async loadPatterns() {
        try {
            if (window.logInfo) {
                window.logInfo('Loading correlation patterns');
            }
            const response = await fetch('/api/correlation/patterns');
            const patterns = await response.json();

            if (window.logSuccess) {
                window.logSuccess(`Loaded ${patterns.length} correlation patterns`);
            }
            this.displayPatterns(patterns);
        } catch (error) {
            if (window.logError) {
                window.logError('Failed to load patterns', { error: error.message });
            }
            console.error('Error loading patterns:', error);
            document.getElementById('patterns').innerHTML = '<div class="loading">Failed to load patterns</div>';
        }
    }

    displayPatterns(patterns) {
        const container = document.getElementById('patterns');

        if (patterns.length === 0) {
            container.innerHTML = '<div class="loading">No patterns detected</div>';
            return;
        }

        container.innerHTML = patterns.map(pattern => `
            <div class="pattern-item">
                <div class="pattern-header">
                    <strong>${pattern.ci.name}</strong> (${pattern.ci.type})
                </div>
                <div class="pattern-stats">
                    <span><strong>Events:</strong> ${pattern.pattern.eventCount}</span>
                    <span><strong>Frequency:</strong> ${pattern.pattern.frequency.toFixed(2)}/day</span>
                    <span><strong>Time Span:</strong> ${pattern.pattern.timeSpanDays} days</span>
                </div>
                <div class="pattern-details">
                    <div><strong>Severities:</strong> ${pattern.pattern.severities.join(', ')}</div>
                    <div><strong>Event Types:</strong> ${pattern.pattern.eventTypes.join(', ')}</div>
                </div>
                <div class="pattern-recommendation ${this.getRecommendationClass(pattern.recommendation)}">
                    ${this.formatRecommendation(pattern.recommendation)}
                </div>
            </div>
        `).join('');
    }

    getScoreClass(score) {
        if (score >= 0.7) return 'score-high';
        if (score >= 0.4) return 'score-medium';
        return 'score-low';
    }

    getImpactClass(score) {
        if (score >= 0.7) return 'score-high';
        if (score >= 0.4) return 'score-medium';
        return 'score-low';
    }

    getRecommendationClass(recommendation) {
        switch (recommendation) {
            case 'INVESTIGATE_SYSTEMATIC_ISSUE':
                return 'rec-investigate';
            case 'MONITOR_CLOSELY':
                return 'rec-monitor';
            case 'TRACK_TREND':
                return 'rec-track';
            default:
                return 'rec-track';
        }
    }

    formatRecommendation(recommendation) {
        switch (recommendation) {
            case 'INVESTIGATE_SYSTEMATIC_ISSUE':
                return 'Investigate Systematic Issue';
            case 'MONITOR_CLOSELY':
                return 'Monitor Closely';
            case 'TRACK_TREND':
                return 'Track Trend';
            default:
                return recommendation;
        }
    }

    formatTimestamp(timestamp) {
        try {
            const date = new Date(timestamp);
            return date.toLocaleString();
        } catch (error) {
            return timestamp;
        }
    }



    startRealtimeEventStream() {
        if (this.eventStreamInterval) {
            return; // Already running
        }

        if (window.logInfo) {
            window.logInfo('Starting real-time event stream for correlation');
        }

        this.showScenarioStatus('🔄 Real-time event stream active', 'info');
        document.getElementById('start-realtime-stream').style.display = 'none';
        document.getElementById('stop-realtime-stream').style.display = 'inline-block';

        // Generate events every 10-30 seconds
        this.eventStreamInterval = setInterval(async () => {
            try {
                await fetch('/api/events/simulate', { method: 'POST' });

                // Occasionally run correlation analysis
                if (Math.random() < 0.3) {
                    setTimeout(() => {
                        this.runCorrelationAnalysis();
                    }, 2000);
                }
            } catch (error) {
                console.warn('Event stream simulation failed:', error);
            }
        }, Math.random() * 20000 + 10000); // 10-30 seconds
    }

    stopRealtimeEventStream() {
        if (this.eventStreamInterval) {
            clearInterval(this.eventStreamInterval);
            this.eventStreamInterval = null;

            if (window.logInfo) {
                window.logInfo('Stopped real-time event stream');
            }

            this.showScenarioStatus('⏹️ Event stream stopped', 'success');
            document.getElementById('start-realtime-stream').style.display = 'inline-block';
            document.getElementById('stop-realtime-stream').style.display = 'none';
        }
    }

    showScenarioStatus(message, type = 'info') {
        const statusDiv = document.getElementById('scenario-status');
        if (statusDiv) {
            statusDiv.innerHTML = `<div class="status-${type}">${message}</div>`;
            statusDiv.style.display = 'block';

            // Auto-hide success/error messages after 10 seconds
            if (type !== 'info') {
                setTimeout(() => {
                    statusDiv.style.display = 'none';
                }, 10000);
            }
        }
    }

    showError(message) {
        if (window.app) {
            window.app.showError(message);
        } else {
            console.error(message);
        }
    }
}

// Initialize correlation analysis
document.addEventListener('DOMContentLoaded', () => {
    window.CorrelationAnalysis = new CorrelationAnalysis();
});