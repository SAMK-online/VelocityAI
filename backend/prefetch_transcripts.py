"""
Run this LOCALLY before deploying to Cloud Run.
YouTube blocks transcript scraping from GCP IPs, so we pre-cache them here.
Cached JSON files get bundled into the Docker image.

Usage:
    cd backend
    python prefetch_transcripts.py
"""

import json
import os
from pathlib import Path
from youtube_transcript_api import YouTubeTranscriptApi

VIDEO_IDS = [
    "KLlXCFG5TnA",  # Two Sum
    "WTzjTskDFMg",  # Valid Parentheses
    "G0_I-ZF0S38",  # Reverse Linked List
    "1pkOgXD63yU",  # Best Time to Buy and Sell Stock
    "3OamzN90kPg",  # Contains Duplicate
    "5WZl3MMT0Eg",  # Maximum Subarray
    "bNvIQI2wAjk",  # Product of Array Except Self
    "jzZsG8n2R9A",  # 3Sum
]

CACHE_DIR = Path(__file__).parent / "transcripts_cache"
CACHE_DIR.mkdir(exist_ok=True)


def fetch_and_cache(video_id: str):
    cache_file = CACHE_DIR / f"{video_id}.json"

    if cache_file.exists():
        print(f"  ✅ Already cached: {video_id}")
        return True

    try:
        segments = YouTubeTranscriptApi.get_transcript(video_id)
        data = {
            "video_id": video_id,
            "segments": [
                {"start": s["start"], "duration": s["duration"], "text": s["text"]}
                for s in segments
            ],
            "full_text": " ".join(s["text"] for s in segments),
        }
        with open(cache_file, "w") as f:
            json.dump(data, f, indent=2)
        print(f"  ✅ Fetched {len(segments)} segments: {video_id}")
        return True
    except Exception as e:
        print(f"  ❌ Failed {video_id}: {e}")
        return False


if __name__ == "__main__":
    print(f"Pre-fetching transcripts into {CACHE_DIR}\n")
    success = 0
    for vid in VIDEO_IDS:
        if fetch_and_cache(vid):
            success += 1

    print(f"\n{success}/{len(VIDEO_IDS)} transcripts cached.")
    print("Now redeploy to Cloud Run — transcripts will be bundled in the image.")
