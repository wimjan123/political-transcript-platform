# Task Completion Checklist

When completing any development task, follow this checklist to ensure quality:

## Code Quality Steps
1. **Format Code**: Run `make format` for Python code formatting
2. **Lint Check**: Run `make lint` for backend linting checks
3. **Frontend Lint**: Run `cd frontend && npm run lint:fix` for TypeScript/React
4. **Type Check**: Ensure TypeScript compilation passes without errors

## Testing Requirements
1. **Backend Tests**: Run `make test` to ensure all pytest tests pass
2. **Frontend Tests**: Run `cd frontend && npm test` for React component tests
3. **E2E Tests**: Run `cd frontend && npm run test:e2e` for Playwright tests
4. **Manual Testing**: Test the feature in the browser at http://localhost:3000

## Database & Search
1. **Database Migration**: If schema changed, create and apply migration
2. **Meilisearch Sync**: Run `make meili-sync` if search data affected
3. **Data Validation**: Verify data integrity after database changes

## Service Health Checks
1. **API Health**: Check http://localhost:8000/health endpoint
2. **Database Connection**: Verify PostgreSQL connection works
3. **Meilisearch Status**: Ensure search service is operational
4. **Frontend Build**: Verify `cd frontend && npm run build` succeeds

## Documentation Updates
1. **API Documentation**: Update OpenAPI specs if endpoints changed
2. **Type Definitions**: Update TypeScript interfaces if data structures changed
3. **README Updates**: Update relevant documentation if needed

## Git Workflow
1. **Commit Messages**: Use conventional commit format
2. **Branch Strategy**: Feature branches for all development work
3. **Code Review**: Ensure changes are reviewed before merging

## Production Readiness
1. **Environment Variables**: Ensure all required env vars are documented
2. **Docker Build**: Verify `docker-compose build` succeeds
3. **Production Config**: Check production docker-compose config if needed