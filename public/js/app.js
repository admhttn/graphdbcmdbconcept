// Main application JavaScript
class CMDBApp {
    constructor() {
        this.currentTab = 'overview';
        this.init();
    }

    init() {
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
    }

    bindEvents() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Demo controls
        document.getElementById('load-sample-data')?.addEventListener('click', () => {
            this.loadSampleData();
        });

        document.getElementById('create-incident')?.addEventListener('click', () => {
            this.createSampleIncident();
        });

        document.getElementById('simulate-cascade')?.addEventListener('click', () => {
            this.simulateCascadeEvent();
        });

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
                    window.TopologyViz.load();
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
        }
    }

    async loadOverview() {
        try {
            // Load basic statistics
            const [ciResponse, eventResponse, statsResponse] = await Promise.all([
                fetch('/api/cmdb/items'),
                fetch('/api/events'),
                fetch('/api/events/stats')
            ]);

            const cis = await ciResponse.json();
            const events = await eventResponse.json();
            const stats = await statsResponse.json();

            // Update statistics
            document.getElementById('ci-count').textContent = cis.length;
            document.getElementById('event-count').textContent = stats.open || 0;
            document.getElementById('critical-count').textContent = stats.critical || 0;
            document.getElementById('service-count').textContent = '3'; // Hardcoded for demo

            // Load recent events
            this.displayRecentEvents(events.slice(0, 5));

        } catch (error) {
            console.error('Error loading overview:', error);
            this.showError('Failed to load overview data');
        }
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

    async loadSampleData() {
        try {
            this.showNotification('Loading sample data...', 'info');

            const response = await fetch('/api/demo/sample-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                this.showNotification('Sample data loaded successfully!', 'success');
                this.loadOverview();
            } else {
                throw new Error('Failed to load sample data');
            }
        } catch (error) {
            console.error('Error loading sample data:', error);
            this.showError('Failed to load sample data');
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
            // This would need to be implemented in the backend
            this.showNotification('Event clearing not implemented in demo', 'info');
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
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CMDBApp();
});