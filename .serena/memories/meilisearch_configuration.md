# Meilisearch Configuration & Management

## Service Details
- **Host**: http://localhost:7700
- **API Key**: 4C5kB2UQfoPHrelSBs2DqBDKQxJ0r7PxQ1lcwzNE908
- **Index Name**: segments
- **Current Documents**: 5,000 (needs full sync to 2.6M)

## Sync Scripts
### Manual Sync
```bash
MEILI_MASTER_KEY="4C5kB2UQfoPHrelSBs2DqBDKQxJ0r7PxQ1lcwzNE908" python backend/scripts/fixed_meili_sync.py --full-sync --batch-size 20000
```

### Automatic Sync Service
- **File**: `backend/scripts/auto_meili_sync.py`
- **Docker Service**: `meili-sync` (configured in docker-compose.yml)
- **Check Interval**: 60 seconds for new/updated segments
- **Batch Size**: 25,000 segments per batch

## Index Statistics Commands
```bash
curl -s "http://localhost:7700/indexes/segments/stats" -H "Authorization: Bearer 4C5kB2UQfoPHrelSBs2DqBDKQxJ0r7PxQ1lcwzNE908"
```

## Search Performance
- **Response Time**: 2-7ms consistently
- **Highlighting**: `<mark>` tags working properly
- **Pagination**: Supports up to 100 results per page
- **Total Results**: Limited by incomplete sync (need full 2.6M records)

## Known Issues
- **Incomplete Data**: Only 5,000 of 2.6M segments indexed
- **Missing segment_topics**: Fixed with empty arrays for frontend compatibility
- **Batch Processing**: Required for large datasets to avoid memory issues

## Configuration Files
- Search Service: `backend/src/services/optimized_search_service.py`
- Search Routes: `backend/src/routes/optimized_search.py`  
- Sync Scripts: `backend/scripts/fixed_meili_sync.py`, `backend/scripts/auto_meili_sync.py`
- Docker Config: `docker-compose.yml` (meili-sync service)