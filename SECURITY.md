# Security Documentation

This document outlines the security measures implemented in the Political Transcript Platform.

## Security Measures Implemented

### 1. Environment Variables Protection
- All `.env` files are now excluded from git tracking via `.gitignore`
- Secure `.env.example` templates provided with placeholder values
- Strong password/key generation recommended using `openssl rand`

### 2. Docker Container Security
- **Security Options**: `no-new-privileges:true` prevents privilege escalation
- **Capability Dropping**: All capabilities dropped by default with `cap_drop: ALL`
- **Minimal Capabilities**: Only essential capabilities added back (`CHOWN`, `SETUID`, `SETGID`)
- **User Restrictions**: PostgreSQL runs as non-root `postgres` user
- **Tmpfs Mount**: `/tmp` mounted with `noexec,nosuid` for security

### 3. Network Security
- Custom Docker network with controlled subnet (172.20.0.0/16)
- Service isolation within Docker network
- Port exposure limited to necessary services only

### 4. Cryptominer Removal
- Removed malicious processes: `kdevtmpfsi` and `kinsing`
- Clean PostgreSQL container rebuild from official image
- Malicious binaries removed from container filesystem

## Security Best Practices

### Environment Setup
```bash
# Generate secure keys
openssl rand -hex 32  # For Meilisearch master key
openssl rand -hex 32  # For application secret key
openssl rand -base64 32  # For database password
```

### Required Security Configuration
Before deployment, update these values in your `.env` file:
- `POSTGRES_PASSWORD`: Use strong random password
- `SECRET_KEY`: Use cryptographically secure random key
- `MEILI_MASTER_KEY`: Use secure random key for Meilisearch
- All API keys for external services (OpenAI, etc.)

### Container Security
- Containers run with minimal privileges
- No root access within containers
- Filesystem restrictions in place
- Network segmentation implemented

### Database Security
- PostgreSQL runs with security hardening
- Database password should be rotated regularly
- Connection limited to application containers only

## Monitoring and Alerts

### Process Monitoring
Monitor for suspicious processes:
```bash
# Check for cryptominer processes
ps aux | grep -E "(kdevtmpfsi|kinsing|xmrig|monero)"

# Monitor container processes
docker exec <container_name> ps aux
```

### File System Monitoring
Watch for unauthorized files in `/tmp` directories:
```bash
# Monitor container tmp directories
docker exec <container_name> ls -la /tmp/
```

## Incident Response

### If Cryptominer Detected
1. Immediately stop affected containers: `docker compose down`
2. Remove compromised volumes: `docker volume rm <volume_name>`
3. Rebuild containers from clean images
4. Scan host system for compromise
5. Review and rotate all secrets

### Recovery Steps
1. Kill malicious processes: `kill -9 <PID>`
2. Remove malicious binaries: `rm -f /tmp/suspicious_file`
3. Rebuild clean environment
4. Update all passwords and API keys
5. Review access logs for unauthorized access

## Regular Security Tasks

### Weekly
- Review container process lists
- Check for unauthorized network connections
- Monitor resource usage for anomalies

### Monthly
- Rotate database passwords
- Update container base images
- Review and update security policies
- Scan for vulnerabilities

### Immediately After Incidents
- Change all passwords and API keys
- Review access logs
- Update security measures
- Document lessons learned

## Additional Recommendations

1. **Host Security**: Keep host OS updated and secured
2. **Firewall**: Configure host firewall to restrict access
3. **Logging**: Implement centralized logging for audit trails
4. **Backups**: Regular encrypted backups of data volumes
5. **Access Control**: Limit SSH access and use key-based authentication
6. **Monitoring**: Implement resource monitoring and alerting