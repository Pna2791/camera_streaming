# Front-End Structure

## Directory Layout

```
front-end/
├── index.html              # Main streaming page
├── pages/
│   └── setup.html         # Camera setup page
├── css/
│   ├── styles.css         # Main styles (from original)
│   └── common.css         # Common styles and navigation
└── js/
    ├── webrtc-player.js   # WebRTC streaming player
    ├── navigation.js       # Navigation helper
    ├── camera-setup.js    # Camera setup and scanning
    └── stream-integration.js  # Integration between pages
```

## Features

### Main Stream Page (`index.html`)
- Live video streaming via WebRTC
- Connection controls
- Stream information display
- Navigation to setup page

### Setup Page (`pages/setup.html`)
- **Network Camera Scanner**: Scan local network for IP cameras
- **Manual Configuration**: Add camera with IP, username, password
- **Camera Management**: Save, edit, delete cameras
- **RTSP Path Presets**: Common camera types (Dahua, IMOU, Hikvision)
- **Integration**: Use saved cameras in stream page

## Navigation

Both pages include a top navigation bar:
- **📹 Stream**: Go to streaming page
- **⚙️ Setup**: Go to setup page

## Camera Scanning

The network scanner:
- Scans IP range (e.g., 192.168.1.0/24)
- Checks common RTSP ports (554, 8554, 1935)
- Detects camera types when possible
- Shows found cameras with "Use This Camera" button

**Note**: Full network scanning requires backend support. The current implementation uses browser-based checks which are limited by CORS policies. For production, consider adding a backend API for network scanning.

## Data Storage

Camera configurations are stored in browser `localStorage`:
- Key: `savedCameras` - Array of saved camera configurations
- Key: `selectedCamera` - Temporarily stores camera selected for streaming

## Usage

1. **Setup Camera**:
   - Go to Setup page
   - Scan network or manually enter camera details
   - Save camera configuration

2. **Stream Camera**:
   - Go to Stream page
   - Click "Use in Stream" from saved cameras
   - Or manually enter WebRTC URL
   - Click "Connect"

## Docker Configuration

The web server serves the entire `front-end/` directory:
- Nginx serves files from `/usr/share/nginx/html`
- All files are mounted read-only
- Access at: `http://localhost:8180`

