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

## 🐳 Docker Configuration

### Files Overview

- `Dockerfile` - Main application container
- `Dockerfile.migration` - Lightweight migration container
- `docker-compose.yml` - Local development setup
- `docker-compose.override.yml` - Development overrides
- `docker-compose.prod.yml` - Production deployment

### Migration Container Features

- **Lightweight**: Alpine-based Node.js image
- **Fast**: Only installs dependencies needed for Prisma
- **Secure**: Runs as non-root user
- **Reliable**: Exits cleanly after successful migration

## 🚀 GitHub Container Registry Setup

### Automated Builds

The GitHub Actions workflow (`.github/workflows/docker-publish.yml`) automatically:

1. **Builds both images** (app + migration) on push to `production` branch
2. **Pushes to GitHub Container Registry** with proper tags
3. **Supports multi-architecture** (AMD64 + ARM64)
4. **Uses build caching** for faster builds

### Manual Deployment

#### Using Production Images

1. **Create production environment file:**
   ```bash
   cp .env.example .env.prod
   # Edit .env.prod with production values
   ```

2. **Deploy with production compose:**
   ```bash
   docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
   ```

#### Building Locally for Production

```bash
# Build both images
docker-compose -f docker-compose.prod.yml build

# Push to registry (requires authentication)
docker-compose -f docker-compose.prod.yml push
```

## 🔧 Development Commands

### NPM Scripts

```bash
# Run migrations in development
npm run migrate

# Create new migration
npm run migrate:create

# Reset database (development only)
npm run migrate:reset

# Deploy migrations (production)
npm run migrate:deploy
```

### Manual Migration Commands

```bash
# Run migrations directly
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Generate Prisma client
npx prisma generate
```

## 🏗️ Migration Best Practices

### Creating Migrations

1. **Make schema changes** in `prisma/schema.prisma`
2. **Generate migration:**
   ```bash
   npx prisma migrate dev --name descriptive_migration_name
   ```
3. **Test locally** before deploying
4. **Commit both schema and migration files**

### Production Deployment

1. **Never run `migrate dev` in production**
2. **Always use `migrate deploy` for production**
3. **Backup database** before major migrations
4. **Test migrations** on staging environment first

## 🔐 Environment Variables

### Required Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Authentication
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
JWT_EXPIRES_IN=7d

# Admin Account (for initial setup)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=SecurePassword123!

# Server
PORT=3000
NODE_ENV=production
```

### Docker Environment Variables

```env
# PostgreSQL Container
POSTGRES_DB=kotobamichi
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password

# Application
DATABASE_URL=postgresql://postgres:your-secure-password@db:5432/kotobamichi
```

## 🚨 Troubleshooting

### Migration Issues

**Problem**: Migration container fails
```bash
# Check migration logs
docker-compose logs migration

# Run migration manually
docker-compose run --rm migration npx prisma migrate status
```

**Problem**: App can't connect to database
```bash
# Check database health
docker-compose ps
docker-compose logs db

# Verify DATABASE_URL format
echo $DATABASE_URL
```

### Build Issues

**Problem**: Docker build fails
```bash
# Clean build cache
docker system prune -f
docker-compose build --no-cache

# Check for missing files
ls -la Dockerfile*
```

## 🌐 Production Deployment

### VPS/Server Deployment

1. **Clone repository:**
   ```bash
   git clone https://github.com/Niraj-Dilshan/KotobaMichi-Backend.git
   cd KotobaMichi-Backend
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env.prod
   # Edit .env.prod with production values
   ```

3. **Deploy:**
   ```bash
   docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
   ```

4. **Monitor:**
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f
   ```

### Health Checks

The application includes health checks at:
- **Container level**: Built into Docker Compose
- **Application level**: `GET /v1/health`

### SSL/HTTPS

For production, use a reverse proxy like Nginx or Traefik:

```nginx
server {
    listen 443 ssl;
    server_name api.kotobamichi.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📊 Monitoring

### Application Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f migration
docker-compose logs -f db
```

### Database Monitoring

```bash
# Connect to PostgreSQL
docker-compose exec db psql -U postgres -d kotobamichi

# Check table sizes
\dt+

# Monitor connections
SELECT * FROM pg_stat_activity;
```

## 🔄 Updates & Maintenance

### Updating Application

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Restart with zero downtime
docker-compose -f docker-compose.prod.yml up -d --remove-orphans
```

### Backup Strategy

```bash
# Database backup
docker-compose exec db pg_dump -U postgres kotobamichi > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker-compose exec -T db psql -U postgres kotobamichi < backup_file.sql
```

---

**🎯 Key Benefits:**

- ✅ **Automated migrations** - No manual intervention needed
- ✅ **Zero-downtime updates** - Rolling deployment support
- ✅ **Production-ready** - Multi-stage builds with security
- ✅ **Container registry** - Automated builds and distribution
- ✅ **Health monitoring** - Built-in health checks
- ✅ **Environment isolation** - Clean separation of dev/prod configs
