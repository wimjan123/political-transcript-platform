# Gemini Code Assistant Context

This document provides context for the Gemini code assistant to understand the project structure, technologies, and development conventions.

## Project Overview

This is a full-stack web application designed for searching, analyzing, and summarizing political video transcripts.

**Core Functionalities:**

*   **Transcript Ingestion:** Imports and processes video transcripts from HTML and XML files.
*   **Search:** Provides advanced full-text and semantic search capabilities over the transcripts.
*   **AI-Powered Analytics:** Offers features like sentiment analysis, content moderation, and automated summarization.
*   **Data Visualization:** Includes a dashboard with various charts to visualize the analyzed data.

**Architecture:**

*   **Backend:** A Python-based backend built with the **FastAPI** framework.
    *   **Database:** Uses **PostgreSQL** with the `pgvector` extension for vector embeddings.
    *   **Search:** Leverages **Meilisearch** for advanced search features.
    *   **AI Integration:** Integrates with **OpenAI** for summarization and other AI tasks.
*   **Frontend:** A modern frontend built with **React** and **TypeScript**.
    *   **Styling:** Uses **Tailwind CSS** for styling.
    *   **Charting:** Implements `chart.js` and `recharts` for data visualization.
*   **Containerization:** The entire application is containerized using **Docker** and managed with `docker-compose`.

## Building and Running

The project uses a `Makefile` to simplify common development tasks.

**Key Commands:**

*   `make dev`: Starts the complete development environment (backend, frontend, database, and Meilisearch).
*   `make test`: Runs the backend tests using `pytest`.
*   `make lint`: Lints the backend Python code.
*   `make format`: Formats the backend Python code using `black` and `isort`.
*   `make import-data`: Imports sample transcript data into the application.

**Frontend Development:**

*   `npm start`: Starts the frontend development server.
*   `npm test`: Runs the frontend tests.
*   `npm run test:e2e`: Runs the end-to-end tests using Playwright.

## Development Conventions

*   **Backend:**
    *   Follows **PEP 8** style guidelines.
    *   Uses `black` for code formatting and `isort` for import sorting.
    *   API routes are defined in the `backend/src/routes` directory.
    *   Business logic is separated into services in the `backend/src/services` directory.
*   **Frontend:**
    *   Uses functional components with React Hooks.
    *   Follows the conventions of Create React App.
    *   Components are organized in the `frontend/src/components` directory.
    *   Pages are located in the `frontend/src/pages` directory.
*   **Commits:** While not explicitly enforced, the presence of a `CHANGELOG.md` suggests that Conventional Commits might be a good practice to follow.
