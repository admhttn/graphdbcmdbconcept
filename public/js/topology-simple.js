// Simple Topology Visualization
class SimpleTopology {
    constructor() {
        this.container = null;
        this.data = { nodes: [], links: [] };
        this.init();
    }

    init() {
        console.log('Simple topology initializing...');
        this.container = document.getElementById('topology-viz');

        if (!this.container) {
            console.error('Topology container not found');
            return;
        }

        this.bindEvents();
        this.load();
    }

    bindEvents() {
        // Refresh button
        const refreshBtn = document.getElementById('refresh-topology');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.load());
        }

        // Filter dropdown
        const filterSelect = document.getElementById('topology-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', () => this.load());
        }
    }

    async load() {
        if (!this.container) return;

        try {
            // Show loading
            this.container.innerHTML = '<div class="loading">Loading topology...</div>';

            // Get filter value
            const filter = document.getElementById('topology-filter')?.value || '';

            // Build API URL
            let url = '/api/cmdb/topology?limit=50';
            if (filter) {
                url += `&type=${filter}`;
            }

            console.log('Fetching:', url);

            // Fetch data
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('Received:', data.nodes?.length || 0, 'nodes,', data.relationships?.length || 0, 'relationships');

            // Validate data
            if (!data.nodes || !Array.isArray(data.nodes)) {
                throw new Error('No nodes data');
            }

            // Limit data for performance
            const nodes = data.nodes.slice(0, 30);
            const links = (data.relationships || []).slice(0, 50);

            // Store data
            this.data = { nodes, links };

            // Render
            this.render();

        } catch (error) {
            console.error('Topology load error:', error);
            this.container.innerHTML = `<div class="loading" style="color: red;">Error: ${error.message}</div>`;
        }
    }

    render() {
        if (!this.container) return;

        console.log('Rendering topology with', this.data.nodes.length, 'nodes');

        // Clear container
        this.container.innerHTML = '';

        // Check if D3 is available
        if (typeof d3 === 'undefined') {
            this.container.innerHTML = '<div class="loading" style="color: red;">D3.js not loaded</div>';
            return;
        }

        // Create simple list view if no nodes
        if (this.data.nodes.length === 0) {
            this.container.innerHTML = '<div class="loading">No topology data available</div>';
            return;
        }

        // Create SVG
        const width = 800;
        const height = 600;

        const svg = d3.select(this.container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .style('background', '#f8f9fa')
            .style('border', '1px solid #ddd');

        // Create simple node positions
        const nodes = this.data.nodes.map((node, i) => ({
            ...node,
            x: 100 + (i % 6) * 120,
            y: 100 + Math.floor(i / 6) * 100
        }));

        // Create node lookup for relationships
        const nodeMap = new Map();
        nodes.forEach(node => nodeMap.set(node.id, node));

        // Filter valid relationships (both nodes exist)
        const validLinks = this.data.links.filter(link =>
            nodeMap.has(link.from) && nodeMap.has(link.to)
        );

        console.log('Drawing', validLinks.length, 'relationships between nodes');

        // Draw relationships first (so they appear behind nodes)
        const linkElements = svg.selectAll('.link')
            .data(validLinks)
            .enter()
            .append('line')
            .attr('class', 'link')
            .attr('x1', d => nodeMap.get(d.from).x)
            .attr('y1', d => nodeMap.get(d.from).y)
            .attr('x2', d => nodeMap.get(d.to).x)
            .attr('y2', d => nodeMap.get(d.to).y)
            .attr('stroke', '#999')
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6);

        // Add relationship labels
        const linkLabels = svg.selectAll('.link-label')
            .data(validLinks)
            .enter()
            .append('text')
            .attr('class', 'link-label')
            .attr('x', d => (nodeMap.get(d.from).x + nodeMap.get(d.to).x) / 2)
            .attr('y', d => (nodeMap.get(d.from).y + nodeMap.get(d.to).y) / 2)
            .attr('text-anchor', 'middle')
            .style('font-size', '8px')
            .style('fill', '#666')
            .style('background', 'white')
            .text(d => d.type);

        // Draw nodes
        const nodeElements = svg.selectAll('.node')
            .data(nodes)
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);

        // Add circles
        nodeElements.append('circle')
            .attr('r', 20)
            .attr('fill', d => this.getNodeColor(d.type))
            .attr('stroke', '#333')
            .attr('stroke-width', 2);

        // Add labels
        nodeElements.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', 5)
            .style('font-size', '10px')
            .style('fill', '#333')
            .text(d => d.name?.substring(0, 10) || d.id?.substring(0, 10));

        // Add type labels
        nodeElements.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', -25)
            .style('font-size', '8px')
            .style('fill', '#666')
            .text(d => d.type);

        console.log('Topology rendered successfully');
    }

    getNodeColor(type) {
        const colors = {
            'Server': '#ff6b6b',
            'Database': '#4ecdc4',
            'Application': '#45b7d1',
            'WebApplication': '#96ceb4',
            'BusinessService': '#feca57',
            'Region': '#ff9ff3',
            'DataCenter': '#54a0ff'
        };
        return colors[type] || '#95a5a6';
    }
}

// Global instance
window.SimpleTopology = SimpleTopology;