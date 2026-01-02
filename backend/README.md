# Camera Streaming API

Backend API service for camera streaming setup and testing.

## Features

- **RTSP Connection Testing**: Test RTSP camera connections using ffprobe
- **Stream Information**: Get video/audio codec, resolution, and FPS information
- **Health Checks**: Monitor API service status

## Endpoints

### POST `/api/test-rtsp`
Test RTSP connection and get stream information.

**Request:**
```json
{
  "rtspUrl": "rtsp://admin:password@192.168.1.8:554/stream1"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "RTSP connection successful!",
  "streams": {
    "video": {
      "codec": "h264",
      "resolution": "1920x1080",
      "fps": "25/1"
    },
    "audio": {
      "codec": "aac"
    }
  },
  "connectionTime": 1234
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Connection timeout. Camera may be offline or unreachable.",
  "suggestion": "Check camera IP address and network connectivity"
}
```

### GET `/api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "camera-streaming-api",
  "timestamp": "2026-01-02T07:00:00.000Z"
}
```

### GET `/api/check-ffprobe`
Check if ffprobe is available.

**Response:**
```json
{
  "available": true,
  "path": "/usr/bin/ffprobe",
  "version": "ffprobe version 5.1.2"
}
```

## Requirements

- Node.js 18+
- ffmpeg (includes ffprobe) - installed in Docker container

## Usage

The API is automatically started with Docker Compose:

```bash
docker compose up -d api
```

Access the API at: `http://localhost:3000`

## Error Handling

The API provides detailed error messages:
- **401 Unauthorized**: Wrong username/password
- **404 Not Found**: Invalid RTSP path
- **Timeout**: Camera unreachable or offline
- **ffprobe not found**: ffmpeg not installed

## Integration

The front-end setup page automatically uses this API when testing camera connections. The API URL is detected from the current hostname.

