FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY backend/app.py app.py
COPY frontend/ frontend/

# Set environment variables
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV WORKSPACE_DIR=/app

# Cloud Run expects the service to listen on the PORT environment variable
EXPOSE 8080

# Run the application with correct module path
CMD exec uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 1
