# AI Development Guide

This guide is specifically designed to help AI assistants (like Claude Code) understand and work effectively with this CMDB codebase.

## Quick Start for AI Assistants

### Understanding the Codebase
1. **Primary entry points**: `src/app.js` (production) and `demo-app.js` (demo mode)
2. **API routes**: Located in `src/api/` directory
3. **Database layer**: `src/services/neo4j.js` handles all database operations
4. **Frontend**: Single-page application in `public/index.html` with modular JS files

### Common AI Tasks and Patterns

#### Adding New API Endpoints
When asked to add a new API endpoint:

1. **Identify the appropriate router file**:
   - CMDB operations → `src/api/cmdb.js`
   - Events → `src/api/events.js`
   - Correlation → `src/api/correlation.js`
   - Demo features → `src/api/demo.js`

2. **Follow existing patterns**:
   ```javascript
   // Standard pattern in route files
   router.get('/endpoint-name', async (req, res) => {
     try {
       const { param1, param2 } = req.query; // or req.body for POST
       const result = await runReadQuery(cypherQuery, { param1, param2 });
       res.json(result);
     } catch (error) {
       console.error('Error description:', error);
       res.status(500).json({ error: 'Error message' });
     }
   });
   ```

3. **Database queries**: Use `runReadQuery()` for SELECT-like operations, `runWriteQuery()` for modifications

#### Modifying Frontend Components
When updating the UI:

1. **Tab-based architecture**: Each major feature has its own tab in `public/index.html`
2. **JavaScript modules**:
   - `public/js/app.js` - Main application logic and tab switching
   - `public/js/topology.js` - D3.js visualizations
   - `public/js/correlation.js` - Correlation analysis UI
   - `public/js/browse.js` - Data browsing interface

3. **Common patterns**:
   ```javascript
   // API calls from frontend
   async function fetchData(endpoint) {
     try {
       const response = await fetch(`/api/${endpoint}`);
       return await response.json();
     } catch (error) {
       console.error('API Error:', error);
       showError('Failed to fetch data');
     }
   }
   ```

#### Database Operations
When working with Neo4j:

1. **Connection handling**: Already managed in `src/services/neo4j.js`
2. **Query patterns**:
   ```javascript
   // Read operations
   const result = await runReadQuery(`
     MATCH (ci:ConfigurationItem)
     WHERE ci.type = $type
     RETURN ci
   `, { type: 'server' });

   // Write operations
   const result = await runWriteQuery(`
     CREATE (ci:ConfigurationItem {
       id: $id,
       name: $name,
       type: $type,
       createdAt: datetime()
     })
     RETURN ci
   `, { id: uuidv4(), name: 'New CI', type: 'server' });
   ```

3. **Error handling**: Always wrap database operations in try-catch blocks

## Code Patterns and Conventions

### File Organization
```
src/
├── app.js              # Main application entry (registers routes, starts server)
├── api/                # Route handlers (business logic should be minimal)
│   ├── cmdb.js        # Configuration item operations
│   ├── events.js      # Event management
│   ├── correlation.js # Analysis and correlation logic
│   └── demo.js        # Demo data generation
├── services/           # Business logic and external service integration
│   ├── neo4j.js       # Database connection and query utilities
│   └── queueService.js # Redis job queue management
└── models/             # Data models and sample data generators
    ├── sampleData.js   # Basic sample data
    └── demoEnterpriseData.js # Complex enterprise scenarios
```

### Naming Conventions
- **Variables**: camelCase (`configItem`, `eventData`)
- **Functions**: camelCase (`createConfigItem`, `analyzeCorrelation`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PORT`, `MAX_ITEMS`)
- **Database labels**: PascalCase (`ConfigurationItem`, `Event`)
- **Database properties**: camelCase (`createdAt`, `lastModified`)

### Error Handling Patterns
```javascript
// API route error handling
router.get('/endpoint', async (req, res) => {
  try {
    const result = await someOperation();
    res.json(result);
  } catch (error) {
    console.error('Operation failed:', error);
    res.status(500).json({
      error: 'User-friendly error message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Database operation error handling
async function getDatabaseStats() {
  try {
    const result = await runReadQuery('MATCH (n) RETURN count(n)');
    return result;
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Failed to retrieve database statistics');
  }
}
```

## AI Assistant Guidelines

### When Adding Features
1. **Understand the context**: Check existing similar functionality before implementing
2. **Follow established patterns**: Use the same structure as existing code
3. **Update documentation**: Modify this file and CLAUDE.md when adding significant features
4. **Consider both modes**: Ensure new features work in both full Neo4j mode and demo mode

### Database Considerations
1. **Demo mode compatibility**: `demo-app.js` uses in-memory data structures instead of Neo4j
2. **Connection management**: Don't create new database connections; use existing utilities
3. **Query performance**: For large datasets, implement pagination and filtering
4. **Transaction safety**: Use Neo4j transactions for multi-step operations

### Frontend Development
1. **Mobile responsiveness**: Maintain responsive design principles
2. **D3.js performance**: For large graphs, implement filtering and level-of-detail rendering
3. **Error feedback**: Always provide user feedback for failed operations
4. **Loading states**: Show loading indicators for async operations

### Testing Considerations
1. **API testing**: Use the examples in `docs/API_EXAMPLES.md`
2. **Demo data**: Generate appropriate test data using demo endpoints
3. **Browser testing**: Test visualizations in different browsers
4. **Performance testing**: Monitor memory usage with large datasets

## Common Modification Scenarios

### Adding a New Configuration Item Type
1. **Backend**: Update validation in `src/api/cmdb.js`
2. **Frontend**: Add type-specific rendering in topology visualization
3. **Data model**: Update sample data generators in `src/models/`
4. **Documentation**: Update schema documentation in CLAUDE.md

### Adding Event Correlation Rules
1. **Algorithm**: Implement in `src/api/correlation.js`
2. **Database queries**: Add Cypher queries for pattern detection
3. **UI**: Update correlation display in `public/js/correlation.js`
4. **Testing**: Create test scenarios with known correlation patterns

### Performance Optimization
1. **Database**: Add indexes, optimize Cypher queries
2. **API**: Implement caching, pagination
3. **Frontend**: Virtualization for large lists, canvas rendering for graphs
4. **Monitoring**: Add performance metrics to health check endpoint

## Debugging and Troubleshooting

### Development Tools
- **Neo4j Browser**: http://localhost:7474 for query testing
- **Application logs**: Check console output for detailed error messages
- **Network tab**: Monitor API calls in browser dev tools
- **Redis Commander**: http://localhost:8081 for queue monitoring

### Common Issues
1. **Database connection**: Check Neo4j service status and credentials
2. **Frontend errors**: Check browser console for JavaScript errors
3. **Performance**: Monitor memory usage and query execution times
4. **Data integrity**: Verify relationships and constraints in Neo4j

### Useful Commands for Debugging
```bash
# Check application health
curl http://localhost:3000/health

# Get database statistics
curl http://localhost:3000/api/cmdb/database/stats

# View application logs
docker-compose logs -f app

# Access Neo4j shell
docker-compose exec neo4j cypher-shell -u neo4j -p password
```

## Best Practices for AI Assistants

### Code Quality
1. **Consistency**: Match existing code style and patterns
2. **Comments**: Add comments for complex business logic only
3. **Error messages**: Provide clear, actionable error messages
4. **Validation**: Validate all inputs, especially from API requests

### Documentation
1. **Update CLAUDE.md**: For any architectural changes
2. **API examples**: Add examples to `docs/API_EXAMPLES.md` for new endpoints
3. **Inline documentation**: Use JSDoc for complex functions
4. **Change logs**: Document significant modifications

### Security
1. **Input validation**: Sanitize all user inputs
2. **SQL injection prevention**: Use parameterized Cypher queries
3. **Error exposure**: Don't expose sensitive information in error messages
4. **Authentication**: Consider auth requirements for new endpoints

This guide should help AI assistants understand the codebase structure and make effective modifications while maintaining code quality and consistency.