// Topology visualization using D3.js
class TopologyVisualization {
    constructor() {
        this.svg = null;
        this.simulation = null;
        this.nodes = [];
        this.links = [];
        this.width = 800;
        this.height = 600;

        // Wait for D3 and DOM to be ready
        if (typeof d3 === 'undefined') {
            console.error('D3.js is not loaded');
            return;
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        try {
            if (window.logInfo) {
                window.logInfo('Topology visualization initializing');
            }
            this.bindEvents();
            this.setupVisualization();
            if (window.logSuccess) {
                window.logSuccess('Topology visualization initialized');
            }
        } catch (error) {
            console.error('Failed to initialize topology visualization:', error);
            if (window.logError) {
                window.logError('Topology visualization initialization failed', { error: error.message });
            }
        }
    }

    bindEvents() {
        document.getElementById('refresh-topology')?.addEventListener('click', () => {
            this.load();
        });

        document.getElementById('topology-filter')?.addEventListener('change', (e) => {
            this.applyFilter(e.target.value);
        });

        document.getElementById('reset-zoom')?.addEventListener('click', () => {
            this.resetZoom();
        });
    }

    setupVisualization() {
        const container = document.getElementById('topology-viz');
        if (!container) {
            console.error('Topology container not found');
            return;
        }

        container.innerHTML = '';

        // Create SVG
        this.svg = d3.select('#topology-viz')
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .style('border', '1px solid #ddd'); // Add border for debugging

        if (!this.svg || this.svg.empty()) {
            console.error('Failed to create SVG element');
            return;
        }

        // Create groups for links and nodes
        this.svg.append('g').attr('class', 'links');
        this.svg.append('g').attr('class', 'nodes');

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.5, 3])
            .on('zoom', (event) => {
                this.svg.selectAll('g').attr('transform', event.transform);
            });

        this.svg.call(zoom);

        // Setup force simulation
        this.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(80))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(25));

        if (window.logInfo) {
            window.logInfo('Topology SVG visualization setup completed');
        }
    }

    async load() {
        try {
            if (window.logInfo) {
                window.logInfo('Loading topology data');
            }

            // Check if container exists
            const container = document.getElementById('topology-viz');
            if (!container) {
                console.error('Topology container not found');
                if (window.logError) {
                    window.logError('Topology container element not found');
                }
                return;
            }

            // Show loading state
            container.innerHTML = '<div class="loading">Loading topology...</div>';

            // Get current filter to apply default limit
            const filter = document.getElementById('topology-filter')?.value || '';
            const url = filter ? `/api/cmdb/topology?type=${filter}&limit=100` : '/api/cmdb/topology?limit=100';

            if (window.logInfo) {
                window.logInfo(`Fetching topology data from: ${url}`);
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (window.logInfo) {
                window.logInfo(`Raw API response: ${data.nodes?.length || 0} nodes, ${data.relationships?.length || 0} relationships`);
            }

            // Validate response data
            if (!data.nodes || !Array.isArray(data.nodes)) {
                throw new Error('Invalid response: nodes array missing');
            }
            if (!data.relationships || !Array.isArray(data.relationships)) {
                throw new Error('Invalid response: relationships array missing');
            }

            // Apply safety limits for large topologies
            const maxNodes = 200;
            const maxLinks = 300;

            if (data.nodes.length > maxNodes) {
                if (window.logWarning) {
                    window.logWarning(`Topology too large (${data.nodes.length} nodes), limiting to ${maxNodes} nodes for performance`);
                }
                data.nodes = data.nodes.slice(0, maxNodes);
            }

            if (data.relationships.length > maxLinks) {
                if (window.logWarning) {
                    window.logWarning(`Too many relationships (${data.relationships.length}), limiting to ${maxLinks} for performance`);
                }
                data.relationships = data.relationships.slice(0, maxLinks);
            }

            this.nodes = data.nodes.map(node => ({
                ...node,
                x: Math.random() * this.width,
                y: Math.random() * this.height
            }));

            // Create a set of valid node IDs for validation
            const nodeIds = new Set(this.nodes.map(node => node.id));

            // Filter out relationships that reference non-existent nodes
            const validRelationships = data.relationships.filter(link => {
                const sourceExists = nodeIds.has(link.from);
                const targetExists = nodeIds.has(link.to);

                if (!sourceExists || !targetExists) {
                    if (window.logWarning) {
                        window.logWarning(`Skipping invalid relationship: ${link.from} -> ${link.to} (missing node)`);
                    }
                    return false;
                }
                return true;
            });

            this.links = validRelationships.map(link => ({
                source: link.from,
                target: link.to,
                type: link.type
            }));

            if (validRelationships.length !== data.relationships.length) {
                if (window.logWarning) {
                    window.logWarning(`Filtered out ${data.relationships.length - validRelationships.length} invalid relationships`);
                }
            }

            if (window.logSuccess) {
                window.logSuccess(`Topology processed: ${this.nodes.length} nodes, ${this.links.length} links`);
            }

            this.render();
        } catch (error) {
            if (window.logError) {
                window.logError('Error loading topology:', { error: error.message, stack: error.stack });
            }
            console.error('Error loading topology:', error);
            const container = document.getElementById('topology-viz');
            if (container) {
                container.innerHTML = `<div class="loading" style="color: red;">Failed to load topology: ${error.message}</div>`;
            }
        }
    }

    render() {
        if (!this.svg) {
            console.error('SVG not initialized');
            return;
        }

        if (window.logInfo) {
            window.logInfo(`Rendering topology: ${this.nodes.length} nodes, ${this.links.length} links`);
        }

        // Clear existing elements
        this.svg.select('.links').selectAll('*').remove();
        this.svg.select('.nodes').selectAll('*').remove();

        // Render links
        const link = this.svg.select('.links')
            .selectAll('line')
            .data(this.links)
            .enter()
            .append('line')
            .attr('class', 'link')
            .attr('stroke-width', 2)
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6);

        // Render link labels
        const linkLabel = this.svg.select('.links')
            .selectAll('.link-label')
            .data(this.links)
            .enter()
            .append('text')
            .attr('class', 'link-label')
            .attr('font-size', '10px')
            .attr('fill', '#666')
            .text(d => this.formatRelationshipType(d.type));

        // Render nodes
        const node = this.svg.select('.nodes')
            .selectAll('.node')
            .data(this.nodes)
            .enter()
            .append('g')
            .attr('class', d => `node node-${this.getNodeType(d.type).toLowerCase()}`)
            .call(this.drag());

        // Add circles for nodes
        node.append('circle')
            .attr('r', d => this.getNodeRadius(d.type))
            .attr('fill', d => this.getNodeColor(d.type))
            .attr('stroke', d => this.getNodeStrokeColor(d.type))
            .attr('stroke-width', 2);

        // Add labels
        node.append('text')
            .attr('dy', d => this.getNodeRadius(d.type) + 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('font-weight', '500')
            .text(d => this.truncateText(d.name, 15));

        // Add status indicators
        node.filter(d => d.status && d.status !== 'OPERATIONAL')
            .append('circle')
            .attr('r', 4)
            .attr('cx', d => this.getNodeRadius(d.type) - 5)
            .attr('cy', d => -this.getNodeRadius(d.type) + 5)
            .attr('fill', d => this.getStatusColor(d.status))
            .attr('stroke', 'white')
            .attr('stroke-width', 1);

        // Add click handler for nodes
        node.on('click', (event, d) => {
            this.showNodeDetails(d);
        });

        // Update simulation
        this.simulation
            .nodes(this.nodes)
            .on('tick', () => {
                link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                linkLabel
                    .attr('x', d => (d.source.x + d.target.x) / 2)
                    .attr('y', d => (d.source.y + d.target.y) / 2);

                node.attr('transform', d => `translate(${d.x},${d.y})`);
            });

        this.simulation.force('link').links(this.links);
        this.simulation.alpha(1).restart();
    }

    drag() {
        return d3.drag()
            .on('start', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });
    }

    applyFilter(filterType) {
        if (window.logInfo) {
            window.logInfo(`Applying topology filter: ${filterType || 'all'}`);
        }

        // Reload topology data with the new filter
        this.load();
    }

    resetZoom() {
        this.svg.transition()
            .duration(750)
            .call(
                d3.zoom().transform,
                d3.zoomIdentity
            );
    }

    getNodeType(type) {
        const typeMap = {
            'Server': 'server',
            'DatabaseServer': 'database',
            'Application': 'application',
            'Database': 'database',
            'NetworkSwitch': 'network',
            'Firewall': 'network',
            'LoadBalancer': 'network',
            'Service': 'service',
            'MonitoringSystem': 'monitoring',
            'DataCenter': 'datacenter'
        };
        return typeMap[type] || 'server';
    }

    getNodeColor(type) {
        const colorMap = {
            'Server': '#3498db',
            'DatabaseServer': '#e74c3c',
            'Application': '#2ecc71',
            'Database': '#e74c3c',
            'NetworkSwitch': '#f39c12',
            'Firewall': '#f39c12',
            'LoadBalancer': '#f39c12',
            'Service': '#9b59b6',
            'MonitoringSystem': '#1abc9c',
            'DataCenter': '#34495e'
        };
        return colorMap[type] || '#95a5a6';
    }

    getNodeStrokeColor(type) {
        const strokeMap = {
            'Server': '#2980b9',
            'DatabaseServer': '#c0392b',
            'Application': '#27ae60',
            'Database': '#c0392b',
            'NetworkSwitch': '#e67e22',
            'Firewall': '#e67e22',
            'LoadBalancer': '#e67e22',
            'Service': '#8e44ad',
            'MonitoringSystem': '#16a085',
            'DataCenter': '#2c3e50'
        };
        return strokeMap[type] || '#7f8c8d';
    }

    getNodeRadius(type) {
        const radiusMap = {
            'DataCenter': 20,
            'Service': 18,
            'Server': 15,
            'DatabaseServer': 15,
            'Application': 12,
            'Database': 12,
            'NetworkSwitch': 10,
            'Firewall': 10,
            'LoadBalancer': 10,
            'MonitoringSystem': 8
        };
        return radiusMap[type] || 10;
    }

    getStatusColor(status) {
        const statusMap = {
            'OPERATIONAL': '#27ae60',
            'WARNING': '#f39c12',
            'CRITICAL': '#e74c3c',
            'DOWN': '#c0392b',
            'MAINTENANCE': '#3498db'
        };
        return statusMap[status] || '#95a5a6';
    }

    formatRelationshipType(type) {
        return type.replace(/_/g, ' ').toLowerCase();
    }

    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    showNodeDetails(node) {
        // Show node details in a modal or sidebar
        const details = `
            <strong>${node.name}</strong><br>
            Type: ${node.type}<br>
            Status: ${node.status || 'Unknown'}<br>
            ID: ${node.id}
        `;

        // For demo purposes, just show an alert
        // In a real app, this would open a detailed view
        alert(`Node Details:\n\n${details.replace(/<br>/g, '\n').replace(/<strong>|<\/strong>/g, '')}`);
    }
}

// Initialize topology visualization
document.addEventListener('DOMContentLoaded', () => {
    window.TopologyViz = new TopologyVisualization();
});