# KotobaMichi Backend - Migration & Deployment Guide

This guide covers database migrations, Docker containerization, and deployment strategies for the KotobaMichi backend.

## 🗄️ Database Migration System

### Automated Docker Migration

The project now includes a **dedicated migration Docker container** that automatically runs database migrations before the application starts.

#### Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   Migration     │    │   Application   │
│   Database      │ <- │   Container     │ <- │   Container     │
│                 │    │ (runs once)     │    │ (starts after)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Quick Start

1. **Start everything with Docker Compose:**
   ```bash
   docker-compose up --build
   ```

2. **For production deployment:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### How It Works

1. **Database** starts and becomes healthy
2. **Migration container** runs `prisma migrate deploy`
3. **App container** starts after migrations complete successfully
4. All containers share the same Docker network for communication

```bash
# Start all services (database, migrations, then app)
docker-compose up -d

# View migration logs
docker-compose logs migration

# Run migrations only
docker-compose up migration

# Force rebuild migration image
docker-compose build migration
```

## Manual Migration Running

### Using the Script (Recommended)

```bash
# Run migrations using the published image
./scripts/run-migrations.sh \
  --repository "niraj-dilshan/kotobamichi-backend" \
  --database-url "postgresql://user:pass@host:5432/dbname"

# Run migrations with specific tag
./scripts/run-migrations.sh \
  --repository "niraj-dilshan/kotobamichi-backend" \
  --tag "v1.2.3" \
  --database-url "postgresql://user:pass@host:5432/dbname"
```

### Using Docker Directly

```bash
# Pull and run the migration image
docker run --rm \
  -e DATABASE_URL="postgresql://user:pass@host:5432/dbname" \
  ghcr.io/niraj-dilshan/kotobamichi-backend-migration:latest
```

## GitHub Container Registry

The GitHub workflow automatically builds and publishes two images:

1. **Main Application**: `ghcr.io/niraj-dilshan/kotobamichi-backend:latest`
2. **Migrations**: `ghcr.io/niraj-dilshan/kotobamichi-backend-migration:latest`

Both images are built for multiple architectures (linux/amd64, linux/arm64).

## Environment Variables

The migration image requires:

- `DATABASE_URL`: PostgreSQL connection string

Example:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/kotobamichi
```

## CI/CD Integration

### In GitHub Actions

```yaml
- name: Run Database Migrations
  run: |
    docker run --rm \
      -e DATABASE_URL="${{ secrets.DATABASE_URL }}" \
      ghcr.io/${{ github.repository }}-migration:latest
```

### In Kubernetes

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: migration-job
spec:
  template:
    spec:
      containers:
      - name: migration
        image: ghcr.io/niraj-dilshan/kotobamichi-backend-migration:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: database-url
      restartPolicy: OnFailure
```

## Development

### Building Locally

```bash
# Build migration image
docker build -f Dockerfile.migration -t kotobamichi-migration .

# Run locally
docker run --rm \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/kotobamichi" \
  kotobamichi-migration
```

### Adding New Migrations

1. Create migration using Prisma CLI:
   ```bash
   npx prisma migrate dev --name your_migration_name
   ```

2. The migration will be automatically included in the next Docker build

3. Test the migration:
   ```bash
   docker-compose build migration
   docker-compose up migration
   ```

## Troubleshooting

### Common Issues

1. **Migration fails**: Check database connectivity and credentials
2. **Permission denied**: Ensure the container has proper database permissions
3. **Migration already exists**: Prisma tracks applied migrations automatically

### Debugging

```bash
# Check migration status
docker run --rm \
  -e DATABASE_URL="your_database_url" \
  ghcr.io/niraj-dilshan/kotobamichi-backend-migration:latest \
  npx prisma migrate status

# Reset database (development only!)
docker run --rm \
  -e DATABASE_URL="your_database_url" \
  ghcr.io/niraj-dilshan/kotobamichi-backend-migration:latest \
  npx prisma migrate reset --force
```
