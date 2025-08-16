"""
Meilisearch administration API endpoints
"""
import asyncio
import json
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..config import settings


router = APIRouter()


class CreateIndexRequest(BaseModel):
    uid: str
    primaryKey: Optional[str] = None


class SyncRequest(BaseModel):
    batch_size: Optional[int] = 500
    force_reimport: Optional[bool] = False


async def _meili_request(method: str, path: str, data: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Make a request to Meilisearch API"""
    url = f"{settings.MEILI_HOST.rstrip('/')}{path}"
    headers = {"Content-Type": "application/json"}
    if settings.MEILI_MASTER_KEY:
        headers["Authorization"] = f"Bearer {settings.MEILI_MASTER_KEY}"
    
    timeout = httpx.Timeout(settings.MEILI_TIMEOUT)
    async with httpx.AsyncClient(timeout=timeout) as client:
        if method.upper() == "GET":
            response = await client.get(url, headers=headers, params=params)
        elif method.upper() == "POST":
            response = await client.post(url, headers=headers, json=data, params=params)
        elif method.upper() == "PATCH":
            response = await client.patch(url, headers=headers, json=data, params=params)
        elif method.upper() == "DELETE":
            response = await client.delete(url, headers=headers, params=params)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported method: {method}")
        
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"Meilisearch error: {response.text}")
        
        return response.json()


@router.get("/health")
async def get_health():
    """Get Meilisearch health status"""
    try:
        return await _meili_request("GET", "/health")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get health status: {str(e)}")


@router.get("/stats")
async def get_stats():
    """Get Meilisearch statistics"""
    try:
        return await _meili_request("GET", "/stats")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@router.get("/experimental-features")
async def get_experimental_features():
    """Get experimental features status"""
    try:
        return await _meili_request("GET", "/experimental-features")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get experimental features: {str(e)}")


@router.patch("/experimental-features")
async def update_experimental_features(features: Dict[str, bool]):
    """Update experimental features"""
    try:
        return await _meili_request("PATCH", "/experimental-features", data=features)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update experimental features: {str(e)}")


@router.get("/indexes")
async def list_indexes():
    """List all Meilisearch indexes"""
    try:
        return await _meili_request("GET", "/indexes")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list indexes: {str(e)}")


@router.get("/indexes/{index_uid}")
async def get_index(index_uid: str):
    """Get specific index information"""
    try:
        return await _meili_request("GET", f"/indexes/{index_uid}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get index: {str(e)}")


@router.post("/indexes")
async def create_index(request: CreateIndexRequest):
    """Create a new index"""
    try:
        data = {"uid": request.uid}
        if request.primaryKey:
            data["primaryKey"] = request.primaryKey
        return await _meili_request("POST", "/indexes", data=data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create index: {str(e)}")


@router.delete("/indexes/{index_uid}")
async def delete_index(index_uid: str):
    """Delete an index"""
    try:
        return await _meili_request("DELETE", f"/indexes/{index_uid}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete index: {str(e)}")


@router.get("/indexes/{index_uid}/settings")
async def get_index_settings(index_uid: str):
    """Get index settings"""
    try:
        return await _meili_request("GET", f"/indexes/{index_uid}/settings")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get index settings: {str(e)}")


@router.patch("/indexes/{index_uid}/settings")
async def update_index_settings(index_uid: str, settings_data: Dict[str, Any]):
    """Update index settings"""
    try:
        return await _meili_request("PATCH", f"/indexes/{index_uid}/settings", data=settings_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update index settings: {str(e)}")


@router.get("/indexes/{index_uid}/documents")
async def get_documents(
    index_uid: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
    fields: Optional[str] = Query(None)
):
    """Get documents from an index"""
    try:
        params = {"offset": offset, "limit": limit}
        if fields:
            params["fields"] = fields
        return await _meili_request("GET", f"/indexes/{index_uid}/documents", params=params)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get documents: {str(e)}")


@router.get("/tasks")
async def get_tasks(
    limit: int = Query(20, ge=1, le=1000),
    from_: Optional[int] = Query(None, alias="from"),
    statuses: Optional[str] = None,
    types: Optional[str] = None,
    index_uids: Optional[str] = Query(None, alias="indexUids")
):
    """Get tasks with optional filtering"""
    try:
        params = {"limit": limit}
        if from_ is not None:
            params["from"] = from_
        if statuses:
            params["statuses"] = statuses
        if types:
            params["types"] = types
        if index_uids:
            params["indexUids"] = index_uids
        return await _meili_request("GET", "/tasks", params=params)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tasks: {str(e)}")


@router.get("/tasks/{task_uid}")
async def get_task(task_uid: int):
    """Get specific task information"""
    try:
        return await _meili_request("GET", f"/tasks/{task_uid}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get task: {str(e)}")


@router.post("/tasks/cancel")
async def cancel_tasks(
    statuses: Optional[str] = None,
    types: Optional[str] = None,
    index_uids: Optional[str] = Query(None, alias="indexUids"),
    uids: Optional[str] = None
):
    """Cancel tasks based on filters"""
    try:
        params = {}
        if statuses:
            params["statuses"] = statuses
        if types:
            params["types"] = types
        if index_uids:
            params["indexUids"] = index_uids
        if uids:
            params["uids"] = uids
        return await _meili_request("POST", "/tasks/cancel", params=params)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel tasks: {str(e)}")


@router.post("/sync")
async def trigger_sync(request: Optional[SyncRequest] = None):
    """Trigger data synchronization from PostgreSQL to Meilisearch"""
    try:
        # Import the sync script functionality
        import subprocess
        import sys
        
        batch_size = request.batch_size if request else 500
        force_reimport = request.force_reimport if request else False
        
        # Run the sync script
        cmd = [
            sys.executable, 
            "scripts/meili_sync.py", 
            "--incremental",
            f"--batch-size={batch_size}"
        ]
        
        if force_reimport:
            # First initialize if forcing reimport
            init_cmd = [sys.executable, "scripts/meili_sync.py", "--init"]
            init_result = subprocess.run(init_cmd, capture_output=True, text=True, cwd="/app")
            if init_result.returncode != 0:
                raise HTTPException(status_code=500, detail=f"Sync initialization failed: {init_result.stderr}")
        
        # Run the incremental sync in the background
        process = subprocess.Popen(cmd, cwd="/app")
        
        return {
            "message": "Sync triggered successfully",
            "process_id": process.pid,
            "batch_size": batch_size,
            "force_reimport": force_reimport
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to trigger sync: {str(e)}")


@router.get("/keys")
async def get_api_keys():
    """Get API keys"""
    try:
        return await _meili_request("GET", "/keys")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get API keys: {str(e)}")


@router.post("/indexes/{index_uid}/search")
async def search_index(index_uid: str, search_data: Dict[str, Any]):
    """Search in a specific index"""
    try:
        return await _meili_request("POST", f"/indexes/{index_uid}/search", data=search_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search index: {str(e)}")


@router.post("/multi-search")
async def multi_search(queries: List[Dict[str, Any]]):
    """Perform multi-search across indexes"""
    try:
        data = {"queries": queries}
        return await _meili_request("POST", "/multi-search", data=data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to perform multi-search: {str(e)}")


@router.get("/version")
async def get_version():
    """Get Meilisearch version"""
    try:
        return await _meili_request("GET", "/version")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get version: {str(e)}")