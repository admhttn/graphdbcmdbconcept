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
            const url = severityFilter ? `/api/events?severity=${severityFilter}` : '/api/events';

            const response = await fetch(url);
            const events = await response.json();

            this.displayEvents(events);
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

        container.innerHTML = events.map(event => `
            <div class="event-item">
                <div class="event-header">
                    <span class="event-severity severity-${event.severity.toLowerCase()}">${event.severity}</span>
                    <span class="event-meta">${this.formatTimestamp(event.timestamp)}</span>
                </div>
                <div class="event-message">${event.message}</div>
                <div class="event-meta">
                    <span>Source: ${event.source}</span>
                    ${event.affectedCI ? `<span> | CI: ${event.affectedCI}</span>` : ''}
                    <span> | Status: ${event.status}</span>
                </div>
            </div>
        `).join('');
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
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CMDBApp();
});