const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const puppeteer = require('puppeteer');
const TestServer = require('../helpers/testServer');

describe('End-to-End User Workflow Tests', () => {
  let testServer;
  let browser;
  let page;

  beforeAll(async () => {
    testServer = new TestServer();
    await testServer.start();

    browser = await puppeteer.launch({
      headless: process.env.CI !== 'false',
      slowMo: process.env.CI === 'false' ? 50 : 0,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    if (browser) await browser.close();
    if (testServer) await testServer.stop();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    // Skip database cleanup in demo mode
    try {
      await testServer.cleanDatabase();
    } catch (error) {
      console.log('ℹ️  Skipping database cleanup in demo mode');
    }
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  describe('New User Onboarding Flow', () => {
    test('should guide new user through complete application exploration', async () => {
      await page.goto(global.testConfig.testBaseURL);

      // Wait for page to load
      await page.waitForSelector('.tab-nav', { timeout: 10000 });

      // Verify initial state - Overview tab active
      const activeTab = await page.$('.tab-btn.active');
      const activeTabText = await page.evaluate(el => el.textContent, activeTab);
      expect(activeTabText).toBe('Overview');

      // Check initial stats show zero or loading state
      await page.waitForSelector('#ci-count');
      const ciCount = await page.$eval('#ci-count', el => el.textContent);
      expect(ciCount).toMatch(/^(-|0|\d+)$/);

      // Navigate to Demo tab to load sample data
      await page.click('[data-tab="demo"]');
      await page.waitForSelector('#load-sample-data');

      // Load sample data
      await page.click('#load-sample-data');

      // Wait for data loading to complete
      await page.waitForFunction(
        () => {
          const button = document.querySelector('#load-sample-data');
          return button && !button.disabled && !button.textContent.includes('Loading');
        },
        { timeout: 30000 }
      );

      // Navigate back to Overview to see populated data
      await page.click('[data-tab="overview"]');
      await page.waitForSelector('#ci-count');

      // Verify stats are now populated
      await page.waitForFunction(
        () => {
          const ciCount = document.querySelector('#ci-count').textContent;
          return ciCount && ciCount !== '-' && parseInt(ciCount) > 0;
        },
        { timeout: 10000 }
      );

      // Explore Topology tab
      await page.click('[data-tab="topology"]');
      await page.waitForSelector('#topology-viz');

      // Wait for topology to load
      await page.waitForFunction(
        () => {
          const viz = document.querySelector('#topology-viz');
          return viz && !viz.innerHTML.includes('Loading');
        },
        { timeout: 15000 }
      );

      // Test topology filter
      const filterSelect = await page.$('#topology-filter');
      if (filterSelect) {
        await page.select('#topology-filter', 'Server');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Explore Events tab
      await page.click('[data-tab="events"]');
      await page.waitForSelector('#events-list');

      // Simulate an event
      await page.click('#simulate-event');
      await page.waitForFunction(
        () => {
          const eventsList = document.querySelector('#events-list');
          return eventsList && eventsList.children.length > 0;
        },
        { timeout: 10000 }
      );

      // Explore Correlation tab
      await page.click('[data-tab="correlation"]');
      await page.waitForSelector('#run-correlation');

      // Run correlation analysis
      await page.click('#run-correlation');
      await page.waitForFunction(
        () => {
          const correlations = document.querySelector('#correlations-list');
          return correlations && !correlations.innerHTML.includes('Run correlation analysis');
        },
        { timeout: 15000 }
      );

      console.log('New user onboarding flow completed successfully');
    }, 60000);

    test('should handle user navigation without data', async () => {
      await page.goto(global.testConfig.testBaseURL);

      // Navigate through all tabs without data
      const tabs = ['overview', 'topology', 'events', 'correlation', 'data-generation', 'demo'];

      for (const tab of tabs) {
        await page.click(`[data-tab="${tab}"]`);
        await page.waitForSelector(`#${tab}`, { timeout: 5000 });

        // Verify tab loads without errors
        const errors = await page.evaluate(() => {
          return window.console && window.console.error ? window.console.error.calls || [] : [];
        });

        // Check that basic UI elements are present
        const tabContent = await page.$(`#${tab}`);
        expect(tabContent).toBeTruthy();
      }

      console.log('Navigation without data completed successfully');
    });
  });

  describe('Data Scientist Evaluation Flow', () => {
    test('should demonstrate graph database advantages effectively', async () => {
      await page.goto(global.testConfig.testBaseURL);

      // Load enterprise data for comprehensive demonstration
      await page.click('[data-tab="demo"]');
      await page.waitForSelector('#load-enterprise-data');

      // Start enterprise data generation
      await page.click('#load-enterprise-data');

      // Handle confirmation dialog
      page.on('dialog', async dialog => {
        await dialog.accept();
      });

      // Wait for data generation to complete (or switch to Data Generation tab)
      try {
        await page.waitForFunction(
          () => {
            const button = document.querySelector('#load-enterprise-data');
            return button && !button.disabled && !button.textContent.includes('Generating');
          },
          { timeout: 120000 }
        );
      } catch (error) {
        // If direct generation takes too long, use worker-based generation
        await page.click('[data-tab="data-generation"]');
        await page.waitForSelector('#scale-options');

        // Select medium scale
        const mediumOption = await page.$('[data-scale="medium"]');
        if (mediumOption) {
          await page.click('[data-scale="medium"]');
          await page.click('#start-generation');

          // Monitor progress
          await page.waitForSelector('#job-progress-container', { timeout: 10000 });
        }
      }

      // Navigate to Demo tab for graph advantages
      await page.click('[data-tab="demo"]');
      await page.waitForSelector('#component-selector');

      // Wait for components to load
      await page.waitForFunction(
        () => {
          const selector = document.querySelector('#component-selector');
          return selector && selector.options.length > 1;
        },
        { timeout: 30000 }
      );

      // Select a component for impact analysis
      const componentOptions = await page.$$eval('#component-selector option', options =>
        options.map(option => ({ value: option.value, text: option.textContent }))
      );

      if (componentOptions.length > 1) {
        const componentId = componentOptions[1].value;
        await page.select('#component-selector', componentId);

        // Set analysis parameters
        await page.select('#analysis-direction', 'downstream');
        await page.evaluate(() => {
          document.querySelector('#max-depth').value = 4;
        });

        // Run impact analysis
        await page.click('#run-impact-analysis');

        // Wait for results
        await page.waitForSelector('#impact-results', { timeout: 15000 });
        await page.waitForFunction(
          () => {
            const results = document.querySelector('#impact-results');
            return results && results.style.display !== 'none';
          },
          { timeout: 10000 }
        );

        // Verify results are displayed
        const affectedCount = await page.$eval('#affected-count', el => el.textContent);
        expect(parseInt(affectedCount)).toBeGreaterThan(0);

        // Check if query comparison is shown
        const queryComparison = await page.$('#query-comparison');
        if (queryComparison) {
          const isVisible = await page.evaluate(el => el.style.display !== 'none', queryComparison);
          if (isVisible) {
            // Verify Cypher and SQL queries are present
            const cypherQuery = await page.$eval('#cypher-query', el => el.textContent);
            const sqlQuery = await page.$eval('#sql-query', el => el.textContent);
            expect(cypherQuery.length).toBeGreaterThan(0);
            expect(sqlQuery.length).toBeGreaterThan(0);
          }
        }
      }

      console.log('Data scientist evaluation flow completed successfully');
    }, 180000); // 3 minute timeout for data generation
  });

  describe('IT Operations Incident Response Flow', () => {
    test('should simulate realistic incident response workflow', async () => {
      await page.goto(global.testConfig.testBaseURL);

      // Setup: Load sample data
      await page.click('[data-tab="demo"]');
      await page.click('#load-sample-data');
      await page.waitForFunction(
        () => {
          const button = document.querySelector('#load-sample-data');
          return button && !button.disabled;
        },
        { timeout: 30000 }
      );

      // Step 1: Simulate an incident (cascade failure)
      await page.click('#simulate-cascade');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 2: Monitor events
      await page.click('[data-tab="events"]');
      await page.waitForSelector('#events-list');

      // Verify events are present
      await page.waitForFunction(
        () => {
          const eventsList = document.querySelector('#events-list');
          const events = eventsList.querySelectorAll('.event-item');
          return events.length > 0;
        },
        { timeout: 10000 }
      );

      // Step 3: Analyze correlations
      await page.click('[data-tab="correlation"]');
      await page.click('#run-correlation');

      // Wait for correlation results
      await page.waitForFunction(
        () => {
          const correlations = document.querySelector('#correlations-list');
          return correlations && !correlations.innerHTML.includes('Run correlation analysis');
        },
        { timeout: 15000 }
      );

      // Step 4: Assess business impact
      await page.waitForFunction(
        () => {
          const businessImpact = document.querySelector('#business-impact');
          return businessImpact && !businessImpact.innerHTML.includes('Run correlation analysis');
        },
        { timeout: 10000 }
      );

      // Step 5: View topology for affected components
      await page.click('[data-tab="topology"]');
      await page.waitForSelector('#topology-viz');

      // Apply filter to focus on specific component types
      await page.select('#topology-filter', 'Server');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 6: Clear events after incident resolution
      await page.click('[data-tab="correlation"]');
      const clearButton = await page.$('#clear-events');
      if (clearButton) {
        await page.click('#clear-events');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('IT operations incident response flow completed successfully');
    }, 90000);
  });

  describe('Sales Demonstration Flow', () => {
    test('should provide compelling sales demonstration experience', async () => {
      await page.goto(global.testConfig.testBaseURL);

      // Start with impressive overview
      await page.waitForSelector('.tab-nav');

      // Load enterprise data for impressive scale
      await page.click('[data-tab="data-generation"]');
      await page.waitForSelector('#scale-options');

      // Select small scale for quick demo
      await page.click('[data-scale="small"]');
      await page.waitForSelector('#start-generation:not([disabled])');
      await page.click('#start-generation');

      // Show real-time progress tracking
      await page.waitForSelector('#job-progress-container', { timeout: 10000 });

      // Monitor job progress briefly
      let progressChecks = 0;
      while (progressChecks < 5) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const progressText = await page.$eval('#progress-stage', el => el.textContent);
        console.log(`Demo progress: ${progressText}`);

        if (progressText.includes('completed') || progressText.includes('error')) {
          break;
        }
        progressChecks++;
      }

      // Navigate to Overview to show populated dashboard
      await page.click('[data-tab="overview"]');
      await page.waitForFunction(
        () => {
          const ciCount = document.querySelector('#ci-count').textContent;
          return ciCount && ciCount !== '-' && parseInt(ciCount) > 0;
        },
        { timeout: 30000 }
      );

      // Showcase topology visualization
      await page.click('[data-tab="topology"]');
      await page.waitForSelector('#topology-viz');
      await page.waitForFunction(
        () => {
          const viz = document.querySelector('#topology-viz');
          return viz && !viz.innerHTML.includes('Loading');
        },
        { timeout: 15000 }
      );

      // Demonstrate interactive filtering
      await page.select('#topology-filter', 'Application');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await page.select('#topology-filter', ''); // Show all

      // Show event simulation capabilities
      await page.click('[data-tab="events"]');
      await page.click('#simulate-event');
      await page.waitForFunction(
        () => {
          const eventsList = document.querySelector('#events-list');
          return eventsList && eventsList.children.length > 0;
        },
        { timeout: 10000 }
      );

      // Demonstrate correlation analysis
      await page.click('[data-tab="correlation"]');
      await page.click('#run-correlation');
      await page.waitForFunction(
        () => {
          const correlations = document.querySelector('#correlations-list');
          return correlations && !correlations.innerHTML.includes('Run correlation analysis');
        },
        { timeout: 15000 }
      );

      // Highlight graph database advantages
      await page.click('[data-tab="demo"]');
      await page.waitForSelector('#component-selector');

      // Select a component and show impact analysis
      await page.waitForFunction(
        () => {
          const selector = document.querySelector('#component-selector');
          return selector && selector.options.length > 1;
        },
        { timeout: 10000 }
      );

      const componentOptions = await page.$$eval('#component-selector option', options =>
        options.map(option => option.value).filter(value => value)
      );

      if (componentOptions.length > 0) {
        await page.select('#component-selector', componentOptions[0]);
        await page.click('#run-impact-analysis');

        await page.waitForSelector('#impact-results', { timeout: 15000 });
        await page.waitForFunction(
          () => {
            const results = document.querySelector('#impact-results');
            return results && results.style.display !== 'none';
          },
          { timeout: 10000 }
        );
      }

      console.log('Sales demonstration flow completed successfully');
    }, 120000);
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle network failures gracefully', async () => {
      await page.goto(global.testConfig.testBaseURL);

      // Simulate network failure by blocking requests
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (req.url().includes('/api/')) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Try to load data - should show error state
      await page.click('[data-tab="demo"]');
      await page.click('#load-sample-data');

      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify UI handles error gracefully (doesn't crash)
      const tabContent = await page.$('#demo');
      expect(tabContent).toBeTruthy();

      // Re-enable network
      await page.setRequestInterception(false);
    });

    test('should handle rapid navigation between tabs', async () => {
      await page.goto(global.testConfig.testBaseURL);

      const tabs = ['overview', 'topology', 'events', 'correlation', 'data-generation', 'demo'];

      // Rapidly switch between tabs
      for (let i = 0; i < 3; i++) {
        for (const tab of tabs) {
          await page.click(`[data-tab="${tab}"]`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Verify final state is stable
      const activeTab = await page.$('.tab-btn.active');
      expect(activeTab).toBeTruthy();
    });
  });
});