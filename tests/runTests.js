#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration
const testTypes = {
  integration: {
    pattern: 'integration',
    description: 'Integration tests for API endpoints and data flow',
    timeout: 60000
  },
  e2e: {
    pattern: 'e2e',
    description: 'End-to-end user workflow tests',
    timeout: 180000
  },
  visual: {
    pattern: 'visual',
    description: 'Visual regression tests for UI consistency',
    timeout: 120000
  }
};

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function installDependencies() {
  console.log('\n📦 Installing test dependencies...');
  try {
    await runCommand('npm', ['install']);
    console.log('✅ Dependencies installed successfully');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
  }
}

async function runTestSuite(testType) {
  const config = testTypes[testType];
  if (!config) {
    console.error(`❌ Unknown test type: ${testType}`);
    return false;
  }

  console.log(`\n🧪 Running ${config.description}...`);
  console.log(`Pattern: ${config.pattern}`);

  try {
    await runCommand('npx', [
      'jest',
      '--testPathPattern=' + config.pattern,
      '--verbose',
      '--detectOpenHandles',
      '--forceExit',
      '--testTimeout=' + config.timeout
    ]);

    console.log(`✅ ${testType} tests completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ ${testType} tests failed:`, error.message);
    return false;
  }
}

async function generateTestReport() {
  console.log('\n📊 Generating test coverage report...');
  try {
    await runCommand('npx', [
      'jest',
      '--coverage',
      '--coverageReporters=text',
      '--coverageReporters=html',
      '--coverageReporters=lcov'
    ]);
    console.log('✅ Coverage report generated in ./coverage/');
  } catch (error) {
    console.error('❌ Failed to generate coverage report:', error.message);
  }
}

async function checkEnvironment() {
  console.log('\n🔍 Checking test environment...');

  // Check if Docker containers are running
  try {
    await runCommand('docker', ['ps'], { stdio: 'pipe' });
    console.log('✅ Docker is available');
  } catch (error) {
    console.error('⚠️  Docker may not be available. Some tests may fail.');
  }

  // Check if test database is accessible
  const testConfig = {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    neo4jURI: process.env.TEST_NEO4J_URI || 'bolt://localhost:7687'
  };

  console.log('Test configuration:');
  console.log(`  Base URL: ${testConfig.baseURL}`);
  console.log(`  Neo4j URI: ${testConfig.neo4jURI}`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  console.log('🧪 FancyCMDBConcept Test Suite');
  console.log('================================');

  await checkEnvironment();

  if (command === 'install') {
    await installDependencies();
    return;
  }

  if (command === 'coverage') {
    await generateTestReport();
    return;
  }

  let testResults = {};

  if (command === 'all') {
    console.log('\n🚀 Running all test suites...');

    // Install dependencies first
    await installDependencies();

    // Run each test suite
    for (const [testType, config] of Object.entries(testTypes)) {
      testResults[testType] = await runTestSuite(testType);
    }

    // Generate coverage report
    await generateTestReport();

  } else if (testTypes[command]) {
    await installDependencies();
    testResults[command] = await runTestSuite(command);
  } else {
    console.log('\nUsage: node tests/runTests.js [command]');
    console.log('\nCommands:');
    console.log('  all        Run all test suites (default)');
    console.log('  install    Install test dependencies only');
    console.log('  coverage   Generate coverage report only');

    for (const [testType, config] of Object.entries(testTypes)) {
      console.log(`  ${testType.padEnd(10)} ${config.description}`);
    }

    process.exit(1);
  }

  // Print summary
  console.log('\n📋 Test Summary');
  console.log('================');

  let allPassed = true;
  for (const [testType, passed] of Object.entries(testResults)) {
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${testType.padEnd(12)} ${status}`);
    if (!passed) allPassed = false;
  }

  if (allPassed) {
    console.log('\n🎉 All tests passed successfully!');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed. Check the output above for details.');
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main().catch((error) => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});