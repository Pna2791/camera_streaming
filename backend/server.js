const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const fs = require('fs').promises;
const path = require('path');

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

// Printers storage file path
const PRINTERS_FILE = path.join(__dirname, 'printers.json');

// Helper function to read printers from file
async function readPrinters() {
    try {
        const data = await fs.readFile(PRINTERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist or is empty, return empty array
        if (error.code === 'ENOENT') {
            await fs.writeFile(PRINTERS_FILE, JSON.stringify([], null, 2));
            return [];
        }
        console.error('Error reading printers file:', error);
        return [];
    }
}

// Helper function to write printers to file
async function writePrinters(printers) {
    try {
        await fs.writeFile(PRINTERS_FILE, JSON.stringify(printers, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing printers file:', error);
        return false;
    }
}

// GET /api/printers - Get list of all printers
app.get('/api/printers', async (req, res) => {
    try {
        const printers = await readPrinters();
        res.json({
            success: true,
            printers: printers
        });
    } catch (error) {
        console.error('Error getting printers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get printers',
            details: error.message
        });
    }
});

// POST /api/printers - Add a new printer or update existing
app.post('/api/printers', async (req, res) => {
    try {
        const { name, ip } = req.body;
        
        if (!ip) {
            return res.status(400).json({
                success: false,
                error: 'IP address is required'
            });
        }

        const printers = await readPrinters();
        
        // Check if printer with this IP already exists
        const existingIndex = printers.findIndex(p => p.ip === ip);
        
        if (existingIndex >= 0) {
            // Update existing printer
            printers[existingIndex] = {
                ...printers[existingIndex],
                name: name || printers[existingIndex].name,
                ip: ip,
                updatedAt: new Date().toISOString()
            };
        } else {
            // Add new printer
            const newPrinter = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                name: name || `Printer ${ip}`,
                ip: ip,
                status: 'unknown',
                printerState: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            printers.push(newPrinter);
        }

        const success = await writePrinters(printers);
        
        if (success) {
            res.json({
                success: true,
                message: existingIndex >= 0 ? 'Printer updated' : 'Printer added',
                printer: existingIndex >= 0 ? printers[existingIndex] : printers[printers.length - 1]
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to save printer'
            });
        }
    } catch (error) {
        console.error('Error adding/updating printer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add/update printer',
            details: error.message
        });
    }
});

// PUT /api/printers - Update entire printers list
app.put('/api/printers', async (req, res) => {
    try {
        const { printers } = req.body;
        
        if (!Array.isArray(printers)) {
            return res.status(400).json({
                success: false,
                error: 'Printers must be an array'
            });
        }

        const success = await writePrinters(printers);
        
        if (success) {
            res.json({
                success: true,
                message: 'Printers list updated',
                count: printers.length
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to update printers list'
            });
        }
    } catch (error) {
        console.error('Error updating printers list:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update printers list',
            details: error.message
        });
    }
});

// DELETE /api/printers/:id - Delete a printer
app.delete('/api/printers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const printers = await readPrinters();
        
        const filteredPrinters = printers.filter(p => p.id !== id);
        
        if (filteredPrinters.length === printers.length) {
            return res.status(404).json({
                success: false,
                error: 'Printer not found'
            });
        }

        const success = await writePrinters(filteredPrinters);
        
        if (success) {
            res.json({
                success: true,
                message: 'Printer deleted'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to delete printer'
            });
        }
    } catch (error) {
        console.error('Error deleting printer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete printer',
            details: error.message
        });
    }
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

// Moonraker API proxy endpoints (using port 80)
app.get('/api/moonraker/:ip/*', async (req, res) => {
    const printerIp = req.params.ip;
    const moonrakerPath = req.params[0] || 'server/info';
    const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    const moonrakerUrl = `http://${printerIp}:80/${moonrakerPath}${queryString}`; // Use port 80

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(moonrakerUrl, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            return res.status(response.status).json({
                error: 'Moonraker API error',
                status: response.status
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Moonraker proxy error:', error);
        res.status(500).json({
            error: 'Failed to connect to Moonraker',
            details: error.message
        });
    }
});

// Helper function to check if a printer exists at an IP (port 80)
// Just checks /server/info endpoint - no additional status checks
const checkPrinter = async (ip, port = 80, timeout = 2000) => {
    try {
        const url = `http://${ip}:${port}/server/info`;
        
        // Create AbortController for timeout (Node 18 compatible)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            
            // Get printer name from server/info or use IP as fallback
            const printerName = data.result?.hostname || 
                              data.result?.name || 
                              `Printer ${ip}`;

            return {
                ip: ip,
                name: printerName,
                moonraker_connected: data.result?.klippy_connected || false,
                info: data.result || {}
            };
        }
    } catch (error) {
        // IP doesn't have Moonraker or is unreachable - silently return null
        return null;
    }
    return null;
};

// Scan network for Klipper printers (Moonraker API on port 80)
app.post('/api/scan-printers', async (req, res) => {
    const { ipRange, startIp, endIp } = req.body;
    
    // Determine IP range to scan
    let ipStart, ipEnd, networkBase;
    
    if (ipRange) {
        // Parse range like "192.168.1.1-254" or "192.168.1.0/24"
        const rangeMatch = ipRange.match(/^(\d+\.\d+\.\d+)\.(\d+)-(\d+)$/);
        if (rangeMatch) {
            networkBase = rangeMatch[1];
            ipStart = parseInt(rangeMatch[2]);
            ipEnd = parseInt(rangeMatch[3]);
        } else {
            // Try CIDR notation
            const cidrMatch = ipRange.match(/^(\d+\.\d+\.\d+)\.(\d+)\/24$/);
            if (cidrMatch) {
                networkBase = cidrMatch[1];
                ipStart = 1;
                ipEnd = 254;
            } else {
                return res.status(400).json({
                    error: 'Invalid IP range format. Use format like "192.168.1.1-254" or "192.168.1.0/24"'
                });
            }
        }
    } else if (startIp && endIp) {
        const startMatch = startIp.match(/^(\d+\.\d+\.\d+)\.(\d+)$/);
        const endMatch = endIp.match(/^(\d+\.\d+\.\d+)\.(\d+)$/);
        if (startMatch && endMatch && startMatch[1] === endMatch[1]) {
            networkBase = startMatch[1];
            ipStart = parseInt(startMatch[2]);
            ipEnd = parseInt(endMatch[2]);
        } else {
            return res.status(400).json({
                error: 'Start and end IPs must be on the same network'
            });
        }
    } else {
        // Default: scan common local network range
        // Try to detect local network from request headers or network interfaces
        let detectedNetwork = '192.168.1'; // Default fallback
        
        // Try to get IP from X-Forwarded-For or X-Real-IP headers (from proxy)
        const forwardedFor = req.headers['x-forwarded-for'];
        const realIp = req.headers['x-real-ip'];
        const clientIp = forwardedFor?.split(',')[0] || realIp || req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
        
        // Extract network base from client IP (skip localhost)
        if (clientIp && !clientIp.startsWith('127.') && !clientIp.startsWith('::1')) {
            const ipMatch = clientIp.match(/^(\d+\.\d+\.\d+)\./);
            if (ipMatch) {
                detectedNetwork = ipMatch[1];
            }
        }
        
        // If still localhost, try to detect from hostname or use common ranges
        if (detectedNetwork === '127.0.0' || detectedNetwork.startsWith('127.')) {
            // Try common network ranges
            detectedNetwork = '192.168.1'; // Most common home network
        }
        
        networkBase = detectedNetwork;
        ipStart = 1;
        ipEnd = 254;
    }

    // Validate range
    if (ipStart < 1 || ipEnd > 254 || ipStart > ipEnd) {
        return res.status(400).json({
            error: 'Invalid IP range. Last octet must be between 1 and 254'
        });
    }

    const discoveredPrinters = [];
    const maxConcurrent = 20;
    const port = 80; // Use port 80 instead of 7125

    // Scan in batches to avoid overwhelming the network
    const scanBatch = async (start, end) => {
        const batch = [];
        for (let i = start; i <= end && i <= ipEnd; i++) {
            const fullIp = `${networkBase}.${i}`;
            batch.push(checkPrinter(fullIp, port, 2000));
        }
        const results = await Promise.all(batch);
        
        // Filter out null results (printers not found)
        results.forEach(result => {
            if (result) {
                discoveredPrinters.push(result);
            }
        });
    };

    // Scan all IPs in batches
    try {
        for (let i = ipStart; i <= ipEnd; i += maxConcurrent) {
            const batchEnd = Math.min(i + maxConcurrent - 1, ipEnd);
            await scanBatch(i, batchEnd);
        }

        res.json({
            success: true,
            discovered: discoveredPrinters.length,
            printers: discoveredPrinters,
            scannedRange: `${networkBase}.${ipStart}-${ipEnd}`
        });
    } catch (error) {
        console.error('Scan error:', error);
        res.status(500).json({
            error: 'Error during network scan',
            details: error.message
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Camera Streaming API server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});

