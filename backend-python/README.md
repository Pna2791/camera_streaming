# Python FastAPI Backend for Klipper Controller

This is a Python FastAPI backend to replace the Node.js backend for Klipper printer management.

## Features

- **Network Scanning**: Scan local network for Klipper printers using Moonraker API
- **Moonraker Proxy**: Proxy requests to Moonraker API (port 7125)
- **FastAPI**: Modern, fast Python web framework
- **Async/Await**: Non-blocking I/O for efficient network scanning

## Quick Start

### Test the Scanner Script

```bash
# Test a single IP
python3 test_scan.py 192.168.1.17

# Scan a network range
python3 scan_printers.py 192.168.1.1-254
```

### Run the FastAPI Server

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn main:app --host 0.0.0.0 --port 3000 --reload
```

### API Endpoints

- `GET /api/health` - Health check
- `POST /api/scan-printers` - Scan network for printers
- `GET /api/moonraker/{ip}/{path}` - Proxy to Moonraker API

### Example Usage

```bash
# Scan network
curl -X POST http://localhost:3000/api/scan-printers \
  -H "Content-Type: application/json" \
  -d '{"ipRange": "192.168.1.1-254"}'

# Check Moonraker server info
curl http://localhost:3000/api/moonraker/192.168.1.17/server/info
```

## Docker

```bash
# Build
docker build -t camera-streaming-api-python .

# Run
docker run -p 3000:3000 --network host camera-streaming-api-python
```

