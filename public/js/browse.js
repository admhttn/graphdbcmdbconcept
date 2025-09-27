// Browse module for CMDB Configuration Items table view
class CMDBBrowser {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 200;
        this.searchTerm = '';
        this.selectedType = '';
        this.sortField = 'name';
        this.sortOrder = 'asc';
        this.expandedRows = new Set();
        this.relationshipCache = new Map();

        // Debounce search to avoid too many API calls
        this.searchDebounceTimer = null;
        this.searchDebounceDelay = 300;

        this.init();
    }

    init() {
        this.bindEvents();
        this.loadData();

        if (window.logInfo) {
            window.logInfo('CMDB Browser initialized');
        }
    }

    bindEvents() {
        // Search input
        const searchInput = document.getElementById('ci-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.debounceSearch(e.target.value);
            });
        }

        // Type filter
        const typeFilter = document.getElementById('ci-type-filter');
        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this.selectedType = e.target.value;
                this.currentPage = 1;
                this.loadData();
            });
        }

        // Clear filters button
        const clearFilters = document.getElementById('clear-filters');
        if (clearFilters) {
            clearFilters.addEventListener('click', () => {
                this.clearFilters();
            });
        }

        // Refresh button
        const refreshBtn = document.getElementById('refresh-browse');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadData();
            });
        }

        // Page size selector
        const pageSize = document.getElementById('page-size');
        if (pageSize) {
            pageSize.addEventListener('change', (e) => {
                this.pageSize = parseInt(e.target.value);
                this.currentPage = 1;
                this.loadData();
            });
        }

        // Show relationships checkbox
        const showRelationships = document.getElementById('show-relationships');
        if (showRelationships) {
            showRelationships.addEventListener('change', () => {
                this.renderTable();
            });
        }

        // Pagination buttons
        document.getElementById('first-page')?.addEventListener('click', () => this.goToPage(1));
        document.getElementById('prev-page')?.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        document.getElementById('next-page')?.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        document.getElementById('last-page')?.addEventListener('click', () => this.goToPage(this.totalPages));

        // Table header sorting
        document.querySelectorAll('.ci-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const sortField = th.dataset.sort;
                this.toggleSort(sortField);
            });
        });
    }

    debounceSearch(value) {
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
            this.searchTerm = value.trim();
            this.currentPage = 1;
            this.loadData();
        }, this.searchDebounceDelay);
    }

    clearFilters() {
        this.searchTerm = '';
        this.selectedType = '';
        this.currentPage = 1;

        // Reset UI
        document.getElementById('ci-search').value = '';
        document.getElementById('ci-type-filter').value = '';

        this.loadData();
    }

    toggleSort(field) {
        if (this.sortField === field) {
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortOrder = 'asc';
        }

        this.updateSortHeaders();
        this.loadData();
    }

    updateSortHeaders() {
        // Clear all sort indicators
        document.querySelectorAll('.ci-table th.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
        });

        // Add current sort indicator
        const currentHeader = document.querySelector(`[data-sort="${this.sortField}"]`);
        if (currentHeader) {
            currentHeader.classList.add(this.sortOrder === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    }

    async loadData() {
        try {
            this.showLoading();

            if (window.logInfo) {
                window.logInfo('Loading browse data', {
                    page: this.currentPage,
                    search: this.searchTerm,
                    type: this.selectedType
                });
            }

            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.pageSize,
                sort: this.sortField,
                order: this.sortOrder
            });

            if (this.searchTerm) {
                params.append('search', this.searchTerm);
            }
            if (this.selectedType) {
                params.append('type', this.selectedType);
            }

            const response = await fetch(`/api/cmdb/browse?${params}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.data = data.items;
            this.pagination = data.pagination;
            this.totalPages = data.pagination.totalPages;

            this.updateSummary();
            this.renderTable();
            this.updatePagination();

            if (window.logSuccess) {
                window.logSuccess('Browse data loaded successfully', {
                    itemCount: this.data.length,
                    total: this.pagination.total
                });
            }

        } catch (error) {
            console.error('Error loading browse data:', error);
            this.showError('Failed to load configuration items');

            if (window.logError) {
                window.logError('Failed to load browse data', { error: error.message });
            }
        }
    }

    showLoading() {
        const tbody = document.getElementById('ci-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading-row">
                        <div class="loading">Loading configuration items...</div>
                    </td>
                </tr>
            `;
        }
    }

    showError(message) {
        const tbody = document.getElementById('ci-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading-row">
                        <div class="error">${message}</div>
                    </td>
                </tr>
            `;
        }
    }

    updateSummary() {
        const resultsCount = document.getElementById('results-count');
        const totalCount = document.getElementById('total-count');

        if (resultsCount && this.pagination) {
            const start = (this.pagination.page - 1) * this.pagination.limit + 1;
            const end = Math.min(start + this.data.length - 1, this.pagination.total);
            resultsCount.textContent = `Showing ${start}-${end} of ${this.pagination.total} items`;
        }

        if (totalCount && this.searchTerm) {
            totalCount.textContent = `(filtered)`;
        } else if (totalCount) {
            totalCount.textContent = '';
        }
    }

    renderTable() {
        const tbody = document.getElementById('ci-table-body');
        const showRelationships = document.getElementById('show-relationships')?.checked !== false;

        if (!tbody || !this.data) return;

        if (this.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading-row">
                        <div class="loading">No configuration items found</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.data.map(item => {
            const isExpanded = this.expandedRows.has(item.id);
            return this.renderTableRow(item, showRelationships, isExpanded);
        }).join('');

        // Bind row-specific events
        this.bindRowEvents();
    }

    renderTableRow(item, showRelationships, isExpanded) {
        const hasRelationships = item.relationshipCount > 0;

        return `
            <tr data-id="${item.id}" ${isExpanded ? 'class="expanded"' : ''}>
                <td>
                    <div class="ci-name">${this.escapeHtml(item.name)}</div>
                    <div class="ci-id" style="font-size: 0.7rem; color: #666;">${item.id}</div>
                </td>
                <td>
                    <span class="ci-type ${item.type.toLowerCase()}">${item.type}</span>
                </td>
                <td>
                    <span class="ci-status ${item.status.toLowerCase()}">${item.status}</span>
                </td>
                <td>
                    ${showRelationships ? this.renderRelationshipIndicators(item, hasRelationships) : '-'}
                </td>
                <td>
                    ${item.updatedAt ? this.formatTimestamp(item.updatedAt) : '-'}
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn primary view-btn" data-id="${item.id}">View</button>
                        ${hasRelationships ? `<button class="action-btn expand-btn" data-id="${item.id}">${isExpanded ? 'Collapse' : 'Expand'}</button>` : ''}
                    </div>
                </td>
            </tr>
            ${isExpanded ? this.renderExpandedRow(item.id) : ''}
        `;
    }

    renderRelationshipIndicators(item, hasRelationships) {
        if (!hasRelationships) {
            return '<span class="relationship-badge">None</span>';
        }

        return `
            <div class="relationship-indicators">
                <span class="relationship-badge has-relationships">
                    <span class="relationship-count">${item.relationshipCount}</span>
                    ${item.relationshipCount === 1 ? 'relationship' : 'relationships'}
                </span>
            </div>
        `;
    }

    renderExpandedRow(itemId) {
        const relationships = this.relationshipCache.get(itemId);

        if (!relationships) {
            return `
                <tr class="relationship-details-row" data-parent="${itemId}">
                    <td colspan="6">
                        <div class="relationship-details">
                            <div class="loading">Loading relationships...</div>
                        </div>
                    </td>
                </tr>
            `;
        }

        if (relationships.length === 0) {
            return `
                <tr class="relationship-details-row" data-parent="${itemId}">
                    <td colspan="6">
                        <div class="relationship-details">
                            <p>No relationships found for this configuration item.</p>
                        </div>
                    </td>
                </tr>
            `;
        }

        return `
            <tr class="relationship-details-row" data-parent="${itemId}">
                <td colspan="6">
                    <div class="relationship-details">
                        <h4>Relationships (${relationships.length})</h4>
                        <div class="relationship-list">
                            ${relationships.map(rel => `
                                <div class="relationship-item">
                                    <span class="relationship-direction">${rel.direction}</span>
                                    <span class="relationship-type">${rel.relationshipType}</span>
                                    <a href="#" class="related-ci-name" data-id="${rel.relatedItem.id}">
                                        ${this.escapeHtml(rel.relatedItem.name)}
                                    </a>
                                    <span class="ci-type ${rel.relatedItem.type.toLowerCase()}">${rel.relatedItem.type}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    bindRowEvents() {
        // View button clicks
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.viewItem(id);
            });
        });

        // Expand/collapse button clicks
        document.querySelectorAll('.expand-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.toggleRowExpansion(id);
            });
        });

        // Related CI name clicks
        document.querySelectorAll('.related-ci-name').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const id = e.target.dataset.id;
                this.viewItem(id);
            });
        });
    }

    async toggleRowExpansion(itemId) {
        if (this.expandedRows.has(itemId)) {
            this.expandedRows.delete(itemId);
        } else {
            this.expandedRows.add(itemId);
            // Load relationships if not cached
            if (!this.relationshipCache.has(itemId)) {
                await this.loadRelationships(itemId);
            }
        }
        this.renderTable();
    }

    async loadRelationships(itemId) {
        try {
            const response = await fetch(`/api/cmdb/items/${itemId}/relationships`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.relationshipCache.set(itemId, data.relationships);
        } catch (error) {
            console.error('Error loading relationships:', error);
            this.relationshipCache.set(itemId, []);
        }
    }

    viewItem(itemId) {
        // This could open a modal or navigate to a detail view
        // For now, let's just log it and show a simple alert
        if (window.logInfo) {
            window.logInfo('Viewing CI details', { itemId });
        }

        // You could implement a detail modal here
        alert(`View details for item: ${itemId}\n\nThis could open a detailed view or modal.`);
    }

    updatePagination() {
        const pagination = this.pagination;
        if (!pagination) return;

        // Update pagination info
        const paginationInfo = document.getElementById('pagination-info');
        if (paginationInfo) {
            paginationInfo.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
        }

        // Update pagination buttons
        document.getElementById('first-page').disabled = !pagination.hasPrev;
        document.getElementById('prev-page').disabled = !pagination.hasPrev;
        document.getElementById('next-page').disabled = !pagination.hasNext;
        document.getElementById('last-page').disabled = !pagination.hasNext;

        // Generate page numbers
        this.generatePageNumbers();
    }

    generatePageNumbers() {
        const pageNumbers = document.getElementById('page-numbers');
        if (!pageNumbers || !this.pagination) return;

        const { page, totalPages } = this.pagination;
        const maxVisible = 5;

        let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        // Adjust start if we're near the end
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        pageNumbers.innerHTML = '';

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-number ${i === page ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => this.goToPage(i));
            pageNumbers.appendChild(pageBtn);
        }
    }

    goToPage(page) {
        if (!this.pagination) return;

        if (page >= 1 && page <= this.pagination.totalPages && page !== this.currentPage) {
            this.currentPage = page;
            this.loadData();
        }
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
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in main app
window.CMDBBrowser = CMDBBrowser;