"""
Political Transcript Search Platform - Main FastAPI Application
"""
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from contextlib import asynccontextmanager

from .database import init_db
from .routes import search, analytics, videos, upload, ingest, clips, chatbot
from .routes import meili_search, meilisearch_admin, meilisearch_search, summarization
from .routers import video_files, folder_browser, debug
from .config import settings
from .routes.upload import import_status


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    await init_db()
    yield
    # Shutdown - cleanup if needed


# Create FastAPI app
app = FastAPI(
    title="Political Transcript Search Platform",
    description="Search and analyze political video transcripts with advanced analytics",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(meili_search.router, prefix="/api/search", tags=["search-meili"])
app.include_router(meilisearch_search.router, prefix="/api/search", tags=["search-advanced"])
app.include_router(meilisearch_admin.router, prefix="/api/meilisearch", tags=["meilisearch-admin"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(videos.router, prefix="/api/videos", tags=["videos"])
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(ingest.router, prefix="/api/ingest", tags=["ingest"])
app.include_router(clips.router, prefix="/api/videos", tags=["clips"])
app.include_router(summarization.router, prefix="/api/summarization", tags=["summarization"])
app.include_router(chatbot.router, tags=["chatbot"])
app.include_router(video_files.router, tags=["video-files"])
app.include_router(folder_browser.router, tags=["folders"])
app.include_router(debug.router, tags=["debug"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Political Transcript Search Platform API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "API is running"}


@app.exception_handler(404)
async def not_found_handler(request, exc):
    """Custom 404 handler"""
    return JSONResponse(
        status_code=404,
        content={"detail": "Endpoint not found"}
    )


@app.websocket("/ws/import-status")
async def import_status_ws(ws: WebSocket):
    await ws.accept()
    try:
        # Send initial snapshot
        await ws.send_json(import_status)
        while True:
            import asyncio
            await asyncio.sleep(1)
            await ws.send_json(import_status)
            if import_status.get("status") in {"completed", "failed", "cancelled"}:
                break
    except WebSocketDisconnect:
        return


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    """Custom 500 handler"""
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG
    )
