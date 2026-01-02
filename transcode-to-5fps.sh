#!/bin/bash

# FFmpeg transcoder to limit camera stream to 5 FPS
# This script pulls the RTSP stream, transcodes to 5 FPS, and outputs to MediaMTX

CAMERA_URL="rtsp://admin:L22CC619@192.168.1.8:554/cam/realmonitor?channel=1&subtype=0&unicast=true&proto=Onvif"
OUTPUT_URL="rtsp://localhost:8554/camera_5fps"

echo "🎥 Starting FFmpeg transcoder (5 FPS)"
echo "   Input:  $CAMERA_URL"
echo "   Output: $OUTPUT_URL"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg is not installed"
    echo "   Install with: sudo apt update && sudo apt install ffmpeg"
    exit 1
fi

# Run ffmpeg transcoder
ffmpeg -rtsp_transport tcp \
  -i "$CAMERA_URL" \
  -r 5 \
  -c:v libx264 \
  -preset ultrafast \
  -b:v 500k \
  -maxrate 500k \
  -bufsize 1000k \
  -g 10 \
  -c:a aac \
  -b:a 64k \
  -f rtsp \
  "$OUTPUT_URL"

