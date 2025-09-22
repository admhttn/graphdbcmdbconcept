# FancyCMDBConcept Test Suite

This comprehensive test suite validates all demo features across tabs and ensures consistency in the application's behavior and user experience.

## Test Structure

```
tests/
├── integration/           # API and feature integration tests
│   ├── dataGeneration.test.js      # Data generation features
│   ├── eventSimulation.test.js     # Event simulation and clearing
│   └── topologyCorrelation.test.js # Topology and correlation features
├── e2e/                  # End-to-end user workflow tests
│   └── userWorkflows.test.js       # Complete user journeys
├── visual/               # Visual regression tests
│   ├── visualRegression.test.js    # UI consistency validation
│   └── screenshots/                # Screenshot storage
├── helpers/              # Test utilities
│   ├── testServer.js              # Server management
│   └── apiClient.js               # API interaction helpers
├── fixtures/             # Test data
│   └── sampleData.js              # Sample data fixtures
└── runTests.js          # Test runner script
```

## Test Categories

### 1. Integration Tests (`npm run test:integration`)

**Purpose**: Validate API endpoints and feature interactions without UI layer.

#### Data Generation Tests
- ✅ Direct demo data loading (Demo tab)
- ✅ Worker-based data generation (Data Generation tab)
- ✅ Scale comparison (small vs medium vs large)
- ✅ Job progress tracking and cancellation
- ✅ Queue statistics accuracy
- ✅ Data structure consistency between approaches

#### Event Simulation Tests
- ✅ Basic event simulation (Events tab)
- ✅ Cascade event simulation (Demo tab)
- ✅ Scenario-based events (Correlation tab)
- ✅ Event filtering by severity
- ✅ Event clearing functionality
- ✅ Cross-tab event consistency

#### Topology & Correlation Tests
- ✅ Topology data loading and filtering
- ✅ Correlation analysis execution
- ✅ Business impact assessment
- ✅ Pattern recognition
- ✅ Graph advantages demonstration
- ✅ Impact analysis with variable depth

### 2. End-to-End Tests (`npm run test:e2e`)

**Purpose**: Validate complete user workflows using browser automation.

#### User Journey Tests
- ✅ **New User Onboarding**: First-time user exploring all features
- ✅ **Data Scientist Evaluation**: Technical evaluation of graph advantages
- ✅ **IT Operations Incident Response**: Realistic incident handling workflow
- ✅ **Sales Demonstration**: Compelling feature showcase

#### Error Handling Tests
- ✅ Network failure graceful handling
- ✅ Rapid navigation between tabs
- ✅ Invalid input handling

### 3. Visual Regression Tests (`npm run test:visual`)

**Purpose**: Ensure UI consistency and prevent visual regressions.

#### Layout Validation
- ✅ Tab consistency across all sections
- ✅ Component rendering verification
- ✅ Interactive element states
- ✅ Responsive layout testing
- ✅ Error state visualization

## Running Tests

### Quick Start
```bash
# Run all tests
npm test

# Or use the custom test runner
node tests/runTests.js all
```

### Individual Test Suites
```bash
# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# Visual regression tests only
npm run test:visual

# With coverage report
npm run test:coverage
```

### Custom Test Runner
```bash
# Install dependencies only
node tests/runTests.js install

# Run specific test type
node tests/runTests.js integration
node tests/runTests.js e2e
node tests/runTests.js visual

# Generate coverage report only
node tests/runTests.js coverage
```

## Test Configuration

### Environment Variables
```bash
# Test server configuration
TEST_BASE_URL=http://localhost:3000
TEST_NEO4J_URI=bolt://localhost:7687
TEST_NEO4J_USER=neo4j
TEST_NEO4J_PASSWORD=password
TEST_REDIS_URL=redis://localhost:6379

# Test behavior
CI=false                    # Set to true for headless browser testing
```

### Prerequisites
- Docker and Docker Compose running
- Neo4j database accessible
- Redis server accessible
- Chrome/Chromium for visual tests

## Expected Test Results

### Feature Coverage Validation

| Feature | Demo Tab | Events Tab | Correlation Tab | Data Gen Tab |
|---------|----------|------------|----------------|--------------|
| Data Loading | ✅ Direct | ➖ N/A | ➖ N/A | ✅ Worker-based |
| Event Simulation | ✅ Cascade | ✅ Basic | ✅ Scenario | ➖ N/A |
| Event Clearing | ❌ Missing | ❌ Missing | ✅ Available | ➖ N/A |
| Topology View | ✅ Impact Analysis | ➖ N/A | ➖ N/A | ➖ N/A |
| Progress Tracking | ❌ Basic | ➖ N/A | ➖ N/A | ✅ Detailed |

### Performance Benchmarks
- **Data Generation**: Small scale < 30s, Medium scale < 2min
- **Correlation Analysis**: < 15s for typical dataset
- **Impact Analysis**: < 5s for 6-hop traversal
- **Page Load**: < 3s for initial load
- **Tab Switching**: < 500ms response time

### Known Issues to Address
1. **Duplicate "Clear Events"** - Available in both Correlation and Demo tabs
2. **Inconsistent Data Generation** - Both direct API and worker-based approaches
3. **Missing Progress Tracking** - Demo tab doesn't show generation progress
4. **Event Simulation Overlap** - Multiple tabs offer similar functionality
5. **Documentation Gaps** - Some features not clearly explained

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      neo4j:
        image: neo4j:5.20-community
        env:
          NEO4J_AUTH: neo4j/password
      redis:
        image: redis:alpine
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: node tests/runTests.js all
      - uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: coverage/
```

## Test Data Management

### Sample Data Fixtures
- **Small Dataset**: ~1,000 CIs for quick tests
- **Medium Dataset**: ~10,000 CIs for realistic scenarios
- **Large Dataset**: ~50,000 CIs for performance testing

### Data Cleanup
- Each test starts with clean database
- Automatic cleanup after test completion
- Isolated test environments prevent interference

## Troubleshooting

### Common Issues

**Tests timing out**
- Increase timeout in jest.config.js
- Check Docker container health
- Verify network connectivity

**Visual tests failing**
- Screenshots may differ between environments
- Update baseline images: `rm -rf tests/visual/screenshots/baseline`
- Run tests again to generate new baselines

**Database connection errors**
- Ensure Neo4j container is running
- Check credentials in test configuration
- Verify network accessibility

**Memory issues during tests**
- Increase Docker memory limits
- Run test suites individually
- Use `--detectOpenHandles` flag

### Debugging Tips

```bash
# Run with verbose output
npx jest --verbose --detectOpenHandles

# Run specific test file
npx jest tests/integration/dataGeneration.test.js

# Run with browser visible (E2E tests)
CI=false npx jest tests/e2e/

# Generate detailed coverage
npx jest --coverage --coverageReporters=html
```

## Contributing to Tests

### Adding New Tests
1. Follow existing test structure
2. Use descriptive test names
3. Include both positive and negative test cases
4. Add fixtures for consistent test data
5. Update this documentation

### Test Writing Guidelines
- Use `describe` blocks to group related tests
- Use `test` for individual test cases
- Include setup and cleanup in `beforeEach`/`afterEach`
- Mock external dependencies when needed
- Assert on meaningful outcomes

### Visual Test Guidelines
- Use consistent viewport sizes
- Wait for elements to load before screenshots
- Test multiple states (empty, populated, error)
- Use meaningful screenshot names
- Set appropriate comparison thresholds