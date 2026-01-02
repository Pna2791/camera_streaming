#!/bin/bash

# IP Camera Streaming - Quick Start Script

echo "📹 IP Camera Streaming Setup"
echo "=============================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed (v2 plugin)
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if mediamtx.yml exists
if [ ! -f "mediamtx.yml" ]; then
    echo "❌ mediamtx.yml not found!"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Check if camera source is configured
if grep -q "rtsp://your-camera-ip" mediamtx.yml; then
    echo "⚠️  WARNING: Please configure your camera RTSP URL in mediamtx.yml"
    echo "   Edit mediamtx.yml and update the 'source' field with your camera's RTSP URL"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "🚀 Starting services..."
docker compose up -d

echo ""
echo "✅ Services started!"
echo ""
echo "📺 Open your browser at: http://localhost:8180"
echo ""
echo "To view logs: docker compose logs -f"
echo "To stop: docker compose down"
echo ""

