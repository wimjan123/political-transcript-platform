# Frontend (React + TypeScript)

React UI for searching, analyzing, and managing political video transcripts.

## Scripts
```bash
npm start        # CRA dev server, proxies /api to backend
npm test         # Jest + React Testing Library
npm run build    # Production build
npm run lint     # Lint TypeScript/React
```

Dev proxy is configured in `src/setupProxy.js` to forward `/api` to the API service when using Docker Compose.

## Project Structure
```
frontend/
├─ src/
│  ├─ pages/            # Page components (end with *Page.tsx)
│  ├─ components/       # Reusable UI components
│  ├─ services/         # API clients and utilities
│  ├─ hooks/            # Custom React hooks
│  ├─ types/            # Shared TS types
│  └─ setupProxy.js     # Dev proxy to backend API
├─ public/              # Static assets
└─ package.json
```

## Conventions
- Functional components and hooks
- Component files: `PascalCase.tsx`
- Page files: `*Page.tsx`
- Type safety with TypeScript; validate API responses where practical
- Keep UI tests near components or under `src/__tests__`

## Environment
- Frontend usually uses relative `/api` path with CRA proxy in dev
- For production, set `REACT_APP_API_URL` as needed (see `.env.example`)

## Troubleshooting
- Check API availability at `http://localhost:8000/health`
- Use `make logs-web` and browser devtools for frontend logs
