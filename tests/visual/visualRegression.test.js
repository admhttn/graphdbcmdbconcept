const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');
const TestServer = require('../helpers/testServer');

describe('Visual Regression Tests', () => {
  let testServer;
  let browser;
  let page;
  const screenshotsDir = path.join(__dirname, 'screenshots');
  const baselineDir = path.join(screenshotsDir, 'baseline');
  const currentDir = path.join(screenshotsDir, 'current');
  const diffDir = path.join(screenshotsDir, 'diff');

  beforeAll(async () => {
    // Ensure directories exist
    await fs.mkdir(screenshotsDir, { recursive: true });
    await fs.mkdir(baselineDir, { recursive: true });
    await fs.mkdir(currentDir, { recursive: true });
    await fs.mkdir(diffDir, { recursive: true });

    testServer = new TestServer();
    await testServer.start();

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  });

  afterAll(async () => {
    if (browser) await browser.close();
    if (testServer) await testServer.stop();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await testServer.cleanDatabase();
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  const takeScreenshot = async (name, selector = null) => {
    const fileName = `${name}.png`;
    const currentPath = path.join(currentDir, fileName);

    if (selector) {
      const element = await page.$(selector);
      if (element) {
        await element.screenshot({ path: currentPath });
      } else {
        throw new Error(`Element ${selector} not found for screenshot ${name}`);
      }
    } else {
      await page.screenshot({ path: currentPath, fullPage: true });
    }

    return currentPath;
  };

  const compareScreenshots = async (name) => {
    const baselinePath = path.join(baselineDir, `${name}.png`);
    const currentPath = path.join(currentDir, `${name}.png`);
    const diffPath = path.join(diffDir, `${name}.png`);

    try {
      await fs.access(baselinePath);
    } catch (error) {
      // Baseline doesn't exist, copy current as baseline
      await fs.copyFile(currentPath, baselinePath);
      console.log(`Created baseline screenshot for ${name}`);
      return { match: true, diffPixels: 0 };
    }

    const baseline = PNG.sync.read(await fs.readFile(baselinePath));
    const current = PNG.sync.read(await fs.readFile(currentPath));

    const { width, height } = baseline;
    const diff = new PNG({ width, height });

    const diffPixels = pixelmatch(
      baseline.data,
      current.data,
      diff.data,
      width,
      height,
      { threshold: 0.1 }
    );

    const diffPercentage = (diffPixels / (width * height)) * 100;

    if (diffPercentage > 0.5) { // 0.5% threshold
      await fs.writeFile(diffPath, PNG.sync.write(diff));
      return { match: false, diffPixels, diffPercentage };
    }

    return { match: true, diffPixels, diffPercentage };
  };

  describe('Tab Layout Consistency', () => {
    test('should maintain consistent overview tab layout', async () => {
      await page.goto(global.testConfig.testBaseURL);
      await page.waitForSelector('.tab-nav');

      // Take screenshot of overview tab
      await takeScreenshot('overview-tab-empty');

      // Load sample data and take another screenshot
      await page.click('[data-tab="demo"]');
      await page.click('#load-sample-data');
      await page.waitForFunction(
        () => {
          const button = document.querySelector('#load-sample-data');
          return button && !button.disabled;
        },
        { timeout: 30000 }
      );

      await page.click('[data-tab="overview"]');
      await page.waitForFunction(
        () => {
          const ciCount = document.querySelector('#ci-count').textContent;
          return ciCount && ciCount !== '-';
        },
        { timeout: 10000 }
      );

      await takeScreenshot('overview-tab-populated');

      // Compare screenshots
      const emptyComparison = await compareScreenshots('overview-tab-empty');
      const populatedComparison = await compareScreenshots('overview-tab-populated');

      expect(emptyComparison.match).toBe(true);
      expect(populatedComparison.match).toBe(true);
    }, 60000);

    test('should maintain consistent topology tab layout', async () => {
      await page.goto(global.testConfig.testBaseURL);

      // Load data first
      await page.click('[data-tab="demo"]');
      await page.click('#load-sample-data');
      await page.waitForFunction(
        () => {
          const button = document.querySelector('#load-sample-data');
          return button && !button.disabled;
        },
        { timeout: 30000 }
      );

      // Navigate to topology tab
      await page.click('[data-tab="topology"]');
      await page.waitForSelector('#topology-viz');
      await page.waitForFunction(
        () => {
          const viz = document.querySelector('#topology-viz');
          return viz && !viz.innerHTML.includes('Loading');
        },
        { timeout: 15000 }
      );

      await takeScreenshot('topology-tab-full');

      // Test with filter applied
      await page.select('#topology-filter', 'Server');
      await new Promise(resolve => setTimeout(resolve, 2000));
      await takeScreenshot('topology-tab-filtered');

      const fullComparison = await compareScreenshots('topology-tab-full');
      const filteredComparison = await compareScreenshots('topology-tab-filtered');

      expect(fullComparison.match).toBe(true);
      expect(filteredComparison.match).toBe(true);
    }, 60000);

    test('should maintain consistent events tab layout', async () => {
      await page.goto(global.testConfig.testBaseURL);

      // Navigate to events tab
      await page.click('[data-tab="events"]');
      await page.waitForSelector('#events-list');

      await takeScreenshot('events-tab-empty');

      // Simulate some events
      await page.click('#simulate-event');
      await page.waitForFunction(
        () => {
          const eventsList = document.querySelector('#events-list');
          return eventsList && eventsList.children.length > 0;
        },
        { timeout: 10000 }
      );

      await takeScreenshot('events-tab-populated');

      // Test severity filter
      await page.select('#severity-filter', 'CRITICAL');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await takeScreenshot('events-tab-filtered');

      const emptyComparison = await compareScreenshots('events-tab-empty');
      const populatedComparison = await compareScreenshots('events-tab-populated');
      const filteredComparison = await compareScreenshots('events-tab-filtered');

      expect(emptyComparison.match).toBe(true);
      expect(populatedComparison.match).toBe(true);
      expect(filteredComparison.match).toBe(true);
    });

    test('should maintain consistent correlation tab layout', async () => {
      await page.goto(global.testConfig.testBaseURL);

      // Navigate to correlation tab
      await page.click('[data-tab="correlation"]');
      await page.waitForSelector('#run-correlation');

      await takeScreenshot('correlation-tab-initial');

      // Run correlation analysis
      await page.click('#run-correlation');
      await page.waitForFunction(
        () => {
          const correlations = document.querySelector('#correlations-list');
          return correlations && !correlations.innerHTML.includes('Run correlation analysis');
        },
        { timeout: 15000 }
      );

      await takeScreenshot('correlation-tab-analyzed');

      const initialComparison = await compareScreenshots('correlation-tab-initial');
      const analyzedComparison = await compareScreenshots('correlation-tab-analyzed');

      expect(initialComparison.match).toBe(true);
      expect(analyzedComparison.match).toBe(true);
    });

    test('should maintain consistent data generation tab layout', async () => {
      await page.goto(global.testConfig.testBaseURL);

      // Navigate to data generation tab
      await page.click('[data-tab="data-generation"]');
      await page.waitForSelector('#scale-options');

      await takeScreenshot('data-generation-tab-initial');

      // Select a scale option
      await page.click('[data-scale="small"]');
      await page.waitForSelector('#start-generation:not([disabled])');

      await takeScreenshot('data-generation-tab-selected');

      const initialComparison = await compareScreenshots('data-generation-tab-initial');
      const selectedComparison = await compareScreenshots('data-generation-tab-selected');

      expect(initialComparison.match).toBe(true);
      expect(selectedComparison.match).toBe(true);
    });

    test('should maintain consistent demo tab layout', async () => {
      await page.goto(global.testConfig.testBaseURL);

      // Navigate to demo tab
      await page.click('[data-tab="demo"]');
      await page.waitForSelector('#load-sample-data');

      await takeScreenshot('demo-tab-initial');

      // Load sample data to populate component selector
      await page.click('#load-sample-data');
      await page.waitForFunction(
        () => {
          const button = document.querySelector('#load-sample-data');
          return button && !button.disabled;
        },
        { timeout: 30000 }
      );

      await page.waitForFunction(
        () => {
          const selector = document.querySelector('#component-selector');
          return selector && selector.options.length > 1;
        },
        { timeout: 10000 }
      );

      await takeScreenshot('demo-tab-populated');

      const initialComparison = await compareScreenshots('demo-tab-initial');
      const populatedComparison = await compareScreenshots('demo-tab-populated');

      expect(initialComparison.match).toBe(true);
      expect(populatedComparison.match).toBe(true);
    }, 60000);
  });

  describe('Component Rendering Verification', () => {
    test('should render stats cards consistently', async () => {
      await page.goto(global.testConfig.testBaseURL);
      await page.waitForSelector('.stats-grid');

      await takeScreenshot('stats-grid', '.stats-grid');

      const comparison = await compareScreenshots('stats-grid');
      expect(comparison.match).toBe(true);
    });

    test('should render navigation tabs consistently', async () => {
      await page.goto(global.testConfig.testBaseURL);
      await page.waitForSelector('.tab-nav');

      await takeScreenshot('tab-navigation', '.tab-nav');

      const comparison = await compareScreenshots('tab-navigation');
      expect(comparison.match).toBe(true);
    });

    test('should render toolbar elements consistently', async () => {
      await page.goto(global.testConfig.testBaseURL);

      // Test topology toolbar
      await page.click('[data-tab="topology"]');
      await page.waitForSelector('.toolbar');
      await takeScreenshot('topology-toolbar', '.toolbar');

      // Test events toolbar
      await page.click('[data-tab="events"]');
      await page.waitForSelector('.toolbar');
      await takeScreenshot('events-toolbar', '.toolbar');

      // Test correlation toolbar
      await page.click('[data-tab="correlation"]');
      await page.waitForSelector('.toolbar');
      await takeScreenshot('correlation-toolbar', '.toolbar');

      const topologyComparison = await compareScreenshots('topology-toolbar');
      const eventsComparison = await compareScreenshots('events-toolbar');
      const correlationComparison = await compareScreenshots('correlation-toolbar');

      expect(topologyComparison.match).toBe(true);
      expect(eventsComparison.match).toBe(true);
      expect(correlationComparison.match).toBe(true);
    });
  });

  describe('Interactive Element States', () => {
    test('should maintain consistent button states', async () => {
      await page.goto(global.testConfig.testBaseURL);

      await page.click('[data-tab="demo"]');
      await page.waitForSelector('#load-sample-data');

      // Test button default state
      await takeScreenshot('button-default', '#load-sample-data');

      // Test button hover state
      await page.hover('#load-sample-data');
      await takeScreenshot('button-hover', '#load-sample-data');

      const defaultComparison = await compareScreenshots('button-default');
      const hoverComparison = await compareScreenshots('button-hover');

      expect(defaultComparison.match).toBe(true);
      expect(hoverComparison.match).toBe(true);
    });

    test('should maintain consistent form element states', async () => {
      await page.goto(global.testConfig.testBaseURL);

      await page.click('[data-tab="topology"]');
      await page.waitForSelector('#topology-filter');

      // Test select default state
      await takeScreenshot('select-default', '#topology-filter');

      // Test select focused state
      await page.focus('#topology-filter');
      await takeScreenshot('select-focused', '#topology-filter');

      const defaultComparison = await compareScreenshots('select-default');
      const focusedComparison = await compareScreenshots('select-focused');

      expect(defaultComparison.match).toBe(true);
      expect(focusedComparison.match).toBe(true);
    });
  });

  describe('Responsive Layout Verification', () => {
    test('should maintain layout on different screen sizes', async () => {
      await page.goto(global.testConfig.testBaseURL);

      // Test desktop layout
      await page.setViewport({ width: 1280, height: 720 });
      await page.waitForSelector('.tab-nav');
      await takeScreenshot('layout-desktop');

      // Test tablet layout
      await page.setViewport({ width: 768, height: 1024 });
      await new Promise(resolve => setTimeout(resolve, 1000));
      await takeScreenshot('layout-tablet');

      // Test mobile layout
      await page.setViewport({ width: 375, height: 667 });
      await new Promise(resolve => setTimeout(resolve, 1000));
      await takeScreenshot('layout-mobile');

      const desktopComparison = await compareScreenshots('layout-desktop');
      const tabletComparison = await compareScreenshots('layout-tablet');
      const mobileComparison = await compareScreenshots('layout-mobile');

      expect(desktopComparison.match).toBe(true);
      expect(tabletComparison.match).toBe(true);
      expect(mobileComparison.match).toBe(true);
    });
  });

  describe('Error State Visualization', () => {
    test('should render error states consistently', async () => {
      await page.goto(global.testConfig.testBaseURL);

      // Simulate network error by intercepting requests
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (req.url().includes('/api/cmdb/items')) {
          req.respond({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal Server Error' })
          });
        } else {
          req.continue();
        }
      });

      // Try to load data and capture error state
      await page.click('[data-tab="demo"]');
      await page.click('#load-sample-data');
      await new Promise(resolve => setTimeout(resolve, 3000));

      await takeScreenshot('error-state');

      await page.setRequestInterception(false);

      const errorComparison = await compareScreenshots('error-state');
      expect(errorComparison.match).toBe(true);
    });
  });
});