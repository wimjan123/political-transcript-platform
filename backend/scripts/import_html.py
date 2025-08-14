#!/usr/bin/env python3
"""
Script to import HTML transcript files into the database
"""
import asyncio
import argparse
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.services.import_service import ImportService
from src.config import settings


async def main():
    """Main import function"""
    parser = argparse.ArgumentParser(description="Import HTML transcript files")
    parser.add_argument(
        "--source-dir",
        default=settings.HTML_DATA_DIR,
        help=f"Source directory containing HTML files (default: {settings.HTML_DATA_DIR})"
    )
    parser.add_argument(
        "--file",
        help="Import single file instead of directory"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force reimport of existing files"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Verbose output"
    )
    
    args = parser.parse_args()
    
    # Validate source directory or file
    if args.file:
        if not os.path.exists(args.file):
            print(f"Error: File does not exist: {args.file}")
            sys.exit(1)
        if not args.file.endswith('.html'):
            print(f"Error: File must be an HTML file: {args.file}")
            sys.exit(1)
    else:
        if not os.path.exists(args.source_dir):
            print(f"Error: Source directory does not exist: {args.source_dir}")
            sys.exit(1)
        
        # Check if directory contains HTML files
        html_files = list(Path(args.source_dir).glob("*.html"))
        if not html_files:
            print(f"Error: No HTML files found in {args.source_dir}")
            sys.exit(1)
        
        print(f"Found {len(html_files)} HTML files in {args.source_dir}")
    
    # Create import service
    import_service = ImportService()
    
    def progress_callback(current: int, total: int, current_file: str, errors: list):
        """Progress callback for directory import"""
        if args.verbose:
            progress = (current / total) * 100 if total > 0 else 0
            print(f"Progress: {current}/{total} ({progress:.1f}%) - {Path(current_file).name}")
            if errors:
                print(f"Errors so far: {len(errors)}")
    
    try:
        if args.file:
            # Import single file
            print(f"Importing single file: {args.file}")
            result = await import_service.import_html_file(args.file, force_reimport=args.force)
            
            if result["success"]:
                print(f"✓ Successfully imported: {args.file}")
                if "segments_imported" in result:
                    print(f"  Segments imported: {result['segments_imported']}")
            else:
                print(f"✗ Failed to import: {args.file}")
                print(f"  Error: {result.get('error', 'Unknown error')}")
                sys.exit(1)
        
        else:
            # Import directory
            print(f"Starting import from directory: {args.source_dir}")
            print(f"Force reimport: {args.force}")
            
            result = await import_service.import_html_directory(
                args.source_dir,
                force_reimport=args.force,
                progress_callback=progress_callback if args.verbose else None
            )
            
            print("\nImport completed!")
            print(f"Total files: {result['total_files']}")
            print(f"Successfully imported: {result['total_processed']}")
            print(f"Failed: {result['total_failed']}")
            
            if result['errors']:
                print(f"\nErrors ({len(result['errors'])}):")
                for error in result['errors'][:10]:  # Show first 10 errors
                    print(f"  - {error}")
                if len(result['errors']) > 10:
                    print(f"  ... and {len(result['errors']) - 10} more errors")
    
    except KeyboardInterrupt:
        print("\nImport cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"Import failed with error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())