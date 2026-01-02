# Debugging Guide: "Failed to fetch" Error

## Step-by-Step Troubleshooting

### ✅ Step 1: Verify MediaMTX is Running
```bash
docker compose ps
docker logs mediamtx --tail 20
```

**Expected**: MediaMTX should show "ready: 3 tracks" if camera is connected.

### ✅ Step 2: Verify Camera Connection
Check MediaMTX logs for:
- ✅ `[path camera] [RTSP source] ready: 3 tracks` = Camera connected successfully
- ❌ `dial tcp: lookup` = Camera IP not reachable
- ❌ `401 Unauthorized` = Wrong camera credentials

### ✅ Step 3: Test WebRTC Endpoint
```bash
# Test if endpoint is accessible
curl -v http://localhost:8555/camera

# Test WHEP endpoint
curl -v -X POST http://localhost:8555/camera/whep -H "Content-Type: application/sdp" -d "test"
```

**Expected**: Should return HTTP response (even if 400 for invalid SDP).

### ✅ Step 4: Check Browser Console
1. Open browser: http://localhost:8180
2. Press F12 to open Developer Tools
3. Go to Console tab
4. Click "Connect"
5. Look for error messages

**Common errors:**
- `Failed to fetch` = CORS issue or network problem
- `CORS policy` = Cross-origin request blocked
- `NetworkError` = Cannot reach server

### ✅ Step 5: Verify URL Format
In the web interface, the Stream URL should be:
- ✅ `http://192.168.1.8:8555/camera` (if accessing from another device)
- ✅ `http://localhost:8555/camera` (if accessing from same machine)

**Important**: 
- Use `http://` not `ws://` or `wss://`
- Include the path `/camera` (matches path name in mediamtx.yml)

### ✅ Step 6: Check CORS Issues
If accessing from a different origin (e.g., `http://192.168.1.8:8180` connecting to `http://192.168.1.8:8555`), you may need to:

1. **Option A**: Access web interface from same origin
   - Use: `http://192.168.1.8:8180` and connect to `http://192.168.1.8:8555/camera`

2. **Option B**: Configure MediaMTX CORS (if supported)
   - Check MediaMTX documentation for CORS settings

3. **Option C**: Use a reverse proxy
   - Serve both web interface and MediaMTX from same origin

### ✅ Step 7: Test Network Connectivity
```bash
# From the server, test if you can reach MediaMTX
curl http://localhost:8555/camera

# From browser's machine, test if you can reach MediaMTX
# (replace with actual server IP)
curl http://192.168.1.8:8555/camera
```

### ✅ Step 8: Check Firewall
```bash
# Check if ports are open
sudo netstat -tuln | grep -E '8555|8180'

# Or use ss
sudo ss -tuln | grep -E '8555|8180'
```

### ✅ Step 9: Verify MediaMTX Configuration
Check `mediamtx.yml`:
```yaml
paths:
  camera:  # This name must match URL path
    source: rtsp://admin:password@192.168.1.8:554/...
```

The path name `camera` must match the URL: `http://...:8555/camera`

## Common Solutions

### Solution 1: Use Same Origin
If accessing from browser on same machine:
- Web interface: `http://localhost:8180`
- Stream URL: `http://localhost:8555/camera`

### Solution 2: Fix CORS (if accessing from different machine)
Access web interface using the server's IP:
- Web interface: `http://192.168.1.8:8180`
- Stream URL: `http://192.168.1.8:8555/camera`

### Solution 3: Check Browser Console
Open F12 → Console tab and look for detailed error messages.

### Solution 4: Verify MediaMTX is Listening
```bash
docker logs mediamtx | grep "WebRTC"
# Should show: [WebRTC] listener opened on :8555
```

## Quick Test Script
Run the verification script:
```bash
./verify-connection.sh
```

This will check all components step by step.

