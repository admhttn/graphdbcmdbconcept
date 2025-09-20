// Graph Database Advantages Demo Module
class GraphAdvantagesDemo {
    constructor() {
        this.currentAnalysis = null;
        this.demoScenarios = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadDemoScenarios();
        this.loadComponentList();
    }

    bindEvents() {
        // Depth slider real-time update
        const depthSlider = document.getElementById('max-depth');
        const depthValue = document.getElementById('depth-value');
        if (depthSlider && depthValue) {
            depthSlider.addEventListener('input', (e) => {
                depthValue.textContent = e.target.value;
            });
        }

        // Run impact analysis button
        const runButton = document.getElementById('run-impact-analysis');
        if (runButton) {
            runButton.addEventListener('click', () => {
                this.runImpactAnalysis();
            });
        }

        // Component selector change
        const componentSelector = document.getElementById('component-selector');
        if (componentSelector) {
            componentSelector.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.enableAnalysisButton();
                } else {
                    this.disableAnalysisButton();
                }
            });
        }
    }

    async loadDemoScenarios() {
        try {
            window.logInfo('Loading demo scenarios');
            const response = await fetch('/api/demo/graph-advantage-examples');
            const data = await response.json();
            this.demoScenarios = data.demoScenarios;
            window.logSuccess(`Loaded ${this.demoScenarios.length} demo scenarios`, { scenarios: this.demoScenarios });
            this.renderDemoScenarios();
        } catch (error) {
            window.logError('Failed to load demo scenarios', { error: error.message });
            console.error('Error loading demo scenarios:', error);
            this.showError('Failed to load demo scenarios');
        }
    }

    async loadComponentList() {
        try {
            window.logInfo('Loading component list');
            const response = await fetch('/api/cmdb/items');
            const components = await response.json();
            window.logSuccess(`Loaded ${components.length} components`, { components: components.slice(0, 5) });
            this.renderComponentSelector(components);
        } catch (error) {
            window.logError('Failed to load component list', { error: error.message });
            console.error('Error loading components:', error);
            this.showError('Failed to load component list');
        }
    }

    renderDemoScenarios() {
        const grid = document.getElementById('scenario-grid');
        if (!grid) return;

        grid.innerHTML = '';

        this.demoScenarios.forEach(scenario => {
            const scenarioCard = document.createElement('div');
            scenarioCard.className = 'scenario-card';
            scenarioCard.innerHTML = `
                <h4>${scenario.title}</h4>
                <p class="scenario-description">${scenario.description}</p>
                <div class="scenario-metrics">
                    <div class="metric">
                        <span class="metric-label">Expected Hops:</span>
                        <span class="metric-value">${scenario.expectedHops}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Revenue at Risk:</span>
                        <span class="metric-value revenue">${scenario.revenueAtRisk}</span>
                    </div>
                </div>
                <div class="scenario-advantage">
                    <strong>Graph Advantage:</strong> ${scenario.graphAdvantage}
                </div>
                <button class="scenario-btn" data-scenario-id="${scenario.id}" data-component-id="${scenario.componentId}">
                    Run This Scenario
                </button>
            `;

            // Add click handler for scenario button
            const button = scenarioCard.querySelector('.scenario-btn');
            button.addEventListener('click', () => {
                this.runScenario(scenario);
            });

            grid.appendChild(scenarioCard);
        });
    }

    renderComponentSelector(components) {
        const selector = document.getElementById('component-selector');
        if (!selector) return;

        // Clear existing options except the first one
        selector.innerHTML = '<option value="">Select a component...</option>';

        // Group components by type for better organization
        const groupedComponents = {};
        components.forEach(component => {
            const type = component.type || 'Other';
            if (!groupedComponents[type]) {
                groupedComponents[type] = [];
            }
            groupedComponents[type].push(component);
        });

        // Add optgroups for each type
        Object.keys(groupedComponents).sort().forEach(type => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = type;

            groupedComponents[type]
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach(component => {
                    const option = document.createElement('option');
                    option.value = component.id;
                    option.textContent = `${component.name} (${component.criticality || 'N/A'})`;
                    optgroup.appendChild(option);
                });

            selector.appendChild(optgroup);
        });
    }

    async runScenario(scenario) {
        // Set the component selector to the scenario's component
        const componentSelector = document.getElementById('component-selector');
        if (componentSelector) {
            componentSelector.value = scenario.componentId;
        }

        // Set appropriate depth for the scenario
        const depthSlider = document.getElementById('max-depth');
        const depthValue = document.getElementById('depth-value');
        if (depthSlider && depthValue) {
            depthSlider.value = scenario.expectedHops;
            depthValue.textContent = scenario.expectedHops;
        }

        // Run the analysis
        await this.runImpactAnalysis(scenario);
    }

    async runImpactAnalysis(scenario = null) {
        const componentId = document.getElementById('component-selector').value;
        const direction = document.getElementById('analysis-direction').value;
        const maxDepth = document.getElementById('max-depth').value;

        window.logInfo('Starting impact analysis', {
            componentId,
            direction,
            maxDepth,
            scenario: scenario?.title || 'Custom Analysis'
        });

        if (!componentId) {
            window.logWarning('No component selected for analysis');
            this.showError('Please select a component first');
            return;
        }

        this.showLoading();

        try {
            // Run impact analysis
            window.logInfo(`Fetching impact analysis for component: ${componentId}`);
            const analysisUrl = `/api/demo/impact-analysis/${componentId}?maxDepth=${maxDepth}&direction=${direction}`;
            const analysisResponse = await fetch(analysisUrl);

            window.logDebug('Impact analysis response received', {
                status: analysisResponse.status,
                statusText: analysisResponse.statusText,
                url: analysisUrl
            });

            if (!analysisResponse.ok) {
                throw new Error(`HTTP ${analysisResponse.status}: ${analysisResponse.statusText}`);
            }

            const analysisData = await analysisResponse.json();
            window.logSuccess('Impact analysis data parsed', {
                affectedComponents: analysisData.impactSummary?.totalAffectedComponents,
                executionTime: analysisData.impactSummary?.executionTimeMs
            });

            // Get query comparison
            window.logInfo('Fetching query comparison data');
            const comparisonUrl = `/api/demo/query-comparison/${componentId}?maxDepth=${maxDepth}`;
            const comparisonResponse = await fetch(comparisonUrl);

            if (!comparisonResponse.ok) {
                throw new Error(`Query comparison failed: HTTP ${comparisonResponse.status}`);
            }

            const comparisonData = await comparisonResponse.json();
            window.logSuccess('Query comparison data received', {
                cypherLines: comparisonData.cypher?.linesOfCode,
                sqlLines: comparisonData.sql?.linesOfCode
            });

            // Store current analysis data
            this.currentAnalysis = {
                ...analysisData,
                comparison: comparisonData,
                scenario: scenario
            };

            window.logInfo('Rendering analysis results');

            // Render results
            this.renderAnalysisResults();
            this.renderQueryComparison();

            // Show results panels
            document.getElementById('impact-results').style.display = 'block';
            document.getElementById('query-comparison').style.display = 'block';

            // Scroll to results
            document.getElementById('impact-results').scrollIntoView({ behavior: 'smooth' });

            window.logSuccess('Impact analysis completed successfully');

        } catch (error) {
            window.logError('Impact analysis failed', {
                error: error.message,
                stack: error.stack,
                componentId,
                direction,
                maxDepth
            });
            console.error('Error running impact analysis:', error);
            this.showError('Failed to run impact analysis: ' + error.message);
        }
    }

    renderAnalysisResults() {
        if (!this.currentAnalysis) return;

        const { impactSummary, impactDetails, graphAdvantage, scenario } = this.currentAnalysis;

        // Update summary cards
        document.getElementById('affected-count').textContent = impactSummary.totalAffectedComponents;
        document.getElementById('critical-impacts').textContent = impactSummary.criticalImpacts;
        document.getElementById('revenue-at-risk').textContent =
            `$${impactSummary.totalHourlyRevenueAtRisk.toLocaleString()}/hour`;
        document.getElementById('query-time').textContent = `${impactSummary.executionTimeMs}ms`;

        // Render dependency chains
        this.renderDependencyChains(impactDetails);

        // Render graph advantage highlight
        this.renderGraphAdvantage(graphAdvantage, scenario);
    }

    renderDependencyChains(impactDetails) {
        const container = document.getElementById('dependency-list');
        if (!container) return;

        container.innerHTML = '';

        if (impactDetails.length === 0) {
            container.innerHTML = '<p class="no-dependencies">No dependencies found within the specified depth.</p>';
            return;
        }

        // Group by hop distance for better visualization
        const groupedByHops = {};
        impactDetails.forEach(detail => {
            const hop = detail.hopDistance;
            if (!groupedByHops[hop]) {
                groupedByHops[hop] = [];
            }
            groupedByHops[hop].push(detail);
        });

        Object.keys(groupedByHops).sort((a, b) => parseInt(a) - parseInt(b)).forEach(hop => {
            const hopSection = document.createElement('div');
            hopSection.className = 'hop-section';
            hopSection.innerHTML = `<h5>Hop ${hop} (${groupedByHops[hop].length} components)</h5>`;

            const chainsList = document.createElement('div');
            chainsList.className = 'chains-list';

            groupedByHops[hop]
                .sort((a, b) => b.impactScore - a.impactScore)
                .slice(0, 10) // Show top 10 per hop level
                .forEach(detail => {
                    const chainItem = document.createElement('div');
                    chainItem.className = `dependency-chain ${detail.riskLevel.toLowerCase().replace('_', '-')}`;

                    const pathString = detail.dependencyPath
                        .map(node => node.name)
                        .join(' → ');

                    chainItem.innerHTML = `
                        <div class="chain-header">
                            <span class="component-name">${detail.componentName}</span>
                            <span class="risk-badge ${detail.riskLevel.toLowerCase().replace('_', '-')}">${detail.riskLevel.replace('_', ' ')}</span>
                            <span class="impact-score">Impact: ${detail.impactScore}</span>
                        </div>
                        <div class="dependency-path">${pathString}</div>
                        ${detail.affectedBusinessService ? `
                            <div class="business-impact">
                                <span class="service">Service: ${detail.affectedBusinessService}</span>
                                ${detail.hourlyRevenueAtRisk > 0 ?
                                    `<span class="revenue">Revenue: $${detail.hourlyRevenueAtRisk.toLocaleString()}/hour</span>` : ''
                                }
                            </div>
                        ` : ''}
                    `;

                    chainsList.appendChild(chainItem);
                });

            hopSection.appendChild(chainsList);
            container.appendChild(hopSection);
        });
    }

    renderGraphAdvantage(graphAdvantage, scenario) {
        const container = document.getElementById('advantage-description');
        if (!container) return;

        let advantageText = `
            <div class="advantage-metrics">
                <div class="advantage-metric">
                    <span class="metric-label">Query Complexity:</span>
                    <span class="metric-value">${graphAdvantage.cypherComplexity}</span>
                </div>
                <div class="advantage-metric">
                    <span class="metric-label">SQL Equivalent:</span>
                    <span class="metric-value">${graphAdvantage.sqlEquivalent}</span>
                </div>
                <div class="advantage-metric">
                    <span class="metric-label">Performance:</span>
                    <span class="metric-value">${graphAdvantage.performanceAdvantage}</span>
                </div>
            </div>
        `;

        if (scenario) {
            advantageText += `
                <div class="scenario-context">
                    <h5>Scenario Context: ${scenario.title}</h5>
                    <p>${scenario.graphAdvantage}</p>
                </div>
            `;
        }

        container.innerHTML = advantageText;
    }

    renderQueryComparison() {
        if (!this.currentAnalysis || !this.currentAnalysis.comparison) return;

        const { cypher, sql, advantages } = this.currentAnalysis.comparison;

        // Update Cypher panel
        document.getElementById('cypher-lines').textContent = cypher.linesOfCode;
        document.getElementById('cypher-complexity').textContent = cypher.complexity;
        document.getElementById('cypher-query').textContent = cypher.query;

        // Update SQL panel
        document.getElementById('sql-lines').textContent = sql.linesOfCode;
        document.getElementById('sql-complexity').textContent = sql.complexity;
        document.getElementById('sql-query').textContent = sql.query;

        // Render advantages grid
        this.renderAdvantagesGrid(advantages);
    }

    renderAdvantagesGrid(advantages) {
        const container = document.getElementById('advantages-list');
        if (!container) return;

        container.innerHTML = '';

        advantages.forEach(advantage => {
            const advantageItem = document.createElement('div');
            advantageItem.className = 'advantage-item';
            advantageItem.innerHTML = `
                <h5>${advantage.aspect}</h5>
                <div class="advantage-comparison">
                    <div class="cypher-advantage">
                        <span class="tech-label">Cypher:</span>
                        <span class="advantage-text">${advantage.cypher}</span>
                    </div>
                    <div class="sql-disadvantage">
                        <span class="tech-label">SQL:</span>
                        <span class="advantage-text">${advantage.sql}</span>
                    </div>
                </div>
            `;
            container.appendChild(advantageItem);
        });
    }

    enableAnalysisButton() {
        const button = document.getElementById('run-impact-analysis');
        if (button) {
            button.disabled = false;
            button.textContent = 'Run Impact Analysis';
        }
    }

    disableAnalysisButton() {
        const button = document.getElementById('run-impact-analysis');
        if (button) {
            button.disabled = true;
            button.textContent = 'Select Component First';
        }
    }

    showLoading() {
        const button = document.getElementById('run-impact-analysis');
        if (button) {
            button.disabled = true;
            button.textContent = 'Running Analysis...';
        }

        // Hide previous results
        document.getElementById('impact-results').style.display = 'none';
        document.getElementById('query-comparison').style.display = 'none';
    }

    showError(message) {
        // Re-enable button
        const button = document.getElementById('run-impact-analysis');
        if (button) {
            button.disabled = false;
            button.textContent = 'Run Impact Analysis';
        }

        // Show error message (you might want to create a proper error display)
        alert(message);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on a page with the demo elements
    if (document.getElementById('scenario-grid')) {
        window.graphAdvantagesDemo = new GraphAdvantagesDemo();
    }
});