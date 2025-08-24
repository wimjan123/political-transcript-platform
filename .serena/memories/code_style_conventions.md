# Code Style and Conventions

## Backend (Python/FastAPI)
- **Language**: Python 3.11+
- **Framework**: FastAPI with async/await patterns
- **ORM**: SQLAlchemy 2.0+ with async sessions
- **Code Formatting**: Black (line length 88)
- **Import Sorting**: isort
- **Linting**: flake8
- **Type Hints**: Required for all function signatures
- **Validation**: Pydantic models for request/response validation

### Backend Structure
```
backend/src/
├── models.py           # SQLAlchemy database models
├── services/           # Business logic services
├── api/               # FastAPI route handlers
├── search/            # Meilisearch integration
└── utils/             # Utility functions
```

### Python Conventions
- Function names: `snake_case`
- Class names: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Private methods: `_snake_case`
- Async functions for database operations
- Type hints mandatory for public APIs

## Frontend (React/TypeScript)
- **Language**: TypeScript (strict mode)
- **Framework**: React 18 with functional components
- **Styling**: Tailwind CSS with utility-first approach
- **State Management**: React Query for server state, React hooks for local state
- **Routing**: React Router v6
- **Testing**: React Testing Library + Jest, Playwright for E2E

### Frontend Structure
```
frontend/src/
├── components/        # Reusable UI components
├── pages/            # Page-level components
├── hooks/            # Custom React hooks
├── services/         # API service functions
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

### TypeScript Conventions
- Component names: `PascalCase`
- File names: `PascalCase` for components, `camelCase` for utilities
- Interface names: `PascalCase` with descriptive names
- Props interfaces: `ComponentNameProps`
- Comprehensive type definitions in `types/index.ts`

## Database Conventions
- Table names: `snake_case`
- Foreign key columns: `table_name_id`
- Indexes: GIN indexes for full-text search
- Migrations: Alembic for schema versioning
- Connection: Async PostgreSQL with pgvector extension

## API Conventions
- RESTful endpoints with proper HTTP methods
- Consistent error responses with Pydantic models
- OpenAPI documentation auto-generated
- CORS configured for development origins
- Request/response validation with Pydantic