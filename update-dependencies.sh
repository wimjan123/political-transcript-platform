#!/bin/bash
# Script to update Docker container with new dependencies

echo "Updating Docker container with new Python dependencies..."

# Stop services
docker-compose down

# Update the API container with new dependencies
docker-compose exec api pip install openai yt-dlp moviepy

# Restart services
docker-compose up -d

echo "Dependencies updated! Restart the API service to pick up changes:"
echo "make restart-api"