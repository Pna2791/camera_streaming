# Fixing Stuttering/Freezing Issues (Every 7-8 Seconds)

## Problem
Stream stutters or freezes every 7-8 seconds, with RTP packet loss warnings in logs.

## Applied Fixes

### ✅ 1. Force TCP Transport (Applied)
- Changed from UDP/TCP automatic to TCP only
- TCP is more reliable and reduces packet loss
- **File**: `mediamtx.yml` - `rtspTransport: tcp`

### ✅ 2. Optimized WebRTC Player (Applied)
- Enhanced RTCPeerConnection settings for better performance
- Added video playback optimizations
- **File**: `webrtc-player.js`

## Additional Recommendations

### Option 1: Reduce Camera Resolution/Frame Rate
If stuttering persists, reduce the camera's output settings:

1. Access camera web interface: `http://192.168.1.8`
2. Go to Video/Stream settings
3. Reduce:
   - **Resolution**: Try 720p or 480p instead of 1080p
   - **Frame Rate**: Set to 15-20 FPS (or 5 FPS if you want lower)
   - **Bitrate**: Reduce if available

### Option 2: Use FFmpeg Transcoder
Use the transcoder to optimize the stream before MediaMTX:

```bash
# Install ffmpeg if needed
sudo apt update && sudo apt install ffmpeg

# Run transcoder with optimized settings
./transcode-to-5fps.sh
```

Then update `mediamtx.yml`:
```yaml
source: rtsp://localhost:8554/camera_5fps
```

### Option 3: Check Network
```bash
# Test network latency to camera
ping -c 10 192.168.1.8

# Check for packet loss
mtr 192.168.1.8
```

### Option 4: Camera Settings
Check your camera's advanced settings:
- **GOP (Group of Pictures)**: Set to 30-60 frames
- **Keyframe Interval**: Should match or be less than GOP
- **Encoding**: Use H.264 baseline profile for lower CPU usage

## Monitoring

Watch MediaMTX logs for improvements:
```bash
docker logs mediamtx -f | grep -E "(WAR|ERR|packet)"
```

**Good signs:**
- No "RTP packet lost" warnings
- No "processing errors"
- Stream shows "ready: 3 tracks" consistently

**Bad signs:**
- Frequent "RTP packet lost" warnings
- "processing errors" appearing
- Stream disconnects/reconnects

## Current Status

After applying fixes:
- ✅ TCP transport enabled (more reliable)
- ✅ WebRTC player optimized
- ⚠️ Monitor logs for packet loss reduction

If stuttering continues, try reducing camera resolution/bitrate or using the transcoder.

