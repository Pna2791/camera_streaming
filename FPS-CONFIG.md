# Setting Frame Rate to 5 FPS

There are two ways to limit the frame rate to 5 FPS:

## Option 1: Configure Camera (Recommended - Simplest)

Configure your IP camera to output 5 FPS directly:

1. Access your camera's web interface (usually `http://192.168.1.8`)
2. Navigate to Video/Stream settings
3. Set Frame Rate to 5 FPS
4. Save and apply settings

This is the most efficient method as it reduces bandwidth at the source.

## Option 2: Use FFmpeg Transcoder (If camera doesn't support FPS limiting)

If your camera doesn't support frame rate limiting, you can use an FFmpeg transcoder:

### Step 1: Install FFmpeg on the host system
```bash
sudo apt update
sudo apt install ffmpeg
```

### Step 2: Create a transcoder script
Create a file `transcode-stream.sh`:
```bash
#!/bin/bash
ffmpeg -rtsp_transport tcp \
  -i "rtsp://admin:L22CC619@192.168.1.8:554/cam/realmonitor?channel=1&subtype=0&unicast=true&proto=Onvif" \
  -r 5 \
  -c:v libx264 \
  -preset ultrafast \
  -b:v 500k \
  -c:a aac \
  -b:a 64k \
  -f rtsp \
  rtsp://localhost:8554/camera_transcoded
```

### Step 3: Update mediamtx.yml
```yaml
paths:
  camera:
    source: rtsp://localhost:8554/camera_transcoded
    # ... rest of config
```

### Step 4: Run transcoder
```bash
chmod +x transcode-stream.sh
./transcode-stream.sh
```

## Current Configuration

Currently, the configuration uses the camera's native frame rate. To limit to 5 FPS:

1. **Best option**: Configure the camera itself for 5 FPS
2. **Alternative**: Use the transcoder approach above

## Verifying Frame Rate

To check the actual frame rate of the stream:
```bash
# Install ffprobe if needed
sudo apt install ffmpeg

# Check stream info
ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1 rtsp://localhost:8554/camera
```

The output will show the frame rate (e.g., `5/1` = 5 FPS).

