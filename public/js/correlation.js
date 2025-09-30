// Enhanced Correlation Analysis Module
class CorrelationAnalysis {
    constructor() {
        this.isAnalyzing = false;
        this.lastAnalysisTime = null;
        this.dataStatus = null;
        this.init();
    }

    init() {
        if (window.logInfo) {
            window.logInfo('Enhanced correlation analysis module initializing');
        }
        this.bindEvents();
        this.setupTabWatcher();
        if (window.logSuccess) {
            window.logSuccess('Enhanced correlation analysis module initialized');
        }
    }

    bindEvents() {
        // Data readiness check
        document.getElementById('check-data-readiness')?.addEventListener('click', () => {
            this.checkDataReadiness();
        });

        // Main analysis buttons
        document.getElementById('find-correlations')?.addEventListener('click', () => {
            this.findCorrelations();
        });

        document.getElementById('analyze-business-impact')?.addEventListener('click', () => {
            this.analyzeBusinessImpact();
        });

        document.getElementById('create-test-events')?.addEventListener('click', () => {
            this.createTestEvents();
        });

        // Debug toggle
        document.getElementById('toggle-debug')?.addEventListener('click', () => {
            this.toggleDebugInfo();
        });
    }

    setupTabWatcher() {
        const correlationTabBtn = document.querySelector('[data-tab="correlation"]');
        if (correlationTabBtn) {
            correlationTabBtn.addEventListener('click', () => {
                setTimeout(() => {
                    this.onTabActivated();
                }, 100);
            });
        }
    }

    async onTabActivated() {
        this.updateSystemStatus('Initializing...');
        await this.checkDataReadiness();
        await this.loadPatterns();
        this.updateSystemStatus('Ready');
    }

    updateSystemStatus(status) {
        const systemStatusEl = document.getElementById('system-status');
        if (systemStatusEl) {
            systemStatusEl.textContent = status;
            systemStatusEl.className = 'status-value';
            if (status === 'Ready') {
                systemStatusEl.style.color = '#28a745';
            } else if (status.includes('Error')) {
                systemStatusEl.style.color = '#dc3545';
            } else {
                systemStatusEl.style.color = '#ffc107';
            }
        }
    }

    updateLastAnalysis() {
        const lastAnalysisEl = document.getElementById('last-analysis');
        if (lastAnalysisEl) {
            this.lastAnalysisTime = new Date();
            lastAnalysisEl.textContent = this.lastAnalysisTime.toLocaleTimeString();
        }
    }

    showProgress(title, message) {
        const progressContainer = document.getElementById('analysis-progress');
        const progressTitle = document.getElementById('progress-title');
        const progressMessage = document.getElementById('progress-message');
        const progressStatus = document.getElementById('progress-status');
        const progressFill = document.getElementById('progress-fill');

        if (progressContainer && progressTitle && progressMessage) {
            progressContainer.style.display = 'block';
            progressTitle.textContent = title;
            progressMessage.textContent = message;
            progressStatus.textContent = '0%';
            progressFill.style.width = '0%';
        }
    }

    updateProgress(percentage, message) {
        const progressMessage = document.getElementById('progress-message');
        const progressStatus = document.getElementById('progress-status');
        const progressFill = document.getElementById('progress-fill');

        if (progressMessage && progressStatus && progressFill) {
            progressMessage.textContent = message;
            progressStatus.textContent = `${percentage}%`;
            progressFill.style.width = `${percentage}%`;
        }
    }

    hideProgress() {
        const progressContainer = document.getElementById('analysis-progress');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    }

    async checkDataReadiness() {
        try {
            this.updateProgress(10, 'Checking system status...');

            // Get debug information first
            const debugResponse = await fetch('/api/correlation/debug');
            const debugData = await debugResponse.json();

            this.updateProgress(50, 'Analyzing data availability...');

            // Get database stats
            const statsResponse = await fetch('/api/cmdb/database/stats');
            const statsData = await statsResponse.json();

            this.updateProgress(80, 'Calculating readiness status...');

            // Update readiness display
            this.updateDataReadinessDisplay(debugData, statsData);

            this.updateProgress(100, 'Data readiness check complete');
            setTimeout(() => this.hideProgress(), 1000);

            this.dataStatus = {
                debug: debugData,
                stats: statsData,
                timestamp: new Date()
            };

        } catch (error) {
            console.error('Error checking data readiness:', error);
            this.showError('Failed to check data readiness: ' + error.message);
            this.hideProgress();
        }
    }

    updateDataReadinessDisplay(debugData, statsData) {
        // Update individual readiness items
        const totalEvents = debugData.results?.query_0?.[0]?.totalEvents?.low || 0;
        const linkedEvents = debugData.results?.query_1?.[0]?.eventsWithAffects?.low || 0;
        const recentEvents = debugData.results?.query_3?.[0]?.recentEventsWithAffects?.low || 0;

        document.getElementById('total-events').textContent = totalEvents.toLocaleString();
        document.getElementById('linked-events').textContent = `${linkedEvents} (${linkedEvents > 0 ? Math.round((linkedEvents/totalEvents)*100) : 0}%)`;
        document.getElementById('recent-events').textContent = recentEvents.toLocaleString();

        // Determine overall readiness
        const correlationReadyEl = document.getElementById('correlation-ready');
        if (correlationReadyEl) {
            let readinessClass = 'not-ready';
            let readinessText = 'Not Ready';

            if (linkedEvents >= 5 && recentEvents >= 2) {
                readinessClass = 'ready';
                readinessText = 'Ready';
            } else if (linkedEvents >= 2) {
                readinessClass = 'checking';
                readinessText = 'Partial';
            }

            correlationReadyEl.textContent = readinessText;
            correlationReadyEl.className = `readiness-status ${readinessClass}`;
        }
    }

    async findCorrelations() {
        if (this.isAnalyzing) return;

        this.isAnalyzing = true;
        try {
            const timeWindow = document.getElementById('time-window')?.value || '1h';
            const threshold = document.getElementById('correlation-threshold')?.value || '0.5';

            this.showProgress('Finding Event Correlations', 'Initializing correlation analysis...');
            this.updateProgress(20, 'Analyzing temporal relationships...');

            const response = await fetch(`/api/correlation/analyze?timeWindow=${timeWindow}&minScore=${threshold}`);
            const correlations = await response.json();

            this.updateProgress(80, 'Processing correlation results...');
            this.displayCorrelations(correlations);

            this.updateProgress(100, 'Correlation analysis complete');
            this.updateLastAnalysis();

            setTimeout(() => this.hideProgress(), 1500);

        } catch (error) {
            console.error('Error finding correlations:', error);
            this.showError('Correlation analysis failed: ' + error.message);
        } finally {
            this.isAnalyzing = false;
            this.hideProgress();
        }
    }

    async analyzeBusinessImpact() {
        if (this.isAnalyzing) return;

        this.isAnalyzing = true;
        try {
            const timeWindow = document.getElementById('time-window')?.value || '1h';

            this.showProgress('Analyzing Business Impact', 'Mapping events to business services...');
            this.updateProgress(30, 'Calculating service impact scores...');

            const response = await fetch(`/api/correlation/business-impact?timeWindow=${timeWindow}`);
            const impacts = await response.json();

            this.updateProgress(80, 'Processing business impact results...');
            this.displayBusinessImpact(impacts);

            this.updateProgress(100, 'Business impact analysis complete');
            this.updateLastAnalysis();

            setTimeout(() => this.hideProgress(), 1500);

        } catch (error) {
            console.error('Error analyzing business impact:', error);
            this.showError('Business impact analysis failed: ' + error.message);
        } finally {
            this.isAnalyzing = false;
            this.hideProgress();
        }
    }

    async createTestEvents() {
        if (this.isAnalyzing) return;

        this.isAnalyzing = true;
        try {
            this.showProgress('Creating Test Events', 'Getting available components...');

            // Get some CIs for testing
            const ciResponse = await fetch('/api/cmdb/items?limit=3');
            const cis = await ciResponse.json();

            if (cis.length === 0) {
                throw new Error('No Configuration Items found. Please generate data first.');
            }

            this.updateProgress(40, 'Creating correlated test events...');

            // Create events with temporal proximity
            const events = [];
            for (let i = 0; i < Math.min(3, cis.length); i++) {
                const ci = cis[i];
                const eventData = {
                    source: 'test.correlation',
                    message: `Test correlation event ${i + 1} - ${this.getRandomEventMessage()}`,
                    severity: this.getRandomSeverity(),
                    ciId: ci.id,
                    eventType: 'TEST',
                    metadata: {
                        test: true,
                        correlationTest: true,
                        batch: Date.now()
                    }
                };

                const response = await fetch('/api/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(eventData)
                });

                if (response.ok) {
                    const event = await response.json();
                    events.push(event);
                }

                // Small delay between events for temporal correlation
                if (i < cis.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            this.updateProgress(90, 'Test events created, running correlation...');

            // Automatically run correlation on the new events
            setTimeout(() => {
                this.findCorrelations();
            }, 2000);

            this.updateProgress(100, `Created ${events.length} test events for correlation`);
            setTimeout(() => this.hideProgress(), 2000);

        } catch (error) {
            console.error('Error creating test events:', error);
            this.showError('Failed to create test events: ' + error.message);
        } finally {
            this.isAnalyzing = false;
            setTimeout(() => this.hideProgress(), 1000);
        }
    }

    getRandomEventMessage() {
        const messages = [
            'High CPU utilization detected',
            'Memory usage spike observed',
            'Network latency increased',
            'Disk I/O bottleneck detected',
            'Service response time degraded',
            'Connection pool exhausted',
            'Cache miss rate elevated'
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    getRandomSeverity() {
        const severities = ['CRITICAL', 'HIGH', 'MEDIUM'];
        return severities[Math.floor(Math.random() * severities.length)];
    }

    displayCorrelations(correlations) {
        const correlationsContainer = document.getElementById('correlations-list');
        if (!correlationsContainer) return;

        if (!correlations || correlations.length === 0) {
            correlationsContainer.innerHTML = `
                <div class="empty-state">
                    <p>No correlations found in the selected time window.</p>
                    <div class="help-text">
                        <strong>Try:</strong>
                        <ul>
                            <li>Expanding the time window to 6 hours or 24 hours</li>
                            <li>Lowering the correlation threshold</li>
                            <li>Creating test events with the "Create Test Events" button</li>
                            <li>Checking if events are linked to Configuration Items</li>
                        </ul>
                    </div>
                </div>
            `;
            return;
        }

        const correlationsHtml = correlations.map(corr => `
            <div class="correlation-item">
                <div class="correlation-header">
                    <div class="correlation-score">
                        <span class="score-label">Correlation Score:</span>
                        <span class="score-value">${(corr.correlationScore * 100).toFixed(1)}%</span>
                    </div>
                    <div class="correlation-distance">
                        <span class="distance-label">Distance:</span>
                        <span class="distance-value">${corr.relationshipDistance || 'Unknown'} hops</span>
                    </div>
                </div>
                <div class="events-pair">
                    <div class="event-card">
                        <div class="event-header">
                            <span class="event-severity severity-${corr.event1.severity?.toLowerCase()}">${corr.event1.severity}</span>
                            <span class="event-time">${new Date(corr.event1.timestamp).toLocaleString()}</span>
                        </div>
                        <div class="event-message">${corr.event1.message}</div>
                        <div class="event-ci">CI: ${corr.event1.ci}</div>
                    </div>
                    <div class="correlation-arrow">↔</div>
                    <div class="event-card">
                        <div class="event-header">
                            <span class="event-severity severity-${corr.event2.severity?.toLowerCase()}">${corr.event2.severity}</span>
                            <span class="event-time">${new Date(corr.event2.timestamp).toLocaleString()}</span>
                        </div>
                        <div class="event-message">${corr.event2.message}</div>
                        <div class="event-ci">CI: ${corr.event2.ci}</div>
                    </div>
                </div>
            </div>
        `).join('');

        correlationsContainer.innerHTML = `
            <div class="correlations-header">
                <h4>Found ${correlations.length} correlation${correlations.length !== 1 ? 's' : ''}</h4>
            </div>
            ${correlationsHtml}
        `;
    }

    displayBusinessImpact(impacts) {
        const impactContainer = document.getElementById('business-impact');
        if (!impactContainer) return;

        if (!impacts || impacts.length === 0) {
            impactContainer.innerHTML = `
                <div class="empty-state">
                    <p>No business impact data found.</p>
                    <div class="help-text">
                        <strong>This could mean:</strong>
                        <ul>
                            <li>No events are linked to business services</li>
                            <li>No business services are defined in the system</li>
                            <li>Events are outside the selected time window</li>
                        </ul>
                    </div>
                </div>
            `;
            return;
        }

        const impactsHtml = impacts.map(impact => `
            <div class="impact-item">
                <div class="impact-header">
                    <div class="impact-score">
                        <span class="score-label">Business Impact:</span>
                        <span class="score-value">${(impact.businessImpactScore * 100).toFixed(1)}%</span>
                    </div>
                </div>
                <div class="impact-event">
                    <div class="event-header">
                        <span class="event-severity severity-${impact.event.severity?.toLowerCase()}">${impact.event.severity}</span>
                        <span class="event-time">${new Date(impact.event.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="event-message">${impact.event.message}</div>
                    <div class="event-ci">CI: ${impact.affectedCI.name}</div>
                    ${impact.businessService ? `<div class="business-service">Service: ${impact.businessService.name} (${impact.businessService.criticality})</div>` : '<div class="no-service">No business service mapping</div>'}
                </div>
            </div>
        `).join('');

        impactContainer.innerHTML = `
            <div class="impacts-header">
                <h4>Found ${impacts.length} business impact${impacts.length !== 1 ? 's' : ''}</h4>
            </div>
            ${impactsHtml}
        `;
    }

    async loadPatterns() {
        try {
            const response = await fetch('/api/correlation/patterns');
            const patterns = await response.json();
            this.displayPatterns(patterns);
        } catch (error) {
            console.error('Error loading patterns:', error);
            this.showPatternError('Failed to load patterns: ' + error.message);
        }
    }

    displayPatterns(patterns) {
        const patternsContainer = document.getElementById('patterns');
        if (!patternsContainer) return;

        if (!patterns || patterns.length === 0) {
            patternsContainer.innerHTML = `
                <div class="empty-state">
                    <p>No recurring patterns detected.</p>
                    <div class="help-text">
                        <strong>Pattern analysis looks for:</strong>
                        <ul>
                            <li>Components with multiple events over time</li>
                            <li>Recurring issues on the same infrastructure</li>
                            <li>Systematic problems requiring investigation</li>
                        </ul>
                    </div>
                </div>
            `;
            return;
        }

        const patternsHtml = patterns.map(pattern => `
            <div class="pattern-item">
                <div class="pattern-header">
                    <div class="pattern-ci">${pattern.ci.name}</div>
                    <div class="pattern-recommendation ${pattern.recommendation.toLowerCase().replace('_', '-')}">${pattern.recommendation.replace('_', ' ')}</div>
                </div>
                <div class="pattern-details">
                    <div class="pattern-stat">
                        <span class="stat-label">Event Count:</span>
                        <span class="stat-value">${pattern.pattern.eventCount}</span>
                    </div>
                    <div class="pattern-stat">
                        <span class="stat-label">Time Span:</span>
                        <span class="stat-value">${pattern.pattern.timeSpanDays} days</span>
                    </div>
                    <div class="pattern-stat">
                        <span class="stat-label">Frequency:</span>
                        <span class="stat-value">${pattern.pattern.frequency.toFixed(2)} events/day</span>
                    </div>
                </div>
                <div class="pattern-severities">
                    <span class="severities-label">Severities:</span>
                    ${pattern.pattern.severities.map(sev => `<span class="severity-tag severity-${sev.toLowerCase()}">${sev}</span>`).join('')}
                </div>
            </div>
        `).join('');

        patternsContainer.innerHTML = `
            <div class="patterns-header">
                <h4>Found ${patterns.length} pattern${patterns.length !== 1 ? 's' : ''}</h4>
            </div>
            ${patternsHtml}
        `;
    }

    showPatternError(message) {
        const patternsContainer = document.getElementById('patterns');
        if (patternsContainer) {
            patternsContainer.innerHTML = `
                <div class="error-state">
                    <p>Error loading patterns: ${message}</p>
                </div>
            `;
        }
    }

    async toggleDebugInfo() {
        const debugInfo = document.getElementById('debug-info');
        const toggleBtn = document.getElementById('toggle-debug');

        if (!debugInfo || !toggleBtn) return;

        if (debugInfo.style.display === 'none') {
            debugInfo.style.display = 'block';
            toggleBtn.textContent = 'Hide Debug Details';

            if (this.dataStatus) {
                this.displayDebugInfo(this.dataStatus);
            } else {
                await this.refreshDebugInfo();
            }
        } else {
            debugInfo.style.display = 'none';
            toggleBtn.textContent = 'Show Debug Details';
        }
    }

    async refreshDebugInfo() {
        try {
            const debugResponse = await fetch('/api/correlation/debug');
            const debugData = await debugResponse.json();
            this.displayDebugInfo({ debug: debugData, timestamp: new Date() });
        } catch (error) {
            document.getElementById('debug-output').textContent = `Error loading debug info: ${error.message}`;
        }
    }

    displayDebugInfo(dataStatus) {
        const debugOutput = document.getElementById('debug-output');
        if (debugOutput) {
            debugOutput.textContent = JSON.stringify(dataStatus, null, 2);
        }
    }

    showError(message) {
        if (window.logError) {
            window.logError(message);
        } else {
            console.error(message);
        }

        // Also show in UI
        const systemStatusEl = document.getElementById('system-status');
        if (systemStatusEl) {
            systemStatusEl.textContent = 'Error';
            systemStatusEl.style.color = '#dc3545';
        }
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.correlationAnalysis = new CorrelationAnalysis();
    });
} else {
    window.correlationAnalysis = new CorrelationAnalysis();
}