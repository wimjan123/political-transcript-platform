#!/usr/bin/env python3
"""
Standalone migration script to make video_seconds nullable
"""
import psycopg2
import os

def apply_migration():
    # Get database connection details
    db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5433/political_transcripts')
    
    # Parse the URL
    # Format: postgresql://user:pass@host:port/db
    parts = db_url.replace('postgresql://', '').split('@')
    user_pass = parts[0].split(':')
    host_port_db = parts[1].split('/')
    host_port = host_port_db[0].split(':')
    
    user = user_pass[0]
    password = user_pass[1]
    host = host_port[0]
    port = host_port[1]
    database = host_port_db[1]
    
    try:
        # Connect to PostgreSQL
        conn = psycopg2.connect(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password
        )
        
        cursor = conn.cursor()
        
        # Check if the constraint exists
        cursor.execute("""
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'transcript_segments' 
            AND column_name = 'video_seconds' 
            AND is_nullable = 'NO';
        """)
        
        if cursor.fetchone():
            print("Found NOT NULL constraint on video_seconds, removing it...")
            # Apply the migration
            cursor.execute("ALTER TABLE transcript_segments ALTER COLUMN video_seconds DROP NOT NULL;")
            conn.commit()
            print("✓ Migration applied successfully: video_seconds is now nullable")
        else:
            print("✓ video_seconds column is already nullable or does not exist")
        
        # Check if video_thumbnail_url column exists
        cursor.execute("""
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'videos' 
            AND column_name = 'video_thumbnail_url';
        """)
        
        if not cursor.fetchone():
            print("Adding video_thumbnail_url column to videos table...")
            cursor.execute("ALTER TABLE videos ADD COLUMN video_thumbnail_url VARCHAR(500);")
            conn.commit()
            print("✓ Migration applied successfully: video_thumbnail_url column added")
        else:
            print("✓ video_thumbnail_url column already exists")
        
        cursor.close()
        conn.close()
        
    except psycopg2.Error as e:
        print(f"Database error: {e}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    apply_migration()