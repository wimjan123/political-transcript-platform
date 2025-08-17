"""
Meilisearch Reindexing Script

This script performs a full reindex of all transcript segments from PostgreSQL to Meilisearch.

Usage:
    python scripts/meili_reindex.py
"""
import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.search.indexer import reindex_segments, generate_suggestions


async def main():
    """Main reindexing function"""
    print("Starting Meilisearch reindexing...")
    
    try:
        # Reindex all segments
        await reindex_segments()
        
        # Generate fresh suggestions
        await generate_suggestions()
        
        print("Reindexing completed successfully!")
        
    except Exception as e:
        print(f"Error during reindexing: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())