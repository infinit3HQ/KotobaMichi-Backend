#!/bin/bash

# Migration runner script
# This script can be used to run migrations in different environments

set -e

# Default values
IMAGE_TAG="latest"
REGISTRY="ghcr.io"
REPOSITORY=""
DATABASE_URL=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --registry)
      REGISTRY="$2"
      shift 2
      ;;
    --repository)
      REPOSITORY="$2"
      shift 2
      ;;
    --database-url)
      DATABASE_URL="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  --tag TAG              Docker image tag (default: latest)"
      echo "  --registry REGISTRY    Container registry (default: ghcr.io)"
      echo "  --repository REPO      Repository name (required)"
      echo "  --database-url URL     Database connection URL (required)"
      echo "  --help                 Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Validate required parameters
if [ -z "$REPOSITORY" ]; then
  echo "Error: --repository is required"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: --database-url is required"
  exit 1
fi

# Construct full image name
FULL_IMAGE_NAME="${REGISTRY}/${REPOSITORY}-migration:${IMAGE_TAG}"

echo "Running migrations..."
echo "Image: $FULL_IMAGE_NAME"
echo "Database URL: ${DATABASE_URL:0:20}..." # Only show first 20 chars for security

# Run the migration container
docker run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  "$FULL_IMAGE_NAME"

echo "Migrations completed successfully!"
