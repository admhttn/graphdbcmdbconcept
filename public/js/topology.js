// Topology visualization using D3.js
class TopologyVisualization {
    constructor() {
        this.svg = null;
        this.simulation = null;
        this.nodes = [];
        this.links = [];
        this.width = 800;
        this.height = 600;
        this.init();
    }

    init() {
        if (window.logInfo) {
            window.logInfo('Topology visualization initializing');
        }
        this.bindEvents();
        this.setupVisualization();
        if (window.logSuccess) {
            window.logSuccess('Topology visualization initialized');
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
        container.innerHTML = '';

        // Create SVG
        this.svg = d3.select('#topology-viz')
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${this.width} ${this.height}`);

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
    }

    async load() {
        try {
            if (window.logInfo) {
                window.logInfo('Loading topology data');
            }
            const response = await fetch('/api/cmdb/topology');
            const data = await response.json();

            this.nodes = data.nodes.map(node => ({
                ...node,
                x: Math.random() * this.width,
                y: Math.random() * this.height
            }));

            this.links = data.relationships.map(link => ({
                source: link.from,
                target: link.to,
                type: link.type
            }));

            if (window.logSuccess) {
                window.logSuccess(`Topology loaded: ${this.nodes.length} nodes, ${this.links.length} links`);
            }
            this.render();
        } catch (error) {
            if (window.logError) {
                window.logError('Error loading topology:', { error: error.message });
            }
            console.error('Error loading topology:', error);
            document.getElementById('topology-viz').innerHTML =
                '<div class="loading">Failed to load topology data</div>';
        }
    }

    render() {
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
            window.logInfo(`Applying topology filter: ${filterType || 'none'}`);
        }

        if (!filterType) {
            // Show all nodes and links
            this.svg.selectAll('.node').style('opacity', 1);
            this.svg.selectAll('.link').style('opacity', 1);
            this.svg.selectAll('.link-label').style('opacity', 1);
            return;
        }

        // Filter nodes by type
        this.svg.selectAll('.node')
            .style('opacity', d => d.type === filterType ? 1 : 0.2);

        // Filter links connected to visible nodes
        this.svg.selectAll('.link')
            .style('opacity', d => {
                const sourceVisible = d.source.type === filterType;
                const targetVisible = d.target.type === filterType;
                return (sourceVisible || targetVisible) ? 1 : 0.1;
            });

        this.svg.selectAll('.link-label')
            .style('opacity', d => {
                const sourceVisible = d.source.type === filterType;
                const targetVisible = d.target.type === filterType;
                return (sourceVisible || targetVisible) ? 1 : 0.1;
            });
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