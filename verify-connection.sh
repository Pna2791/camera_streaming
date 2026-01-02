#!/bin/bash

# Step-by-step connection verification script

echo "🔍 IP Camera Streaming - Connection Verification"
echo "=================================================="
echo ""

# Step 1: Check Docker services
echo "📦 Step 1: Checking Docker services..."
if docker compose ps | grep -q "mediamtx.*Up"; then
    echo "   ✅ MediaMTX container is running"
else
    echo "   ❌ MediaMTX container is NOT running"
    echo "   Run: docker compose up -d"
    exit 1
fi

if docker compose ps | grep -q "camera-streaming-web.*Up"; then
    echo "   ✅ Web server container is running"
else
    echo "   ❌ Web server container is NOT running"
    echo "   Run: docker compose up -d"
    exit 1
fi
echo ""

# Step 2: Check MediaMTX configuration
echo "⚙️  Step 2: Checking MediaMTX configuration..."
if grep -q "rtsp://.*192.168.1.8" mediamtx.yml; then
    echo "   ✅ Camera IP configured in mediamtx.yml"
    CAMERA_URL=$(grep "source:" mediamtx.yml | head -1 | sed 's/.*source: //')
    echo "   📹 Camera URL: $CAMERA_URL"
else
    echo "   ❌ Camera IP not found in mediamtx.yml"
    echo "   Please update the 'source' field with your camera RTSP URL"
    exit 1
fi
echo ""

# Step 3: Check MediaMTX logs for camera connection
echo "📋 Step 3: Checking MediaMTX logs (last 10 lines)..."
echo "   Recent logs:"
docker logs mediamtx --tail 10 2>&1 | sed 's/^/   /'
echo ""

# Step 4: Test RTSP connection to camera
echo "🔌 Step 4: Testing RTSP connection to camera..."
CAMERA_IP=$(echo "$CAMERA_URL" | grep -oP 'rtsp://[^@]+@\K[^:/]+' || echo "$CAMERA_URL" | grep -oP 'rtsp://\K[^:/]+')
if [ -z "$CAMERA_IP" ]; then
    CAMERA_IP="192.168.1.8"
fi

echo "   Testing connectivity to $CAMERA_IP:554..."
if timeout 3 bash -c "cat < /dev/null > /dev/tcp/$CAMERA_IP/554" 2>/dev/null; then
    echo "   ✅ Port 554 is reachable"
else
    echo "   ⚠️  Cannot reach port 554 (camera may be offline or firewall blocking)"
fi
echo ""

# Step 5: Check MediaMTX WebRTC endpoint
echo "🌐 Step 5: Checking MediaMTX WebRTC endpoint..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8555/camera 2>/dev/null | grep -q "200\|404\|405"; then
    echo "   ✅ WebRTC endpoint is responding"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8555/camera 2>/dev/null)
    echo "   HTTP Status: $HTTP_CODE"
else
    echo "   ❌ WebRTC endpoint not responding"
    echo "   Check if MediaMTX is listening on port 8555"
fi
echo ""

# Step 6: Check web server
echo "🖥️  Step 6: Checking web server..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8180 2>&1 | grep -q "200"; then
    echo "   ✅ Web server is responding on port 8180"
else
    echo "   ❌ Web server not responding"
fi
echo ""

# Step 7: Check ports
echo "🔌 Step 7: Checking open ports..."
echo "   Port 8554 (RTSP): $(netstat -tuln 2>/dev/null | grep ':8554' > /dev/null && echo '✅ Open' || echo '❌ Not found')"
echo "   Port 8555 (WebRTC): $(netstat -tuln 2>/dev/null | grep ':8555' > /dev/null && echo '✅ Open' || echo '❌ Not found')"
echo "   Port 8180 (Web): $(netstat -tuln 2>/dev/null | grep ':8180' > /dev/null && echo '✅ Open' || echo '❌ Not found')"
echo ""

# Step 8: Test camera RTSP stream directly (if ffmpeg/ffplay available)
echo "🎥 Step 8: Testing camera RTSP stream (if tools available)..."
if command -v ffprobe &> /dev/null; then
    echo "   Testing RTSP stream with ffprobe..."
    timeout 5 ffprobe -v error -show_entries stream=codec_name "$CAMERA_URL" 2>&1 | head -5 | sed 's/^/   /'
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        echo "   ✅ Camera RTSP stream is accessible"
    else
        echo "   ❌ Cannot access camera RTSP stream"
    fi
else
    echo "   ⚠️  ffprobe not installed (optional - install with: apt install ffmpeg)"
fi
echo ""

# Summary
echo "📊 Summary:"
echo "   - Open browser: http://localhost:8180"
echo "   - Stream URL: http://192.168.1.8:8555/camera"
echo "   - Check browser console (F12) for detailed errors"
echo ""

