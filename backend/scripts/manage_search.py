#!/usr/bin/env python3
"""
Search Engine Management Script

This script provides command-line utilities for managing the dual search engine setup.
"""
import asyncio
import argparse
import sys
import os

# Add the parent directory to Python path to import our modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.services.unified_search_service import unified_search_service, SearchEngine
from src.services.elasticsearch_service import elasticsearch_service
from src.search.indexer import reindex_segments
from src.config import settings


async def check_health():
    """Check health of both search engines"""
    print("Checking search engine health...")
    
    status = await unified_search_service.get_engine_status()
    
    print(f"\nPrimary Engine: {status['primary_engine']}")
    print(f"Fallback Engine: {status['fallback_engine']}")
    print("\nEngine Status:")
    
    for engine_name, engine_status in status['engines'].items():
        print(f"  {engine_name.capitalize()}:")
        print(f"    Healthy: {engine_status['healthy']}")
        print(f"    URL: {engine_status.get('url', 'N/A')}")
        
        if 'cluster_status' in engine_status:
            print(f"    Cluster Status: {engine_status['cluster_status']}")
            print(f"    Nodes: {engine_status['nodes']}")
        
        if 'error' in engine_status:
            print(f"    Error: {engine_status['error']}")
        
        print()


async def create_elasticsearch_index():
    """Create Elasticsearch index with proper mapping"""
    print("Creating Elasticsearch index...")
    
    success = await elasticsearch_service.create_index()
    
    if success:
        print("✅ Elasticsearch index created successfully")
    else:
        print("❌ Failed to create Elasticsearch index")
        return False
    
    return True


async def reindex_data(engine: str = "all", batch_size: int = 500):
    """Reindex data to specified engines"""
    print(f"Starting reindex for: {engine}")
    print(f"Batch size: {batch_size}")
    
    if engine.lower() == "all":
        results = await unified_search_service.reindex_all(batch_size)
        
        print("\nReindexing Results:")
        for engine_name, result in results.items():
            print(f"\n{engine_name.capitalize()}:")
            if 'error' in result:
                print(f"  ❌ Error: {result['error']}")
            else:
                if 'total_segments' in result:
                    print(f"  📊 Total segments: {result['total_segments']}")
                    print(f"  ✅ Indexed segments: {result['indexed_segments']}")
                    print(f"  ❌ Errors: {result['errors']}")
                    print(f"  ⏱️  Duration: {result.get('duration', 'N/A')}s")
                else:
                    print(f"  ✅ Status: {result.get('status', 'completed')}")
    
    elif engine.lower() == "elasticsearch":
        print("Reindexing to Elasticsearch...")
        result = await elasticsearch_service.reindex_all_segments(batch_size)
        
        print(f"\n📊 Total segments: {result['total_segments']}")
        print(f"✅ Indexed segments: {result['indexed_segments']}")
        print(f"❌ Errors: {result['errors']}")
        print(f"⏱️  Duration: {result.get('duration', 'N/A')}s")
    
    elif engine.lower() == "meilisearch":
        print("Reindexing to Meilisearch...")
        await reindex_segments(batch_size)
        print("✅ Meilisearch reindexing completed")
    
    else:
        print(f"❌ Unknown engine: {engine}")
        return False
    
    return True


async def test_search(query: str, engine: str = None):
    """Test search functionality"""
    print(f"Testing search with query: '{query}'")
    
    if engine:
        try:
            force_engine = SearchEngine(engine.lower())
            print(f"Forcing engine: {engine}")
        except ValueError:
            print(f"❌ Invalid engine: {engine}")
            return False
    else:
        force_engine = None
        print("Using automatic engine selection")
    
    try:
        result = await unified_search_service.search(
            query=query,
            size=5,
            force_engine=force_engine
        )
        
        print(f"\n🔍 Search Results:")
        print(f"Engine used: {result.engine.value}")
        print(f"Total hits: {result.total}")
        print(f"Time taken: {result.took}ms")
        print(f"Max score: {result.max_score}")
        
        print(f"\nTop 5 Results:")
        for i, hit in enumerate(result.hits[:5], 1):
            print(f"  {i}. {hit.get('video_title', 'No title')} - {hit.get('speaker_name', 'Unknown speaker')}")
            text = hit.get('transcript_text', '')
            if len(text) > 100:
                text = text[:100] + "..."
            print(f"     {text}")
            print()
        
        return True
        
    except Exception as e:
        print(f"❌ Search failed: {e}")
        return False


async def switch_primary_engine(engine: str):
    """Switch the primary search engine"""
    try:
        new_engine = SearchEngine(engine.lower())
        
        unified_search_service.primary_engine = new_engine
        
        if new_engine == SearchEngine.ELASTICSEARCH:
            unified_search_service.fallback_engine = SearchEngine.MEILISEARCH
        else:
            unified_search_service.fallback_engine = SearchEngine.ELASTICSEARCH
        
        print(f"✅ Primary engine switched to: {new_engine.value}")
        print(f"Fallback engine: {unified_search_service.fallback_engine.value}")
        
        return True
        
    except ValueError:
        print(f"❌ Invalid engine: {engine}")
        return False


async def compare_engines(query: str):
    """Compare search results between engines"""
    print(f"Comparing engines with query: '{query}'\n")
    
    # Test Elasticsearch
    print("Testing Elasticsearch...")
    try:
        es_result = await unified_search_service.search(
            query=query,
            size=5,
            force_engine=SearchEngine.ELASTICSEARCH
        )
        print(f"✅ Elasticsearch: {es_result.total} hits in {es_result.took}ms")
        es_success = True
    except Exception as e:
        print(f"❌ Elasticsearch failed: {e}")
        es_success = False
    
    # Test Meilisearch
    print("Testing Meilisearch...")
    try:
        meili_result = await unified_search_service.search(
            query=query,
            size=5,
            force_engine=SearchEngine.MEILISEARCH
        )
        print(f"✅ Meilisearch: {meili_result.total} hits in {meili_result.took}ms")
        meili_success = True
    except Exception as e:
        print(f"❌ Meilisearch failed: {e}")
        meili_success = False
    
    # Compare results
    if es_success and meili_success:
        print(f"\n📊 Comparison Summary:")
        print(f"  Elasticsearch: {es_result.total} hits, {es_result.took}ms")
        print(f"  Meilisearch: {meili_result.total} hits, {meili_result.took}ms")
        
        speed_winner = "Elasticsearch" if es_result.took < meili_result.took else "Meilisearch"
        count_winner = "Elasticsearch" if es_result.total > meili_result.total else "Meilisearch"
        
        print(f"  Faster: {speed_winner}")
        print(f"  More results: {count_winner}")


def main():
    """Main function to handle command line arguments"""
    parser = argparse.ArgumentParser(description="Search Engine Management Tool")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Health check command
    subparsers.add_parser("health", help="Check health of search engines")
    
    # Create index command
    subparsers.add_parser("create-index", help="Create Elasticsearch index")
    
    # Reindex command
    reindex_parser = subparsers.add_parser("reindex", help="Reindex data to search engines")
    reindex_parser.add_argument("--engine", default="all", 
                               choices=["all", "elasticsearch", "meilisearch"],
                               help="Which engine to reindex (default: all)")
    reindex_parser.add_argument("--batch-size", type=int, default=500,
                               help="Batch size for reindexing (default: 500)")
    
    # Test search command
    test_parser = subparsers.add_parser("test", help="Test search functionality")
    test_parser.add_argument("query", help="Search query to test")
    test_parser.add_argument("--engine", choices=["elasticsearch", "meilisearch"],
                            help="Force specific engine")
    
    # Switch engine command
    switch_parser = subparsers.add_parser("switch", help="Switch primary search engine")
    switch_parser.add_argument("engine", choices=["elasticsearch", "meilisearch"],
                              help="New primary engine")
    
    # Compare engines command
    compare_parser = subparsers.add_parser("compare", help="Compare search engines")
    compare_parser.add_argument("query", help="Search query to compare")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # Run the appropriate async function
    if args.command == "health":
        asyncio.run(check_health())
    elif args.command == "create-index":
        asyncio.run(create_elasticsearch_index())
    elif args.command == "reindex":
        asyncio.run(reindex_data(args.engine, args.batch_size))
    elif args.command == "test":
        asyncio.run(test_search(args.query, args.engine))
    elif args.command == "switch":
        asyncio.run(switch_primary_engine(args.engine))
    elif args.command == "compare":
        asyncio.run(compare_engines(args.query))


if __name__ == "__main__":
    main()