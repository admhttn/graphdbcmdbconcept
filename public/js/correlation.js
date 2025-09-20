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

        container.innerHTML = correlations.map(corr => `
            <div class="correlation-item">
                <div class="correlation-score ${this.getScoreClass(corr.correlationScore)}">
                    Score: ${corr.correlationScore.toFixed(3)}
                </div>
                <div class="correlation-events">
                    <div class="event-pair">
                        <div class="event-1">
                            <strong>${corr.event1.ci}</strong>: ${corr.event1.message}
                            <div class="event-meta">
                                <span class="severity-${corr.event1.severity.toLowerCase()}">${corr.event1.severity}</span>
                                <span>${this.formatTimestamp(corr.event1.timestamp)}</span>
                            </div>
                        </div>
                        <div class="correlation-arrow">↔</div>
                        <div class="event-2">
                            <strong>${corr.event2.ci}</strong>: ${corr.event2.message}
                            <div class="event-meta">
                                <span class="severity-${corr.event2.severity.toLowerCase()}">${corr.event2.severity}</span>
                                <span>${this.formatTimestamp(corr.event2.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                    ${corr.relationshipDistance !== null ?
                        `<div class="relationship-info">Dependency distance: ${corr.relationshipDistance} hops</div>` :
                        '<div class="relationship-info">No direct dependency relationship</div>'
                    }
                </div>
            </div>
        `).join('');
    }

    displayBusinessImpact(impacts) {
        const container = document.getElementById('business-impact');

        if (impacts.length === 0) {
            container.innerHTML = '<div class="loading">No business impact detected</div>';
            return;
        }

        container.innerHTML = impacts.map(impact => `
            <div class="impact-item">
                <div class="impact-header">
                    <span class="impact-score ${this.getImpactClass(impact.businessImpactScore)}">
                        Impact: ${impact.businessImpactScore.toFixed(2)}
                    </span>
                    <span class="impact-timestamp">${this.formatTimestamp(impact.event.timestamp)}</span>
                </div>
                <div class="impact-event">
                    <strong>Event:</strong> ${impact.event.message}
                </div>
                <div class="impact-ci">
                    <strong>Affected CI:</strong> ${impact.affectedCI.name} (${impact.affectedCI.type})
                </div>
                ${impact.businessService ? `
                    <div class="impact-service">
                        <strong>Business Service:</strong> ${impact.businessService.name}
                        <span class="service-criticality">(${impact.businessService.criticality})</span>
                    </div>
                ` : '<div class="impact-service">No direct business service impact</div>'}
            </div>
        `).join('');
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