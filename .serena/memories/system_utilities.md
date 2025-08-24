# System Utilities and Commands

## Linux System Context
This project runs on Linux systems with standard Unix utilities available.

## Essential System Commands
```bash
# Navigation and file operations
ls -la                  # List files with details
cd directory           # Change directory
pwd                     # Show current directory
mkdir -p path          # Create directories recursively
rm -rf path            # Remove files/directories
cp -r source dest      # Copy files recursively
mv source dest         # Move/rename files

# File content operations
cat file               # Display file contents
head -n 20 file        # Show first 20 lines
tail -f file           # Follow file changes (logs)
grep "pattern" file    # Search for patterns
find . -name "*.py"    # Find files by pattern

# Process management
ps aux                 # Show all processes
kill -9 PID           # Force kill process
pkill -f "process"    # Kill by process name
lsof -i :8000         # Show what's using port 8000

# Network and service checking
curl http://localhost:8000/health  # Test API endpoint
netstat -tlnp         # Show listening ports
docker ps             # Show running containers
docker logs container # View container logs
```

## Git Operations
```bash
git status            # Check working tree status
git branch            # List branches
git checkout -b feature/name  # Create feature branch
git add .             # Stage all changes
git commit -m "message"  # Commit changes
git push origin branch   # Push to remote
git pull origin main     # Pull latest changes
git log --oneline -10    # Recent commits
```

## Docker Operations
```bash
docker ps             # List running containers
docker ps -a          # List all containers
docker images         # List images
docker exec -it container bash  # Enter container shell
docker compose up -d  # Start services in background
docker compose down   # Stop all services
docker compose logs service  # View service logs
docker system prune -f  # Clean up unused resources
```

## File Permissions and Ownership
```bash
chmod +x script.sh    # Make file executable
chmod 755 file        # Set standard permissions
chown user:group file # Change ownership
sudo command          # Run as root
```

## Text Processing
```bash
awk 'pattern {action}' file  # Text processing
sed 's/old/new/g' file      # Find and replace
sort file                   # Sort lines
uniq file                   # Remove duplicates
wc -l file                  # Count lines
```

## System Monitoring
```bash
htop                  # Interactive process viewer
df -h                 # Disk space usage
du -sh directory      # Directory size
free -h               # Memory usage
iostat                # I/O statistics
```