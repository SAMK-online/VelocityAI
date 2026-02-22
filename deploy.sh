#!/bin/bash

# VelocityAI - Google Cloud Run Deployment Script
# This script deploys your application to Google Cloud Run

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 VelocityAI - Google Cloud Run Deployment${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed.${NC}"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-}"
SERVICE_NAME="velocityai"
REGION="${GCP_REGION:-us-central1}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Prompt for project ID if not set
if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}Enter your Google Cloud Project ID:${NC}"
    read -r PROJECT_ID
fi

# Set the project
echo -e "${GREEN}Setting GCP project to: ${PROJECT_ID}${NC}"
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo -e "${GREEN}Enabling required APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build the container image
echo -e "${GREEN}Building container image...${NC}"
gcloud builds submit --tag "$IMAGE_NAME"

# Load environment variables from .env
if [ -f "backend/.env" ]; then
    echo -e "${GREEN}Loading environment variables from backend/.env...${NC}"
    
    # Read API keys from .env
    GEMINI_API_KEY=$(grep GEMINI_API_KEY backend/.env | cut -d '=' -f2)
    GEMINI_MODEL=$(grep GEMINI_MODEL backend/.env | cut -d '=' -f2)
    ELEVENLABS_API_KEY=$(grep ELEVENLABS_API_KEY backend/.env | cut -d '=' -f2)
    ELEVENLABS_VOICE_ID=$(grep ELEVENLABS_VOICE_ID backend/.env | cut -d '=' -f2)
    
    ENV_VARS="GEMINI_API_KEY=${GEMINI_API_KEY}"
    [ -n "$GEMINI_MODEL" ] && ENV_VARS="${ENV_VARS},GEMINI_MODEL=${GEMINI_MODEL}"
    [ -n "$ELEVENLABS_API_KEY" ] && ENV_VARS="${ENV_VARS},ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}"
    [ -n "$ELEVENLABS_VOICE_ID" ] && ENV_VARS="${ENV_VARS},ELEVENLABS_VOICE_ID=${ELEVENLABS_VOICE_ID}"
else
    echo -e "${YELLOW}Warning: backend/.env file not found. You'll need to set environment variables manually.${NC}"
    ENV_VARS=""
fi

# Deploy to Cloud Run
echo -e "${GREEN}Deploying to Cloud Run...${NC}"
if [ -n "$ENV_VARS" ]; then
    gcloud run deploy "$SERVICE_NAME" \
        --image "$IMAGE_NAME" \
        --platform managed \
        --region "$REGION" \
        --allow-unauthenticated \
        --memory 1Gi \
        --cpu 1 \
        --timeout 300 \
        --set-env-vars "$ENV_VARS" \
        --max-instances 10 \
        --min-instances 0
else
    gcloud run deploy "$SERVICE_NAME" \
        --image "$IMAGE_NAME" \
        --platform managed \
        --region "$REGION" \
        --allow-unauthenticated \
        --memory 1Gi \
        --cpu 1 \
        --timeout 300 \
        --max-instances 10 \
        --min-instances 0
fi

# Get the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --platform managed --region "$REGION" --format 'value(status.url)')

echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo ""
echo -e "${GREEN}Your VelocityAI app is live at:${NC}"
echo -e "${YELLOW}${SERVICE_URL}${NC}"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Visit your app: $SERVICE_URL"
echo "2. Test the voice interface"
echo "3. Monitor logs: gcloud run logs tail $SERVICE_NAME --region=$REGION"
echo ""

if [ -z "$ENV_VARS" ]; then
    echo -e "${YELLOW}⚠️  Remember to set environment variables in Cloud Run console:${NC}"
    echo "   https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/environment-variables"
fi
