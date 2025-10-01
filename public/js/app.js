// Main application JavaScript
class CMDBApp {
    constructor() {
        this.currentTab = 'overview';

        // Ensure DOM is ready before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        try {
            // Wait for debug logger to be available
            if (window.logInfo) {
                window.logInfo('CMDB Application initializing');
            }

            this.bindEvents();
            this.loadOverview();
            this.startAutoRefresh();

            if (window.logSuccess) {
                window.logSuccess('CMDB Application initialized successfully');
            }
        } catch (error) {
            console.error('Failed to initialize CMDB Application:', error);
            if (window.logError) {
                window.logError('CMDB App initialization failed', { error: error.message });
            }
        }
    }

    bindEvents() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Event simulation controls (consolidated in Events tab)
        document.getElementById('create-incident')?.addEventListener('click', () => {
            this.createSampleIncident();
        });

        document.getElementById('simulate-cascade')?.addEventListener('click', () => {
            this.simulateCascadeEvent();
        });

        // Demo controls

        document.getElementById('clear-events')?.addEventListener('click', () => {
            this.clearEvents();
        });

        // Refresh buttons
        document.getElementById('refresh-events')?.addEventListener('click', () => {
            this.loadEvents();
        });

        document.getElementById('simulate-event')?.addEventListener('click', () => {
            this.simulateEvent();
        });

        // Database management buttons
        document.getElementById('refresh-db-stats')?.addEventListener('click', () => {
            this.loadOverview();
        });

        document.getElementById('clear-database')?.addEventListener('click', () => {
            this.clearDatabase();
        });

        // System status button
        document.getElementById('refresh-system-status')?.addEventListener('click', () => {
            this.loadSystemStatus();
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        this.currentTab = tabName;

        // Load tab-specific content
        switch (tabName) {
            case 'overview':
                this.loadOverview();
                break;
            case 'topology':
                if (window.TopologyViz) {
                    if (window.logInfo) {
                        window.logInfo('Loading topology tab - calling TopologyViz.load()');
                    }
                    window.TopologyViz.load();
                } else {
                    console.error('TopologyViz not available');
                    if (window.logError) {
                        window.logError('TopologyViz instance not found when switching to topology tab');
                    }
                }
                break;
            case 'browse':
                // Initialize browse functionality if not already done
                if (!window.cmdbBrowser && window.CMDBBrowser) {
                    window.cmdbBrowser = new window.CMDBBrowser();
                    if (window.logInfo) {
                        window.logInfo('CMDB Browser initialized');
                    }
                } else if (window.cmdbBrowser) {
                    // Refresh data when returning to tab
                    window.cmdbBrowser.loadData();
                    if (window.logInfo) {
                        window.logInfo('CMDB Browser data refreshed');
                    }
                }
                break;
            case 'events':
                this.loadEvents();
                break;
            case 'correlation':
                if (window.CorrelationAnalysis) {
                    window.CorrelationAnalysis.loadPatterns();
                }
                break;
            case 'data-generation':
                // Initialize data generation manager if not already done
                if (!window.dataGenerationManager && window.DataGenerationManager) {
                    window.dataGenerationManager = new window.DataGenerationManager();
                }
                break;
        }
    }

    async loadOverview() {
        try {
            const startTime = Date.now();

            // Load system status first
            await this.loadSystemStatus();

            // Load comprehensive database statistics
            const response = await fetch('/api/cmdb/database/stats');
            const dbStats = await response.json();

            const queryTime = Date.now() - startTime;

            // Update core metrics
            document.getElementById('total-nodes').textContent = dbStats.nodes?.total?.toLocaleString() || 0;
            document.getElementById('total-relationships').textContent = dbStats.relationships?.total?.toLocaleString() || 0;
            document.getElementById('ci-count').textContent = dbStats.nodes?.configItems?.toLocaleString() || 0;
            document.getElementById('event-count').textContent = dbStats.nodes?.events?.toLocaleString() || 0;

            // Update performance metrics
            document.getElementById('query-time').textContent = `${queryTime}ms`;
            document.getElementById('recent-activity').textContent = dbStats.activity?.recentEvents?.toLocaleString() || 0;
            document.getElementById('last-updated').textContent =
                new Date(dbStats.performance?.lastUpdated).toLocaleTimeString() || 'Unknown';

            // Render charts
            this.renderNodeTypesChart(dbStats.nodeTypes || []);
            this.renderRelationshipTypesChart(dbStats.relationshipTypes || []);

            if (window.logSuccess) {
                window.logSuccess('Database statistics loaded', {
                    nodes: dbStats.nodes?.total,
                    relationships: dbStats.relationships?.total,
                    queryTime: `${queryTime}ms`
                });
            }

        } catch (error) {
            console.error('Error loading database statistics:', error);
            this.showError('Failed to load database statistics');
        }
    }

    renderNodeTypesChart(nodeTypes) {
        const container = document.getElementById('node-types-chart');
        if (!container || !nodeTypes.length) {
            container.innerHTML = '<div class="loading">No node type data</div>';
            return;
        }

        const total = nodeTypes.reduce((sum, item) => sum + item.count, 0);

        container.innerHTML = nodeTypes.map(item => `
            <div class="chart-item">
                <div class="chart-label">${item.type}</div>
                <div class="chart-bar">
                    <div class="chart-fill" style="width: ${(item.count / total * 100)}%"></div>
                </div>
                <div class="chart-value">${item.count.toLocaleString()}</div>
            </div>
        `).join('');
    }

    renderRelationshipTypesChart(relationshipTypes) {
        const container = document.getElementById('relationship-types-chart');
        if (!container || !relationshipTypes.length) {
            container.innerHTML = '<div class="loading">No relationship type data</div>';
            return;
        }

        const total = relationshipTypes.reduce((sum, item) => sum + item.count, 0);

        container.innerHTML = relationshipTypes.map(item => `
            <div class="chart-item">
                <div class="chart-label">${item.type}</div>
                <div class="chart-bar">
                    <div class="chart-fill" style="width: ${(item.count / total * 100)}%"></div>
                </div>
                <div class="chart-value">${item.count.toLocaleString()}</div>
            </div>
        `).join('');
    }

    displayRecentEvents(events) {
        const container = document.getElementById('recent-events');

        if (events.length === 0) {
            container.innerHTML = '<div class="loading">No recent events</div>';
            return;
        }

        container.innerHTML = events.map(event => `
            <div class="event-item">
                <div class="event-header">
                    <span class="event-severity severity-${event.severity.toLowerCase()}">${event.severity}</span>
                    <span class="event-meta">${this.formatTimestamp(event.timestamp)}</span>
                </div>
                <div class="event-message">${event.message}</div>
                <div class="event-meta">Source: ${event.source}</div>
            </div>
        `).join('');
    }

    async loadEvents() {
        try {
            const severityFilter = document.getElementById('severity-filter')?.value || '';
            const url = severityFilter ? `/api/events?severity=${severityFilter}&limit=50` : '/api/events?limit=50';

            const response = await fetch(url);
            const events = await response.json();

            // Fetch CI details for each event
            const enrichedEvents = await Promise.all(events.map(async (event) => {
                try {
                    const ciResponse = await fetch(`/api/events/${event.id}/affected-ci`);
                    if (ciResponse.ok) {
                        const ciData = await ciResponse.json();
                        return { ...event, ciDetails: ciData };
                    }
                } catch (err) {
                    console.warn(`Failed to fetch CI details for event ${event.id}:`, err);
                }
                return event;
            }));

            this.displayEvents(enrichedEvents);
        } catch (error) {
            console.error('Error loading events:', error);
            this.showError('Failed to load events');
        }
    }

    displayEvents(events) {
        const container = document.getElementById('events-list');

        if (events.length === 0) {
            container.innerHTML = '<div class="loading">No events found</div>';
            return;
        }

        container.innerHTML = events.map(event => {
            const metadata = event.metadata ? (typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata) : {};
            const ciDetails = event.ciDetails || {};
            const ci = ciDetails.ci || null;

            // Build CI details section
            let ciInfoHTML = '';
            if (ci) {
                ciInfoHTML = `
                    <div class="event-ci-details">
                        <div class="ci-info-row">
                            <span class="ci-label">🎯 Affected CI:</span>
                            <span class="ci-name">${ci.name || 'Unknown'}</span>
                            <span class="ci-type type-badge">${ci.type || 'N/A'}</span>
                        </div>
                        <div class="ci-info-row">
                            ${ci.status ? `<span class="ci-status status-${ci.status.toLowerCase()}">${ci.status}</span>` : ''}
                            ${ci.criticality ? `<span class="ci-criticality criticality-${ci.criticality.toLowerCase()}">${ci.criticality}</span>` : ''}
                            ${ciDetails.relationshipCount ? `<span class="ci-rel-count" title="Number of relationships">🔗 ${ciDetails.relationshipCount} rel${ciDetails.relationshipCount !== 1 ? 's' : ''}</span>` : ''}
                        </div>
                    </div>
                `;
            }

            // Build metadata section
            let metadataHTML = '';
            if (Object.keys(metadata).length > 0 && metadata.template) {
                metadataHTML = `<span class="event-template">Template: ${metadata.template}</span>`;
            }

            return `
                <div class="event-item event-severity-${event.severity.toLowerCase()}">
                    <div class="event-header">
                        <div class="event-severity-group">
                            <span class="event-severity severity-${event.severity.toLowerCase()}">${event.severity}</span>
                            ${event.eventType ? `<span class="event-type">${event.eventType}</span>` : ''}
                        </div>
                        <div class="event-time-group">
                            <span class="event-time">${this.formatTimestamp(event.timestamp)}</span>
                            <span class="event-status status-${event.status.toLowerCase()}">${event.status}</span>
                        </div>
                    </div>
                    <div class="event-message">${event.message}</div>
                    ${ciInfoHTML}
                    <div class="event-meta">
                        <span>Source: ${event.source || 'unknown'}</span>
                        ${event.correlationScore > 0 ? `<span> | Correlation: ${Math.round(event.correlationScore * 100)}%</span>` : ''}
                        ${metadataHTML ? ` | ${metadataHTML}` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    async simulateEvent() {
        try {
            const response = await fetch('/api/events/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const event = await response.json();
            this.showNotification(`Simulated event: ${event.message}`, 'success');

            // Refresh events if on events tab
            if (this.currentTab === 'events') {
                this.loadEvents();
            }
        } catch (error) {
            console.error('Error simulating event:', error);
            this.showError('Failed to simulate event');
        }
    }


    async createSampleIncident() {
        try {
            // Create multiple related events to simulate an incident
            const events = [
                {
                    source: 'monitoring.cpu',
                    message: 'Critical CPU spike on database server',
                    severity: 'CRITICAL',
                    eventType: 'PERFORMANCE'
                },
                {
                    source: 'application.api',
                    message: 'API response time severely degraded',
                    severity: 'HIGH',
                    eventType: 'PERFORMANCE'
                },
                {
                    source: 'monitoring.memory',
                    message: 'Memory exhaustion detected',
                    severity: 'HIGH',
                    eventType: 'PERFORMANCE'
                }
            ];

            for (const event of events) {
                await fetch('/api/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(event)
                });
                // Small delay between events
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            this.showNotification('Sample incident created with multiple correlated events', 'success');
            this.loadOverview();
        } catch (error) {
            console.error('Error creating incident:', error);
            this.showError('Failed to create sample incident');
        }
    }

    async simulateCascadeEvent() {
        try {
            // Simulate a cascade of events from infrastructure to application
            const cascadeEvents = [
                { message: 'Network switch failure detected', severity: 'CRITICAL', delay: 0 },
                { message: 'Database connection timeout', severity: 'HIGH', delay: 2000 },
                { message: 'Application service unavailable', severity: 'HIGH', delay: 4000 },
                { message: 'User authentication failures', severity: 'MEDIUM', delay: 6000 },
                { message: 'Performance degradation reported', severity: 'MEDIUM', delay: 8000 }
            ];

            this.showNotification('Simulating cascade event sequence...', 'info');

            for (const event of cascadeEvents) {
                setTimeout(async () => {
                    await fetch('/api/events', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            source: 'cascade.simulation',
                            message: event.message,
                            severity: event.severity,
                            eventType: 'AVAILABILITY'
                        })
                    });

                    if (event === cascadeEvents[cascadeEvents.length - 1]) {
                        this.showNotification('Cascade simulation completed', 'success');
                        this.loadOverview();
                    }
                }, event.delay);
            }
        } catch (error) {
            console.error('Error simulating cascade:', error);
            this.showError('Failed to simulate cascade event');
        }
    }

    async clearEvents() {
        if (!confirm('Are you sure you want to clear all events?')) {
            return;
        }

        try {
            if (window.logInfo) {
                window.logInfo('Clearing all events');
            }

            const response = await fetch('/api/events/clear', {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showNotification('All events cleared successfully', 'success');

                // Refresh events list
                this.loadEvents();

                // Reset correlation displays if they exist
                const correlationsList = document.getElementById('correlations-list');
                if (correlationsList) {
                    correlationsList.innerHTML = '<div class="loading">Run correlation analysis...</div>';
                }

                const businessImpact = document.getElementById('business-impact');
                if (businessImpact) {
                    businessImpact.innerHTML = '<div class="loading">Run correlation analysis...</div>';
                }

                if (window.logSuccess) {
                    window.logSuccess('All events cleared successfully');
                }
            } else {
                throw new Error('Failed to clear events');
            }
        } catch (error) {
            console.error('Error clearing events:', error);
            this.showError('Failed to clear events');
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

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            borderRadius: '5px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '1000',
            maxWidth: '300px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        });

        // Set background color based on type
        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            info: '#3498db',
            warning: '#f39c12'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        // Add to DOM
        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    startAutoRefresh() {
        // Auto-refresh overview every 30 seconds
        setInterval(() => {
            if (this.currentTab === 'overview') {
                this.loadOverview();
            }
        }, 30000);
    }

    async clearDatabase() {
        if (!confirm('⚠️ This will permanently delete ALL data in the database.\n\nThis includes:\n• All Configuration Items\n• All Events\n• All Relationships\n• All Services\n\nAre you sure you want to continue?')) {
            return;
        }

        try {
            const startTime = Date.now();

            if (window.logWarning) {
                window.logWarning('Starting database clear operation');
            }

            // Show loading state
            document.getElementById('total-nodes').textContent = 'Clearing...';
            document.getElementById('total-relationships').textContent = 'Clearing...';
            document.getElementById('ci-count').textContent = 'Clearing...';
            document.getElementById('event-count').textContent = 'Clearing...';

            const response = await fetch('/api/cmdb/database/clear', {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            const duration = Date.now() - startTime;

            if (window.logSuccess) {
                window.logSuccess('Database cleared successfully', {
                    duration: `${duration}ms`,
                    remainingNodes: result.remainingNodes
                });
            }

            // Refresh the overview to show empty database
            await this.loadOverview();

            this.showSuccess(`Database cleared successfully in ${duration}ms`);

        } catch (error) {
            console.error('Error clearing database:', error);
            if (window.logError) {
                window.logError('Failed to clear database', { error: error.message });
            }
            this.showError(`Failed to clear database: ${error.message}`);

            // Refresh overview even on error to show current state
            this.loadOverview();
        }
    }

    async loadSystemStatus() {
        try {
            if (window.logInfo) {
                window.logInfo('Loading system status');
            }

            const response = await fetch('/api/cmdb/services/status');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const statusData = await response.json();
            this.renderSystemStatus(statusData);

            if (window.logSuccess) {
                window.logSuccess('System status loaded successfully', {
                    mode: statusData.overall?.mode,
                    status: statusData.overall?.status,
                    services: statusData.summary?.total
                });
            }

        } catch (error) {
            console.error('Error loading system status:', error);
            this.renderSystemStatusError(error.message);

            if (window.logError) {
                window.logError('Failed to load system status', { error: error.message });
            }
        }
    }

    renderSystemStatus(data) {
        // Update environment info
        const envMode = document.getElementById('env-mode');
        const envStatus = document.getElementById('env-status');
        const appVersion = document.getElementById('app-version');
        const runtimeInfo = document.getElementById('runtime-info');
        const systemUptime = document.getElementById('system-uptime');

        if (envMode) {
            envMode.textContent = data.overall?.mode?.toUpperCase() || 'UNKNOWN';
            envMode.className = `environment-mode mode-${data.overall?.mode || 'unknown'}`;
        }

        if (envStatus) {
            envStatus.className = `environment-status-indicator ${data.overall?.status || 'unknown'}`;
        }

        if (appVersion) {
            appVersion.textContent = `${data.application?.name || 'CMDB'} v${data.application?.version || 'Unknown'}`;
        }

        if (runtimeInfo) {
            const runtime = `${data.application?.nodeVersion || 'Unknown'} (${data.application?.platform || 'Unknown'})`;
            runtimeInfo.textContent = runtime;
        }

        if (systemUptime) {
            const uptimeSeconds = data.performance?.uptime || 0;
            const hours = Math.floor(uptimeSeconds / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            systemUptime.textContent = `${hours}h ${minutes}m`;
        }

        // Render services
        this.renderServices(data.services || []);

        // Update performance summary
        this.renderPerformanceSummary(data.performance || {}, data.overall?.responseTime);
    }

    renderServices(services) {
        const servicesGrid = document.getElementById('services-grid');
        if (!servicesGrid) return;

        servicesGrid.innerHTML = services.map(service => `
            <div class="service-card">
                <div class="service-header">
                    <div>
                        <div class="service-type">${service.type}</div>
                        <div class="service-name">${service.name}</div>
                    </div>
                    <span class="service-status ${service.status}">${service.status}</span>
                </div>
                <div class="service-info">
                    ${service.url && service.url !== 'in-memory' ? `
                        <div class="service-info-item">
                            <span class="service-info-label">URL:</span>
                            <a href="${service.browserUrl || service.url}" target="_blank" class="service-url">
                                ${service.url}
                            </a>
                        </div>
                    ` : service.url === 'in-memory' ? `
                        <div class="service-info-item">
                            <span class="service-info-label">Storage:</span>
                            <span class="service-info-value">In-Memory</span>
                        </div>
                    ` : ''}
                    ${this.renderServiceInfo(service.info)}
                </div>
                <div class="service-required ${service.required ? 'required' : 'optional'}">
                    ${service.required ? '● Required Service' : '○ Optional Service'}
                </div>
            </div>
        `).join('');
    }

    renderServiceInfo(info) {
        if (!info || typeof info !== 'object') return '';

        return Object.entries(info)
            .filter(([key, value]) => key !== 'error' && value !== null && value !== undefined)
            .map(([key, value]) => {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                let displayValue = value;

                // Format specific values
                if (typeof value === 'object' && value !== null) {
                    displayValue = JSON.stringify(value);
                } else if (key.includes('Size') || key.includes('size')) {
                    displayValue = value;
                } else if (key.includes('Count') || key.includes('count') || typeof value === 'number') {
                    displayValue = value.toLocaleString ? value.toLocaleString() : value;
                }

                return `
                    <div class="service-info-item">
                        <span class="service-info-label">${label}:</span>
                        <span class="service-info-value">${displayValue}</span>
                    </div>
                `;
            }).join('');
    }

    renderPerformanceSummary(performance, responseTime) {
        const performanceSummary = document.getElementById('performance-summary');
        const perfResponseTime = document.getElementById('perf-response-time');
        const perfMemory = document.getElementById('perf-memory');

        if (performanceSummary) {
            performanceSummary.style.display = 'block';
        }

        if (perfResponseTime) {
            perfResponseTime.textContent = responseTime || `${performance.responseTime || 0}ms`;
        }

        if (perfMemory) {
            const memoryUsed = performance.memory?.used || 0;
            const memoryTotal = performance.memory?.total || 0;
            perfMemory.textContent = `${memoryUsed}MB / ${memoryTotal}MB`;
        }
    }

    renderSystemStatusError(errorMessage) {
        const servicesGrid = document.getElementById('services-grid');
        const envMode = document.getElementById('env-mode');
        const envStatus = document.getElementById('env-status');

        if (envMode) {
            envMode.textContent = 'ERROR';
        }

        if (envStatus) {
            envStatus.className = 'environment-status-indicator error';
        }

        if (servicesGrid) {
            servicesGrid.innerHTML = `
                <div class="service-card">
                    <div class="service-header">
                        <div class="service-name">System Status</div>
                        <span class="service-status error">Error</span>
                    </div>
                    <div class="service-info">
                        <div class="service-info-item">
                            <span class="service-info-label">Error:</span>
                            <span class="service-info-value">${errorMessage}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CMDBApp();
});