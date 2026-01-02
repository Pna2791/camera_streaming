# IP Camera Streaming - RTSP to WebRTC

A modern web application for streaming IP camera video using RTSP → WebRTC conversion with MediaMTX.

## Features

- ✅ **Low Latency**: ~200-500ms latency
- ✅ **Modern Web**: Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ **No Plugins**: Pure WebRTC, no Flash or plugins required
- ✅ **Secure**: RTSP stream is not exposed to the browser
- ✅ **Real-time**: Live video streaming with minimal delay

## Architecture

```
IMOU Camera (RTSP)
        ↓
  MediaMTX Server
        ↓
   WebRTC Stream
        ↓
    Browser
```

## Prerequisites

- Docker and Docker Compose installed
- IP camera with RTSP support
- Camera's RTSP URL (e.g., `rtsp://admin:password@192.168.1.100:554/stream1`)

## Quick Start

### 1. Configure Your Camera

Edit `mediamtx.yml` and update the camera source:

```yaml
paths:
  camera:
    source: rtsp://your-username:your-password@your-camera-ip:554/stream-path
```

**Common RTSP URL formats:**
- IMOU: `rtsp://admin:password@192.168.1.100:554/stream1`
- Hikvision: `rtsp://admin:password@192.168.1.100:554/Streaming/Channels/101`
- Dahua: `rtsp://admin:password@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0`

### 2. Start Services

```bash
docker compose up -d
```

This will start:
- **MediaMTX** on ports 8554 (RTSP) and 8555 (WebRTC)
- **Web Server** on port 8180

### 3. Open in Browser

Navigate to: **http://localhost:8180**

Click "Connect" to start streaming.

## Manual Setup (Without Docker)

### Install MediaMTX

```bash
# Download MediaMTX
wget https://github.com/bluenviron/mediamtx/releases/latest/download/mediamtx_v1.0.0_linux_amd64.tar.gz
tar -xzf mediamtx_v1.0.0_linux_amd64.tar.gz
sudo mv mediamtx /usr/local/bin/
```

### Configure MediaMTX

1. Edit `mediamtx.yml` with your camera RTSP URL
2. Start MediaMTX:
   ```bash
   mediamtx /path/to/mediamtx.yml
   ```

### Serve Web Files

You can use any web server:

```bash
# Using Python
python3 -m http.server 8080

# Using Node.js
npx http-server -p 8080

# Using Nginx (if installed)
sudo cp *.html *.css *.js /var/www/html/
```

## Configuration

### MediaMTX Settings

Key settings in `mediamtx.yml`:

- **RTSP Port**: Default `8554`
- **WebRTC Port**: Default `8555`
- **Source**: Your camera's RTSP URL
- **Authentication**: Add `sourceUser` and `sourcePass` if needed

### WebRTC Connection

The default WebRTC URL in the web interface is:
```
http://localhost:8555/camera
```

For remote access, change to:
```
http://your-server-ip:8555/camera
```

**Note**: Use `http://` or `https://` (not `ws://`). The WebRTC connection uses HTTP POST requests (WHEP protocol).

**Note**: For HTTPS/WSS, you'll need SSL certificates. See MediaMTX documentation.

## Troubleshooting

### Stream Not Connecting

1. **Check RTSP URL**: Verify your camera's RTSP URL is correct
   ```bash
   # Test RTSP stream
   ffplay rtsp://your-camera-url
   ```

2. **Check Firewall**: Ensure ports 8554, 8555, and 8180 are open

3. **Check MediaMTX Logs**:
   ```bash
   docker compose logs mediamtx
   ```

### Browser Issues

- **Chrome/Edge**: Should work out of the box
- **Firefox**: May need to enable WebRTC in settings
- **Safari**: Requires macOS 11+ or iOS 14+

### Low Quality or High Latency

- Check your network bandwidth
- Reduce camera resolution if needed
- Ensure MediaMTX and camera are on the same network

## Security Notes

- Change default passwords
- Use HTTPS/WSS for production (requires SSL certificates)
- Restrict access to MediaMTX ports (8554, 8555) via firewall
- Consider authentication for the web interface

## Advanced Usage

### Multiple Cameras

Add more paths in `mediamtx.yml`:

```yaml
paths:
  camera1:
    source: rtsp://camera1-ip:554/stream
  camera2:
    source: rtsp://camera2-ip:554/stream
```

Then connect to `ws://localhost:8555/camera1` or `ws://localhost:8555/camera2`

### Recording

Enable recording in `mediamtx.yml`:

```yaml
paths:
  camera:
    source: rtsp://...
    record: yes
    recordPath: /recordings
```

### Custom WebRTC Settings

Modify WebRTC configuration in `mediamtx.yml`:

```yaml
webrtcAddress: :8555
webrtcEncryption: "strict"  # or "no" for development
```

## Resources

- [MediaMTX Documentation](https://github.com/bluenviron/mediamtx)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [RTSP URL Formats](https://www.ispyconnect.com/sources.aspx)

## License

MIT

