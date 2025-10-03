/**
 * Temporal Timeline UI Component
 *
 * Provides time-travel interface for exploring historical topology states
 * Features:
 * - Date slider for navigating through time
 * - Relationship history viewer
 * - Weight trend visualization
 * - Expiring relationships alerts
 */

class TemporalTimeline {
  constructor(containerId, options = {}) {
    this.container = d3.select(`#${containerId}`);
    this.options = {
      minDate: options.minDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
      maxDate: options.maxDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days ahead
      onDateChange: options.onDateChange || (() => {}),
      showExpiring: options.showExpiring !== false
    };

    this.currentDate = new Date();
    this.initialized = false;
  }

  /**
   * Initialize the timeline UI
   */
  async initialize() {
    if (this.initialized) return;

    this.renderTimeline();
    this.renderControls();
    this.renderHistoryPanel();

    if (this.options.showExpiring) {
      await this.loadExpiringRelationships();
    }

    this.initialized = true;
  }

  /**
   * Render the main timeline slider
   */
  renderTimeline() {
    const timelineDiv = this.container.append('div')
      .attr('class', 'temporal-timeline-container')
      .style('padding', '20px')
      .style('background', '#f8f9fa')
      .style('border-radius', '8px')
      .style('margin-bottom', '20px');

    // Timeline header
    timelineDiv.append('h3')
      .style('margin', '0 0 15px 0')
      .html('<i class="fas fa-clock"></i> Time-Travel Timeline');

    // Current date display
    this.dateLabel = timelineDiv.append('div')
      .attr('class', 'current-date-label')
      .style('font-size', '24px')
      .style('font-weight', 'bold')
      .style('color', '#007bff')
      .style('text-align', 'center')
      .style('margin-bottom', '15px')
      .text(this.formatDate(this.currentDate));

    // Date slider
    const sliderContainer = timelineDiv.append('div')
      .style('margin', '20px 0');

    const slider = sliderContainer.append('input')
      .attr('type', 'range')
      .attr('min', this.options.minDate.getTime())
      .attr('max', this.options.maxDate.getTime())
      .attr('value', this.currentDate.getTime())
      .attr('step', 24 * 60 * 60 * 1000) // 1 day steps
      .style('width', '100%')
      .style('height', '10px')
      .on('input', (event) => {
        const timestamp = parseInt(event.target.value);
        this.currentDate = new Date(timestamp);
        this.dateLabel.text(this.formatDate(this.currentDate));
      })
      .on('change', (event) => {
        const timestamp = parseInt(event.target.value);
        this.currentDate = new Date(timestamp);
        this.options.onDateChange(this.currentDate);
      });

    // Timeline range labels
    const rangeLabels = sliderContainer.append('div')
      .style('display', 'flex')
      .style('justify-content', 'space-between')
      .style('font-size', '12px')
      .style('color', '#6c757d')
      .style('margin-top', '5px');

    rangeLabels.append('span').text(this.formatDate(this.options.minDate));
    rangeLabels.append('span').text('TODAY').style('font-weight', 'bold');
    rangeLabels.append('span').text(this.formatDate(this.options.maxDate));
  }

  /**
   * Render timeline controls
   */
  renderControls() {
    const controlsDiv = this.container.append('div')
      .attr('class', 'temporal-controls')
      .style('display', 'flex')
      .style('gap', '10px')
      .style('margin-bottom', '20px');

    // Quick navigation buttons
    const quickNavButtons = [
      { label: '1 Year Ago', offset: -365 },
      { label: '6 Months Ago', offset: -180 },
      { label: '1 Month Ago', offset: -30 },
      { label: 'Today', offset: 0 },
      { label: '1 Month Ahead', offset: 30 }
    ];

    quickNavButtons.forEach(btn => {
      controlsDiv.append('button')
        .attr('class', 'btn btn-sm btn-outline-secondary')
        .text(btn.label)
        .on('click', () => {
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + btn.offset);
          this.jumpToDate(targetDate);
        });
    });

    // Refresh topology button
    controlsDiv.append('button')
      .attr('class', 'btn btn-sm btn-primary')
      .html('<i class="fas fa-sync-alt"></i> Refresh Topology')
      .on('click', () => {
        this.options.onDateChange(this.currentDate);
      });
  }

  /**
   * Render relationship history panel
   */
  renderHistoryPanel() {
    const historyDiv = this.container.append('div')
      .attr('class', 'relationship-history-panel')
      .style('background', 'white')
      .style('border', '1px solid #dee2e6')
      .style('border-radius', '8px')
      .style('padding', '20px')
      .style('margin-bottom', '20px');

    historyDiv.append('h4')
      .style('margin', '0 0 15px 0')
      .text('Relationship History');

    this.historyContent = historyDiv.append('div')
      .attr('class', 'history-content')
      .style('max-height', '300px')
      .style('overflow-y', 'auto');

    this.historyContent.append('p')
      .style('color', '#6c757d')
      .style('font-style', 'italic')
      .text('Select a relationship in the topology to view its version history');
  }

  /**
   * Load and display expiring relationships
   */
  async loadExpiringRelationships() {
    try {
      const response = await fetch('/api/relationships/temporal/expiring?daysAhead=30');
      const data = await response.json();

      if (data.relationships && data.relationships.length > 0) {
        this.renderExpiringAlert(data.relationships);
      }
    } catch (error) {
      console.error('Error loading expiring relationships:', error);
    }
  }

  /**
   * Render alert for expiring relationships
   */
  renderExpiringAlert(relationships) {
    const alertDiv = this.container.insert('div', ':first-child')
      .attr('class', 'alert alert-warning')
      .style('border-left', '4px solid #ffc107')
      .style('margin-bottom', '20px');

    alertDiv.append('h5')
      .html('<i class="fas fa-exclamation-triangle"></i> Expiring Relationships Alert');

    alertDiv.append('p')
      .text(`${relationships.length} relationship(s) will expire within the next 30 days:`);

    const list = alertDiv.append('ul')
      .style('margin-bottom', '0');

    relationships.slice(0, 5).forEach(rel => {
      list.append('li')
        .html(`
          <strong>${rel.sourceName}</strong> → <strong>${rel.targetName}</strong>
          <br><small>Expires in ${Math.ceil(rel.daysUntilExpiry)} days (${new Date(rel.expiresAt).toLocaleDateString()})</small>
        `);
    });

    if (relationships.length > 5) {
      alertDiv.append('p')
        .style('margin-top', '10px')
        .style('margin-bottom', '0')
        .html(`<em>... and ${relationships.length - 5} more</em>`);
    }
  }

  /**
   * Jump to a specific date
   */
  jumpToDate(date) {
    this.currentDate = date;
    this.dateLabel.text(this.formatDate(this.currentDate));

    // Update slider
    this.container.select('input[type="range"]')
      .property('value', date.getTime());

    // Trigger callback
    this.options.onDateChange(this.currentDate);
  }

  /**
   * Display relationship version history
   */
  async showRelationshipHistory(fromId, toId, relType) {
    try {
      const response = await fetch(`/api/relationships/temporal/${fromId}/${toId}/${relType}/history`);
      const data = await response.json();

      this.historyContent.html(''); // Clear previous content

      if (data.versionCount === 0) {
        this.historyContent.append('p')
          .style('color', '#6c757d')
          .style('font-style', 'italic')
          .text('No version history available for this relationship');
        return;
      }

      // History header
      this.historyContent.append('div')
        .style('margin-bottom', '15px')
        .html(`
          <strong>Relationship:</strong> ${data.from} → ${data.to}<br>
          <strong>Type:</strong> ${data.type}<br>
          <strong>Versions:</strong> ${data.versionCount}
        `);

      // Version timeline
      const versions = this.historyContent.append('div')
        .attr('class', 'version-timeline');

      data.history.forEach((version, index) => {
        const versionDiv = versions.append('div')
          .attr('class', 'version-item')
          .style('border-left', version.status === 'ACTIVE' ? '4px solid #28a745' : '4px solid #6c757d')
          .style('padding', '10px 15px')
          .style('margin-bottom', '10px')
          .style('background', version.status === 'ACTIVE' ? '#f0fff0' : '#f8f9fa')
          .style('border-radius', '4px');

        versionDiv.append('div')
          .style('font-weight', 'bold')
          .style('margin-bottom', '5px')
          .html(`
            Version ${version.version}
            <span class="badge badge-${version.status === 'ACTIVE' ? 'success' : 'secondary'}">${version.status}</span>
          `);

        versionDiv.append('div')
          .style('font-size', '12px')
          .style('color', '#6c757d')
          .html(`
            <strong>Valid:</strong> ${this.formatDate(new Date(version.validFrom))}
            → ${version.validTo ? this.formatDate(new Date(version.validTo)) : 'Present'}<br>
            <strong>Reason:</strong> ${version.changeReason || 'N/A'}<br>
            <strong>Modified by:</strong> ${version.modifiedBy || version.createdBy}
          `);

        if (version.properties.weight !== undefined) {
          versionDiv.append('div')
            .style('font-size', '12px')
            .style('margin-top', '5px')
            .html(`
              <strong>Weight:</strong> ${version.properties.weight.toFixed(2)} |
              <strong>Criticality:</strong> ${version.properties.criticalityScore?.toFixed(2) || 'N/A'}
            `);
        }
      });

      // Show weight trend chart
      await this.showWeightTrend(fromId, toId, relType);

    } catch (error) {
      console.error('Error fetching relationship history:', error);
      this.historyContent.html('')
        .append('div')
        .attr('class', 'alert alert-danger')
        .text('Failed to load relationship history');
    }
  }

  /**
   * Display weight trend chart
   */
  async showWeightTrend(fromId, toId, relType) {
    try {
      const response = await fetch(`/api/relationships/temporal/${fromId}/${toId}/${relType}/trend`);
      const data = await response.json();

      if (!data.trend || !data.trend.found) {
        return;
      }

      const trendDiv = this.historyContent.append('div')
        .attr('class', 'weight-trend')
        .style('margin-top', '20px')
        .style('padding', '15px')
        .style('background', 'white')
        .style('border', '1px solid #dee2e6')
        .style('border-radius', '4px');

      trendDiv.append('h6')
        .text('Weight Trend Analysis');

      // Statistics
      const stats = data.trend.statistics;
      trendDiv.append('div')
        .style('font-size', '12px')
        .style('margin-bottom', '10px')
        .html(`
          <strong>Trend:</strong>
          <span class="badge badge-${stats.trend === 'increasing' ? 'success' : stats.trend === 'decreasing' ? 'warning' : 'secondary'}">
            ${stats.trend.toUpperCase()}
          </span><br>
          <strong>Average:</strong> ${stats.average.toFixed(2)} |
          <strong>Min:</strong> ${stats.minimum.toFixed(2)} |
          <strong>Max:</strong> ${stats.maximum.toFixed(2)}<br>
          <strong>Data Points:</strong> ${stats.dataPoints}
        `);

      // Simple sparkline chart
      this.renderSparkline(trendDiv, data.trend.history);

    } catch (error) {
      console.error('Error fetching weight trend:', error);
    }
  }

  /**
   * Render simple sparkline chart for weight history
   */
  renderSparkline(container, history) {
    const width = 400;
    const height = 60;
    const margin = { top: 5, right: 5, bottom: 5, left: 5 };

    const svg = container.append('svg')
      .attr('width', width)
      .attr('height', height);

    const weights = history.map(h => h.weight);
    const xScale = d3.scaleLinear()
      .domain([0, weights.length - 1])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([Math.min(...weights), Math.max(...weights)])
      .range([height - margin.bottom, margin.top]);

    const line = d3.line()
      .x((d, i) => xScale(i))
      .y(d => yScale(d))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(weights)
      .attr('fill', 'none')
      .attr('stroke', '#007bff')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Add dots
    svg.selectAll('circle')
      .data(weights)
      .enter()
      .append('circle')
      .attr('cx', (d, i) => xScale(i))
      .attr('cy', d => yScale(d))
      .attr('r', 3)
      .attr('fill', '#007bff');
  }

  /**
   * Format date for display
   */
  formatDate(date) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Destroy the timeline component
   */
  destroy() {
    this.container.html('');
    this.initialized = false;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TemporalTimeline;
}
