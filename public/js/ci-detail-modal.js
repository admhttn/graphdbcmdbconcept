// CI Detail Modal for CMDB Configuration Items detailed view
class CIDetailModal {
    constructor() {
        this.modal = null;
        this.currentCIId = null;
        this.topologyInstance = null;
        this.init();
    }

    init() {
        this.modal = document.getElementById('ci-detail-modal');
        if (!this.modal) {
            console.warn('CI Detail Modal not found in DOM');
            return;
        }

        this.bindEvents();

        if (window.logInfo) {
            window.logInfo('CI Detail Modal initialized');
        }
    }

    bindEvents() {
        // Close modal events
        const closeBtn = document.getElementById('close-ci-detail');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Click outside modal to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                this.close();
            }
        });

        // Refresh buttons
        const refreshBtn = document.getElementById('refresh-ci-detail');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (this.currentCIId) {
                    this.loadCIDetails(this.currentCIId);
                }
            });
        }

        const refreshRelationshipsBtn = document.getElementById('refresh-relationships');
        if (refreshRelationshipsBtn) {
            refreshRelationshipsBtn.addEventListener('click', () => {
                if (this.currentCIId) {
                    this.loadRelationships(this.currentCIId);
                }
            });
        }

        const refreshTopologyBtn = document.getElementById('refresh-topology');
        if (refreshTopologyBtn) {
            refreshTopologyBtn.addEventListener('click', () => {
                if (this.currentCIId) {
                    this.loadTopology(this.currentCIId);
                }
            });
        }

        const resetTopologyZoomBtn = document.getElementById('reset-topology-zoom');
        if (resetTopologyZoomBtn) {
            resetTopologyZoomBtn.addEventListener('click', () => {
                this.resetTopologyZoom();
            });
        }

        // Topology depth selector
        const topologyDepth = document.getElementById('topology-depth');
        if (topologyDepth) {
            topologyDepth.addEventListener('change', () => {
                if (this.currentCIId) {
                    this.loadTopology(this.currentCIId);
                }
            });
        }
    }

    async open(ciId) {
        if (!ciId) {
            console.error('CI ID is required to open detail modal');
            return;
        }

        this.currentCIId = ciId;
        this.modal.classList.remove('hidden');

        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';

        // Load CI details
        await this.loadCIDetails(ciId);

        if (window.logInfo) {
            window.logInfo('CI Detail Modal opened', { ciId });
        }
    }

    close() {
        this.modal.classList.add('hidden');
        document.body.style.overflow = '';
        this.currentCIId = null;

        // Clean up topology instance
        if (this.topologyInstance) {
            this.topologyInstance.destroy?.();
            this.topologyInstance = null;
        }

        if (window.logInfo) {
            window.logInfo('CI Detail Modal closed');
        }
    }

    async loadCIDetails(ciId) {
        try {
            this.showLoadingState();

            const response = await fetch(`/api/cmdb/items/${ciId}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const ciData = await response.json();
            this.renderCIDetails(ciData);

            // Load relationships and topology in parallel
            await Promise.all([
                this.loadRelationships(ciId),
                this.loadTopology(ciId)
            ]);

            this.showContentState();

            if (window.logSuccess) {
                window.logSuccess('CI details loaded successfully', { ciId, name: ciData.name });
            }

        } catch (error) {
            console.error('Error loading CI details:', error);
            this.showErrorState();

            if (window.logError) {
                window.logError('Failed to load CI details', { ciId, error: error.message });
            }
        }
    }

    renderCIDetails(ciData) {
        // Update modal title
        const title = document.getElementById('ci-detail-title');
        if (title) {
            title.textContent = `${ciData.name} - Details`;
        }

        // Basic information
        document.getElementById('detail-name').textContent = ciData.name || '-';
        document.getElementById('detail-id').textContent = ciData.id || '-';

        const typeElement = document.getElementById('detail-type');
        if (typeElement) {
            typeElement.textContent = ciData.type || '-';
            typeElement.className = `ci-type ${(ciData.type || '').toLowerCase()}`;
        }

        const statusElement = document.getElementById('detail-status');
        if (statusElement) {
            statusElement.textContent = ciData.status || 'unknown';
            statusElement.className = `ci-status ${(ciData.status || 'unknown').toLowerCase()}`;
        }

        document.getElementById('detail-created').textContent =
            ciData.createdAt ? this.formatTimestamp(ciData.createdAt) : '-';
        document.getElementById('detail-updated').textContent =
            ciData.updatedAt ? this.formatTimestamp(ciData.updatedAt) : '-';

        // Properties
        this.renderProperties(ciData);
    }

    renderProperties(ciData) {
        const propertiesContainer = document.getElementById('detail-properties');
        if (!propertiesContainer) return;

        // Filter out the basic properties we've already shown
        const excludeKeys = ['id', 'name', 'type', 'status', 'createdAt', 'updatedAt', 'relationships'];
        const properties = Object.entries(ciData)
            .filter(([key]) => !excludeKeys.includes(key))
            .filter(([, value]) => value !== null && value !== undefined && value !== '');

        if (properties.length === 0) {
            propertiesContainer.innerHTML = '<div class="empty-message" style="text-align: center; color: #666; font-style: italic; padding: 20px;">No additional properties available.</div>';
            return;
        }

        propertiesContainer.innerHTML = properties.map(([key, value]) => `
            <div class="property-item">
                <span class="property-key">${this.formatPropertyKey(key)}</span>
                <span class="property-value">${this.formatPropertyValue(value)}</span>
            </div>
        `).join('');
    }

    async loadRelationships(ciId) {
        try {
            const response = await fetch(`/api/cmdb/items/${ciId}/relationships`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.renderRelationships(data.relationships || []);

        } catch (error) {
            console.error('Error loading relationships:', error);
            const relationshipsContainer = document.getElementById('detail-relationships');
            if (relationshipsContainer) {
                relationshipsContainer.innerHTML = '<div class="error">Failed to load relationships</div>';
            }
        }
    }

    renderRelationships(relationships) {
        const relationshipsContainer = document.getElementById('detail-relationships');
        if (!relationshipsContainer) return;

        if (!relationships || relationships.length === 0) {
            relationshipsContainer.innerHTML = '<div class="empty-message" style="text-align: center; color: #666; font-style: italic; padding: 20px;">No relationships found for this configuration item.</div>';
            return;
        }

        // Group relationships by type and direction
        const groupedRelationships = this.groupRelationships(relationships);

        relationshipsContainer.innerHTML = Object.entries(groupedRelationships).map(([groupKey, groupRelationships]) => {
            const [direction, relType] = groupKey.split('|');
            const displayDirection = direction === 'outgoing' ? '→' : '←';

            return `
                <div class="relationship-group">
                    <h4>${displayDirection} ${relType} (${groupRelationships.length})</h4>
                    <div class="relationship-items">
                        ${groupRelationships.map(rel => `
                            <div class="relationship-item-detail">
                                <span class="relationship-arrow">${displayDirection}</span>
                                <div class="relationship-target">
                                    <a href="#" class="relationship-target-name" data-id="${rel.relatedItem.id}">
                                        ${this.escapeHtml(rel.relatedItem.name)}
                                    </a>
                                    <span class="relationship-target-type">${rel.relatedItem.type}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');

        // Bind click events for related CI links
        relationshipsContainer.querySelectorAll('.relationship-target-name').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const relatedId = e.target.dataset.id;
                if (relatedId) {
                    this.open(relatedId); // Open the related CI in the same modal
                }
            });
        });
    }

    async loadTopology(ciId) {
        try {
            const depth = document.getElementById('topology-depth')?.value || '2';
            const topologyContainer = document.getElementById('detail-topology');

            if (!topologyContainer) return;

            // Show loading
            topologyContainer.innerHTML = '<div class="loading">Loading relationship diagram...</div>';

            const response = await fetch(`/api/cmdb/topology?startNode=${ciId}&depth=${depth}&limit=50`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const topologyData = await response.json();
            this.renderTopology(topologyData, ciId);

        } catch (error) {
            console.error('Error loading topology:', error);
            const topologyContainer = document.getElementById('detail-topology');
            if (topologyContainer) {
                topologyContainer.innerHTML = '<div class="error">Failed to load relationship diagram</div>';
            }
        }
    }

    renderTopology(topologyData, centerNodeId) {
        const topologyContainer = document.getElementById('detail-topology');
        if (!topologyContainer) return;

        // Clear container
        topologyContainer.innerHTML = '';

        if (!topologyData.nodes || topologyData.nodes.length === 0) {
            topologyContainer.innerHTML = '<div class="empty-message" style="text-align: center; color: #666; font-style: italic; padding: 60px 20px;">No topology data available for visualization.</div>';
            return;
        }

        // Create a simple D3 visualization
        this.createTopologyVisualization(topologyContainer, topologyData, centerNodeId);
    }

    createTopologyVisualization(container, data, centerNodeId) {
        const width = container.clientWidth || 600;
        const height = 400;

        // Create SVG
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('border', '1px solid #e1e5e9')
            .style('border-radius', '8px');

        // Create zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 3])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        const g = svg.append('g');

        // Convert relationships from API format (from/to) to D3 format (source/target)
        const links = data.relationships.map(rel => ({
            source: rel.from,
            target: rel.to,
            type: rel.type
        }));

        // Create force simulation
        const simulation = d3.forceSimulation(data.nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(80))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2));

        // Create links
        const link = g.append('g')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke', '#999')
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6);

        // Create nodes
        const node = g.append('g')
            .selectAll('circle')
            .data(data.nodes)
            .join('circle')
            .attr('r', d => d.id === centerNodeId ? 12 : 8)
            .attr('fill', d => {
                if (d.id === centerNodeId) return '#ff6b6b';
                switch (d.type) {
                    case 'Server': return '#28a745';
                    case 'Database': return '#17a2b8';
                    case 'WebApplication': return '#fd7e14';
                    case 'BusinessService': return '#6f42c1';
                    default: return '#6c757d';
                }
            })
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        // Add labels
        const label = g.append('g')
            .selectAll('text')
            .data(data.nodes)
            .join('text')
            .text(d => d.name)
            .attr('font-size', 12)
            .attr('font-family', 'Arial, sans-serif')
            .attr('text-anchor', 'middle')
            .attr('dy', d => d.id === centerNodeId ? -16 : -12)
            .attr('fill', '#333')
            .style('pointer-events', 'none');

        // Add tooltips
        node.append('title')
            .text(d => `${d.name}\nType: ${d.type}\nStatus: ${d.status}`);

        // Update positions on simulation tick
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            label
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        // Drag functions
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        // Store simulation for cleanup
        this.topologyInstance = { simulation, svg, destroy: () => simulation.stop() };

        // Reset zoom function
        this.resetTopologyZoom = () => {
            svg.transition()
                .duration(750)
                .call(zoom.transform, d3.zoomIdentity);
        };
    }

    groupRelationships(relationships) {
        const grouped = {};

        relationships.forEach(rel => {
            const key = `${rel.direction}|${rel.relationshipType}`;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(rel);
        });

        return grouped;
    }

    formatPropertyKey(key) {
        // Convert camelCase to Title Case
        return key.replace(/([A-Z])/g, ' $1')
                  .replace(/^./, str => str.toUpperCase())
                  .trim();
    }

    formatPropertyValue(value) {
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value, null, 2);
        }
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        return String(value);
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return '-';

        try {
            const date = new Date(timestamp);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return timestamp;
        }
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showLoadingState() {
        const loading = document.querySelector('.ci-detail-loading');
        const content = document.querySelector('.ci-detail-content');
        const error = document.querySelector('.ci-detail-error');

        if (loading) loading.style.display = 'block';
        if (content) content.style.display = 'none';
        if (error) error.style.display = 'none';
    }

    showContentState() {
        const loading = document.querySelector('.ci-detail-loading');
        const content = document.querySelector('.ci-detail-content');
        const error = document.querySelector('.ci-detail-error');

        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'block';
        if (error) error.style.display = 'none';
    }

    showErrorState() {
        const loading = document.querySelector('.ci-detail-loading');
        const content = document.querySelector('.ci-detail-content');
        const error = document.querySelector('.ci-detail-error');

        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'none';
        if (error) error.style.display = 'block';
    }
}

// Export for use in main app
window.CIDetailModal = CIDetailModal;