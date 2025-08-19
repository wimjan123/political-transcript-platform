"""
Import progress tracking service for persistent progress monitoring
"""
import asyncio
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

import logging
logger = logging.getLogger(__name__)


class ImportProgressTracker:
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.job_id = str(uuid.uuid4())
        self._last_update = datetime.now()
        self._update_interval = 5  # Update database every 5 seconds minimum
        
    async def start_job(self, job_type: str, total_files: int) -> str:
        """Start tracking a new import job"""
        query = text("""
            INSERT INTO import_progress 
            (job_id, job_type, status, total_files, processed_files, failed_files, started_at, updated_at)
            VALUES (:job_id, :job_type, 'running', :total_files, 0, 0, NOW(), NOW())
            RETURNING job_id
        """)
        
        result = await self.db.execute(
            query,
            {
                "job_id": self.job_id,
                "job_type": job_type,
                "total_files": total_files
            }
        )
        await self.db.commit()
        
        logger.info(f"Started tracking import job {self.job_id}: {job_type} with {total_files} files")
        return self.job_id
    
    async def update_progress(
        self,
        processed_files: int,
        failed_files: int,
        current_file: Optional[str] = None,
        errors: Optional[List[str]] = None
    ):
        """Update progress - only commits to DB if enough time has passed or on significant changes"""
        now = datetime.now()
        
        # Always update for first file, last file, or every N seconds
        should_update = (
            processed_files == 1 or  # First file
            (now - self._last_update).seconds >= self._update_interval or  # Time interval
            failed_files > 0  # Any failures
        )
        
        if should_update:
            query = text("""
                UPDATE import_progress 
                SET processed_files = :processed_files,
                    failed_files = :failed_files,
                    current_file = :current_file,
                    error_messages = :error_messages,
                    updated_at = NOW()
                WHERE job_id = :job_id
            """)
            
            await self.db.execute(
                query,
                {
                    "job_id": self.job_id,
                    "processed_files": processed_files,
                    "failed_files": failed_files,
                    "current_file": current_file,
                    "error_messages": errors or []
                }
            )
            await self.db.commit()
            self._last_update = now
            
            logger.debug(f"Updated progress for job {self.job_id}: {processed_files} processed, {failed_files} failed")
    
    async def complete_job(self, status: str = "completed", final_errors: Optional[List[str]] = None):
        """Mark job as completed"""
        query = text("""
            UPDATE import_progress 
            SET status = :status,
                error_messages = :error_messages,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE job_id = :job_id
        """)
        
        await self.db.execute(
            query,
            {
                "job_id": self.job_id,
                "status": status,
                "error_messages": final_errors or []
            }
        )
        await self.db.commit()
        
        logger.info(f"Completed import job {self.job_id} with status: {status}")
    
    @staticmethod
    async def get_latest_job_status(db: AsyncSession) -> Optional[Dict[str, Any]]:
        """Get the status of the most recent import job"""
        query = text("""
            SELECT job_id, job_type, status, total_files, processed_files, failed_files,
                   current_file, error_messages, started_at, updated_at, completed_at,
                   CASE 
                       WHEN total_files = 0 THEN 0 
                       ELSE ROUND((processed_files::float / total_files::float) * 100, 2)
                   END as progress_percentage
            FROM import_progress 
            ORDER BY started_at DESC 
            LIMIT 1
        """)
        
        result = await db.execute(query)
        row = result.fetchone()
        
        if row:
            return {
                "job_id": row.job_id,
                "job_type": row.job_type,
                "status": row.status,
                "total_files": row.total_files,
                "processed_files": row.processed_files,
                "failed_files": row.failed_files,
                "current_file": row.current_file,
                "errors": row.error_messages or [],
                "started_at": row.started_at,
                "updated_at": row.updated_at,
                "completed_at": row.completed_at,
                "progress": float(row.progress_percentage) if row.progress_percentage else 0.0
            }
        
        return None
    
    @staticmethod
    async def cancel_running_jobs(db: AsyncSession):
        """Cancel any running import jobs (useful on startup)"""
        query = text("""
            UPDATE import_progress 
            SET status = 'cancelled', 
                completed_at = NOW(),
                updated_at = NOW()
            WHERE status = 'running'
        """)
        
        result = await db.execute(query)
        await db.commit()
        
        if result.rowcount > 0:
            logger.info(f"Cancelled {result.rowcount} running import job(s)")
        
        return result.rowcount