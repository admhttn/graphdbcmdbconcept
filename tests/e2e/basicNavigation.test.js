const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');
const puppeteer = require('puppeteer');

describe('Basic Navigation E2E Tests', () => {
  let browser;
  let page;
  const baseURL = 'http://localhost:3000';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    if (browser) await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  describe('Tab Navigation', () => {
    test('should load main page and show all tabs', async () => {
      await page.goto(baseURL);
      await page.waitForSelector('.tab-nav', { timeout: 10000 });

      // Check all expected tabs are present
      const tabs = await page.$$eval('.tab-btn', elements =>
        elements.map(el => el.dataset.tab)
      );

      expect(tabs).toEqual([
        'overview',
        'topology',
        'events',
        'correlation',
        'data-generation',
        'demo'
      ]);

      console.log('✅ All tabs found:', tabs);
    });

    test('should navigate between tabs successfully', async () => {
      await page.goto(baseURL);
      await page.waitForSelector('.tab-nav');

      const tabs = ['overview', 'topology', 'events', 'correlation', 'data-generation', 'demo'];

      for (const tab of tabs) {
        // Click tab
        await page.click(`[data-tab="${tab}"]`);

        // Wait for tab content to be visible
        await page.waitForSelector(`#${tab}`, { timeout: 5000 });

        // Check active tab
        const activeTab = await page.$eval('.tab-btn.active', el => el.dataset.tab);
        expect(activeTab).toBe(tab);

        // Check tab content is visible
        const isVisible = await page.$eval(`#${tab}`, el =>
          window.getComputedStyle(el).display !== 'none'
        );
        expect(isVisible).toBe(true);

        console.log(`✅ ${tab} tab navigation successful`);
      }
    });

    test('should show correct content in each tab', async () => {
      await page.goto(baseURL);
      await page.waitForSelector('.tab-nav');

      // Demo tab content
      await page.click('[data-tab="demo"]');
      await page.waitForSelector('#load-sample-data');

      const hasSampleDataButton = await page.$('#load-sample-data') !== null;
      expect(hasSampleDataButton).toBe(true);
      console.log('✅ Demo tab has sample data button');

      // Data Generation tab content
      await page.click('[data-tab="data-generation"]');
      await page.waitForSelector('#scale-options');

      const hasScaleOptions = await page.$('#scale-options') !== null;
      expect(hasScaleOptions).toBe(true);
      console.log('✅ Data Generation tab has scale options');

      // Events tab content
      await page.click('[data-tab="events"]');
      await page.waitForSelector('#simulate-event');

      const hasSimulateButton = await page.$('#simulate-event') !== null;
      expect(hasSimulateButton).toBe(true);
      console.log('✅ Events tab has simulate event button');

      // Correlation tab content
      await page.click('[data-tab="correlation"]');
      await page.waitForSelector('#run-correlation');

      const hasCorrelationButton = await page.$('#run-correlation') !== null;
      expect(hasCorrelationButton).toBe(true);
      console.log('✅ Correlation tab has run correlation button');
    });
  });

  describe('Feature Duplication Identification', () => {
    test('should identify duplicate data generation features in UI', async () => {
      await page.goto(baseURL);
      await page.waitForSelector('.tab-nav');

      // Check Demo tab for data generation
      await page.click('[data-tab="demo"]');
      await page.waitForSelector('#demo');

      const demoHasSampleData = await page.$('#load-sample-data') !== null;
      const demoHasEnterpriseData = await page.$('#load-enterprise-data') !== null;

      // Check Data Generation tab for data generation
      await page.click('[data-tab="data-generation"]');
      await page.waitForSelector('#data-generation');

      const dataGenHasScaleOptions = await page.$('#scale-options') !== null;
      const dataGenHasStartGeneration = await page.$('#start-generation') !== null;

      console.log('\n🔍 UI Feature Duplication Analysis:');
      console.log('Demo Tab Data Generation Features:');
      console.log(`  - Sample Data: ${demoHasSampleData ? '✅' : '❌'}`);
      console.log(`  - Enterprise Data: ${demoHasEnterpriseData ? '✅' : '❌'}`);

      console.log('Data Generation Tab Features:');
      console.log(`  - Scale Options: ${dataGenHasScaleOptions ? '✅' : '❌'}`);
      console.log(`  - Start Generation: ${dataGenHasStartGeneration ? '✅' : '❌'}`);

      // Both tabs have data generation capabilities
      expect(demoHasSampleData && dataGenHasScaleOptions).toBe(true);
      console.log('❌ CONFIRMED: Duplicate data generation features across tabs');
    });

    test('should identify duplicate event features in UI', async () => {
      await page.goto(baseURL);
      await page.waitForSelector('.tab-nav');

      // Check Events tab
      await page.click('[data-tab="events"]');
      await page.waitForSelector('#events');

      const eventsHasSimulate = await page.$('#simulate-event') !== null;

      // Check Demo tab
      await page.click('[data-tab="demo"]');
      await page.waitForSelector('#demo');

      const demoHasCascade = await page.$('#simulate-cascade') !== null;

      // Check Correlation tab
      await page.click('[data-tab="correlation"]');
      await page.waitForSelector('#correlation');

      const correlationHasScenarios = await page.$('#demo-scenario-select') !== null;

      console.log('\n🔍 Event Feature Distribution:');
      console.log(`Events Tab - Basic Simulation: ${eventsHasSimulate ? '✅' : '❌'}`);
      console.log(`Demo Tab - Cascade Simulation: ${demoHasCascade ? '✅' : '❌'}`);
      console.log(`Correlation Tab - Scenarios: ${correlationHasScenarios ? '✅' : '❌'}`);

      // Multiple tabs have event simulation
      const hasMultipleEventFeatures = [eventsHasSimulate, demoHasCascade, correlationHasScenarios].filter(Boolean).length > 1;
      expect(hasMultipleEventFeatures).toBe(true);
      console.log('❌ CONFIRMED: Event simulation scattered across multiple tabs');
    });

    test('should identify duplicate clear events features', async () => {
      await page.goto(baseURL);
      await page.waitForSelector('.tab-nav');

      const clearEventsLocations = [];

      // Check Demo tab
      await page.click('[data-tab="demo"]');
      const demoClearEvents = await page.$('#clear-events');
      if (demoClearEvents) clearEventsLocations.push('Demo');

      // Check Correlation tab
      await page.click('[data-tab="correlation"]');
      const correlationClearEvents = await page.$('#clear-events');
      if (correlationClearEvents) clearEventsLocations.push('Correlation');

      console.log('\n🔍 Clear Events Button Locations:');
      clearEventsLocations.forEach(location => {
        console.log(`  - ${location} tab: ✅`);
      });

      expect(clearEventsLocations.length).toBeGreaterThan(1);
      console.log('❌ CONFIRMED: Multiple clear events buttons across tabs');
    });
  });

  describe('Performance and Responsiveness', () => {
    test('should load tabs quickly', async () => {
      await page.goto(baseURL);
      await page.waitForSelector('.tab-nav');

      const tabs = ['overview', 'topology', 'events', 'correlation', 'data-generation', 'demo'];

      for (const tab of tabs) {
        const startTime = Date.now();

        await page.click(`[data-tab="${tab}"]`);
        await page.waitForSelector(`#${tab}`);

        const loadTime = Date.now() - startTime;

        expect(loadTime).toBeLessThan(2000); // 2 second max
        console.log(`✅ ${tab} tab loaded in ${loadTime}ms`);
      }
    });
  });
});