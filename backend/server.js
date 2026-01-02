const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Test RTSP connection endpoint
app.post('/api/test-rtsp', async (req, res) => {
    const { rtspUrl } = req.body;

    if (!rtspUrl) {
        return res.status(400).json({ 
            success: false, 
            error: 'RTSP URL is required' 
        });
    }

    // Validate RTSP URL format
    if (!rtspUrl.startsWith('rtsp://')) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid RTSP URL format. Must start with rtsp://' 
        });
    }

        try {
            // Use ffprobe to test RTSP connection
            // This will attempt to connect and get stream information
            const timeout = 10000; // 10 seconds timeout
            const startTime = Date.now();

            // Escape RTSP URL for shell (handle special characters)
            const escapedUrl = rtspUrl.replace(/'/g, "'\\''");
            const ffprobeCommand = `ffprobe -v error -rtsp_transport tcp -show_entries stream=codec_name,codec_type,width,height,r_frame_rate -of json '${escapedUrl}'`;
            
            try {
                const { stdout, stderr } = await Promise.race([
                    exec(ffprobeCommand, { 
                        timeout,
                        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Connection timeout')), timeout)
                    )
                ]);

            const streamInfo = JSON.parse(stdout);
            const streams = streamInfo.streams || [];

            if (streams.length === 0) {
                return res.json({
                    success: false,
                    error: 'No streams found. Camera may be offline or URL incorrect.',
                    details: stderr
                });
            }

            // Extract video stream info
            const videoStream = streams.find(s => s.codec_type === 'video');
            const audioStream = streams.find(s => s.codec_type === 'audio');

            const result = {
                success: true,
                message: 'RTSP connection successful!',
                streams: {
                    video: videoStream ? {
                        codec: videoStream.codec_name,
                        resolution: videoStream.width && videoStream.height 
                            ? `${videoStream.width}x${videoStream.height}` 
                            : 'Unknown',
                        fps: videoStream.r_frame_rate || 'Unknown'
                    } : null,
                    audio: audioStream ? {
                        codec: audioStream.codec_name
                    } : null
                },
                connectionTime: Date.now() - startTime
            };

            return res.json(result);

        } catch (error) {
            // Parse error message first
            // exec() errors have stderr/stdout in the error object when command fails
            const hasStderr = error.stderr && error.stderr.toString().trim().length > 0;
            const errorMsg = (error.stderr || error.stdout || error.message || 'Unknown error').toString();
            const errorCode = error.code;
            
            // Check for RTSP-specific errors first (before checking for ffprobe)
            // Only if we have stderr (command executed but failed)
            if (hasStderr && (errorMsg.includes('404') || errorMsg.includes('Not Found'))) {
                return res.json({
                    success: false,
                    error: 'Stream path not found. Check RTSP path.',
                    details: errorMsg,
                    suggestion: 'Try a different RTSP path. Common paths: /stream1, /cam/realmonitor, /Streaming/Channels/101'
                });
            }
            
            if (hasStderr && (errorMsg.includes('401') || errorMsg.includes('Unauthorized'))) {
                return res.json({
                    success: false,
                    error: 'Authentication failed. Check username and password.',
                    details: errorMsg
                });
            }

            // Connection failed
            if (error.message && (error.message.includes('timeout') || error.message.includes('Connection timeout'))) {
                return res.json({
                    success: false,
                    error: 'Connection timeout. Camera may be offline or unreachable.',
                    suggestion: 'Check camera IP address and network connectivity'
                });
            }
            
            // Check if ffprobe is available (only if command not found - ENOENT)
            // This should be last, after checking for RTSP errors
            // Only check for ENOENT if there's no stderr (command not found vs command failed)
            if ((errorCode === 'ENOENT' || errorMsg.includes('ENOENT')) && !hasStderr) {
                return res.status(500).json({
                    success: false,
                    error: 'ffprobe is not installed. Install with: apt install ffmpeg',
                    suggestion: 'Install ffmpeg on the server to enable RTSP testing'
                });
            }

            return res.json({
                success: false,
                error: 'Failed to connect to RTSP stream.',
                details: errorMsg
            });
        }

    } catch (error) {
        console.error('Test RTSP error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'camera-streaming-api',
        timestamp: new Date().toISOString()
    });
});

// Check if ffprobe is available
app.get('/api/check-ffprobe', async (req, res) => {
    try {
        const { stdout } = await exec('which ffprobe');
        const { stdout: version } = await exec('ffprobe -version | head -1');
        res.json({
            available: true,
            path: stdout.trim(),
            version: version.trim()
        });
    } catch (error) {
        res.json({
            available: false,
            error: 'ffprobe is not installed',
            suggestion: 'Install with: apt install ffmpeg'
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Camera Streaming API server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});

