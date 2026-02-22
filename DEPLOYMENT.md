# VelocityAI - Google Cloud Run Deployment Guide

## Prerequisites

1. **Google Cloud Account**
   - Sign up at https://cloud.google.com
   - You get $300 in free credits for new accounts

2. **Google Cloud CLI (gcloud)**
   - Install from: https://cloud.google.com/sdk/docs/install
   - After installation, run: `gcloud init`

3. **Create a Google Cloud Project**
   ```bash
   gcloud projects create velocityai-prod --name="VelocityAI"
   ```

## Quick Deploy (Recommended)

Run the automated deployment script:

```bash
./deploy.sh
```

The script will:
- ✅ Enable required Google Cloud APIs
- ✅ Build your container image
- ✅ Deploy to Cloud Run
- ✅ Set up environment variables from your .env file
- ✅ Configure auto-scaling
- ✅ Give you the live URL

## Manual Deployment

If you prefer to deploy manually:

### Step 1: Set your project
```bash
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID
```

### Step 2: Enable APIs
```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### Step 3: Build the container
```bash
gcloud builds submit --tag gcr.io/$PROJECT_ID/velocityai
```

### Step 4: Deploy to Cloud Run
```bash
gcloud run deploy velocityai \
  --image gcr.io/$PROJECT_ID/velocityai \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --set-env-vars GEMINI_API_KEY=your_key_here,ELEVENLABS_API_KEY=your_key_here
```

### Step 5: Get your URL
```bash
gcloud run services describe velocityai \
  --platform managed \
  --region us-central1 \
  --format 'value(status.url)'
```

## Environment Variables

Make sure to set these in Cloud Run:

### Required:
- `GEMINI_API_KEY` - Your Google Gemini API key
- `GEMINI_MODEL` - Model to use (default: gemini-2.5-flash)

### Optional:
- `ELEVENLABS_API_KEY` - For premium voice synthesis
- `ELEVENLABS_VOICE_ID` - Voice to use for TTS

You can set these via:
1. The deployment script (reads from backend/.env)
2. Cloud Run console: https://console.cloud.google.com/run
3. Using gcloud CLI:
   ```bash
   gcloud run services update velocityai \
     --region us-central1 \
     --set-env-vars GEMINI_API_KEY=your_key
   ```

## Monitoring & Logs

### View live logs:
```bash
gcloud run logs tail velocityai --region=us-central1
```

### View in Cloud Console:
https://console.cloud.google.com/run

## Scaling Configuration

Cloud Run automatically scales based on traffic:
- **Min instances**: 0 (scales to zero when not in use - saves money!)
- **Max instances**: 10 (can handle burst traffic)
- **Memory**: 1GB
- **CPU**: 1 vCPU
- **Timeout**: 300 seconds (5 minutes)

### To update scaling:
```bash
gcloud run services update velocityai \
  --region us-central1 \
  --max-instances 20 \
  --min-instances 1
```

## Cost Estimates

Cloud Run pricing (as of 2026):
- **Free tier**: 2 million requests/month
- **CPU**: $0.00002400/vCPU-second
- **Memory**: $0.00000250/GiB-second
- **Requests**: $0.40/million requests

Estimated cost for moderate usage (~1000 users/month): **$5-20/month**

If your app scales to zero when idle, you only pay when it's being used! 🎉

## Custom Domain (Optional)

### Step 1: Map domain
```bash
gcloud run domain-mappings create \
  --service velocityai \
  --domain your-domain.com \
  --region us-central1
```

### Step 2: Update DNS
Follow the instructions to add DNS records at your domain registrar.

## Troubleshooting

### Build fails
- Check your Dockerfile syntax
- Ensure all dependencies are in requirements.txt

### Deployment fails
- Verify your project ID is correct
- Check that billing is enabled
- Ensure APIs are enabled

### App doesn't start
- Check logs: `gcloud run logs tail velocityai --region=us-central1`
- Verify environment variables are set
- Check that PORT environment variable is being used

### WebSocket issues
- Cloud Run supports WebSockets! No special configuration needed
- Ensure your client connects via wss:// (not ws://)

## Updating Your App

To deploy updates:

1. Make your code changes
2. Run the deployment script again:
   ```bash
   ./deploy.sh
   ```

Or manually:
```bash
gcloud builds submit --tag gcr.io/$PROJECT_ID/velocityai
gcloud run deploy velocityai --image gcr.io/$PROJECT_ID/velocityai --region us-central1
```

## CI/CD (Optional)

Set up automatic deployments on git push using Cloud Build:

1. Create `cloudbuild.yaml`:
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/velocityai', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/velocityai']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'velocityai'
      - '--image'
      - 'gcr.io/$PROJECT_ID/velocityai'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
```

2. Connect your GitHub repo in Cloud Build console

## Support

- **Cloud Run Docs**: https://cloud.google.com/run/docs
- **Pricing Calculator**: https://cloud.google.com/products/calculator

---

🚀 **Ready to deploy?** Run `./deploy.sh` and you'll be live in minutes!
