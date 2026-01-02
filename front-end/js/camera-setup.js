// Camera Setup and Network Scanning

class CameraSetup {
    constructor() {
        this.savedCameras = this.loadSavedCameras();
        this.scanning = false;
        this.init();
    }

    init() {
        // Form handlers
        document.getElementById('cameraForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCamera();
        });

        document.getElementById('testBtn').addEventListener('click', () => {
            this.testConnection();
        });

        document.getElementById('scanBtn').addEventListener('click', () => {
            this.scanNetwork();
        });

        document.getElementById('cameraPath').addEventListener('change', (e) => {
            const customGroup = document.getElementById('customPathGroup');
            if (e.target.value === 'custom') {
                customGroup.style.display = 'block';
            } else {
                customGroup.style.display = 'none';
            }
        });

        // Load saved cameras
        this.renderSavedCameras();
    }

    async scanNetwork() {
        if (this.scanning) return;

        const networkRange = document.getElementById('networkRange').value.trim();
        if (!networkRange) {
            alert('Please enter a network range');
            return;
        }

        this.scanning = true;
        const scanBtn = document.getElementById('scanBtn');
        const scanBtnText = document.getElementById('scanBtnText');
        const resultsDiv = document.getElementById('scanResults');
        const cameraList = document.getElementById('cameraList');

        scanBtn.disabled = true;
        scanBtnText.innerHTML = '<span class="loading"></span>Scanning...';
        cameraList.innerHTML = '<p>Scanning network for cameras...</p>';

        try {
            // Extract base IP from range (e.g., 192.168.1.0/24 -> 192.168.1)
            const baseIp = networkRange.split('/')[0].split('.').slice(0, 3).join('.');
            const foundCameras = await this.scanIPRange(baseIp);

            if (foundCameras.length > 0) {
                cameraList.innerHTML = '';
                foundCameras.forEach(camera => {
                    const cameraItem = this.createCameraItem(camera);
                    cameraList.appendChild(cameraItem);
                });
                resultsDiv.style.display = 'block';
            } else {
                cameraList.innerHTML = '<p style="color: #6c757d;">No cameras found. Try a different network range or check your network settings.</p>';
                resultsDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Scan error:', error);
            cameraList.innerHTML = `<p style="color: #dc3545;">Error scanning network: ${error.message}</p>`;
            resultsDiv.style.display = 'block';
        } finally {
            this.scanning = false;
            scanBtn.disabled = false;
            scanBtnText.textContent = '🔍 Scan Network';
        }
    }

    async scanIPRange(baseIp) {
        const foundCameras = [];
        const commonPorts = [554, 8554, 1935]; // RTSP, alternative RTSP, RTMP
        const ipRange = 254; // Scan .1 to .254

        // Create promises for parallel scanning (limited concurrency)
        const scanPromises = [];
        const batchSize = 20; // Scan 20 IPs at a time

        for (let i = 1; i <= ipRange; i++) {
            const ip = `${baseIp}.${i}`;
            
            scanPromises.push(
                this.checkCamera(ip, commonPorts).then(result => {
                    if (result) {
                        foundCameras.push(result);
                    }
                }).catch(() => {}) // Ignore errors
            );

            // Process in batches to avoid overwhelming
            if (scanPromises.length >= batchSize || i === ipRange) {
                await Promise.all(scanPromises);
                scanPromises.length = 0;
                
                // Update progress
                const progress = Math.round((i / ipRange) * 100);
                document.getElementById('cameraList').innerHTML = 
                    `<p>Scanning... ${progress}% (${i}/${ipRange} IPs checked)</p>`;
            }
        }

        return foundCameras;
    }

    async checkCamera(ip, ports) {
        // Check if IP is reachable and has RTSP port open
        for (const port of ports) {
            try {
                const isReachable = await this.pingIP(ip);
                if (isReachable) {
                    // Try to detect camera type by checking common RTSP paths
                    const cameraInfo = await this.detectCamera(ip, port);
                    if (cameraInfo) {
                        return {
                            ip: ip,
                            port: port,
                            ...cameraInfo
                        };
                    }
                }
            } catch (e) {
                // Continue to next port
            }
        }
        return null;
    }

    async pingIP(ip) {
        // Use fetch with timeout to check if IP is reachable
        // Note: This is a simplified check - actual network scanning would use WebRTC or WebSocket
        return new Promise((resolve) => {
            // For browser-based scanning, we can only check HTTP endpoints
            // Real network scanning requires backend support
            const img = new Image();
            let resolved = false;
            
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    resolve(false);
                }
            }, 500);

            // Try to load a small image or check if port responds
            // This is a basic check - full scanning needs backend
            fetch(`http://${ip}`, { 
                method: 'HEAD', 
                mode: 'no-cors',
                signal: AbortSignal.timeout(500)
            }).then(() => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    resolve(true);
                }
            }).catch(() => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    resolve(false);
                }
            });
        });
    }

    async detectCamera(ip, port) {
        // Try common RTSP paths to detect camera type
        const commonPaths = [
            { path: '/cam/realmonitor?channel=1&subtype=0', type: 'Dahua' },
            { path: '/stream1', type: 'IMOU' },
            { path: '/Streaming/Channels/101', type: 'Hikvision' },
            { path: '/live', type: 'Generic' }
        ];

        // For now, return a generic camera info
        // Full detection would require RTSP connection testing
        return {
            type: 'Unknown',
            path: '/cam/realmonitor?channel=1&subtype=0&unicast=true&proto=Onvif',
            suggestedPath: commonPaths[0].path
        };
    }

    createCameraItem(camera) {
        const div = document.createElement('div');
        div.className = 'camera-item';
        div.innerHTML = `
            <div class="camera-item-header">
                <div>
                    <div class="camera-item-title">${camera.type || 'IP Camera'}</div>
                    <div class="camera-item-ip">${camera.ip}:${camera.port}</div>
                </div>
                <button class="btn btn-primary btn-small" onclick="cameraSetup.useCamera('${camera.ip}', ${camera.port}, '${camera.path}')">
                    Use This Camera
                </button>
            </div>
            <div class="camera-item-details">
                Suggested RTSP Path: ${camera.path}
            </div>
        `;
        return div;
    }

    useCamera(ip, port, path) {
        document.getElementById('cameraIp').value = ip;
        document.getElementById('cameraPort').value = port;
        document.getElementById('customPath').value = path;
        document.getElementById('cameraPath').value = 'custom';
        document.getElementById('customPathGroup').style.display = 'block';
        
        // Scroll to form
        document.getElementById('cameraForm').scrollIntoView({ behavior: 'smooth' });
    }

    async testConnection() {
        const formData = this.getFormData();
        const rtspUrl = this.buildRTSPUrl(formData);

        const testBtn = document.getElementById('testBtn');
        const originalText = testBtn.textContent;
        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';

        try {
            // Test RTSP connection (simplified - would need backend for real test)
            alert(`Testing connection to:\n${rtspUrl}\n\nNote: Full RTSP testing requires backend support. Please verify the URL is correct.`);
        } catch (error) {
            alert('Connection test failed: ' + error.message);
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = originalText;
        }
    }

    saveCamera() {
        const formData = this.getFormData();
        const camera = {
            id: Date.now().toString(),
            name: formData.cameraName || `Camera ${formData.cameraIp}`,
            ip: formData.cameraIp,
            port: formData.cameraPort,
            username: formData.cameraUsername,
            password: formData.cameraPassword,
            path: formData.cameraPath === 'custom' ? formData.customPath : formData.cameraPath,
            rtspUrl: this.buildRTSPUrl(formData),
            createdAt: new Date().toISOString()
        };

        this.savedCameras.push(camera);
        this.saveSavedCameras();
        this.renderSavedCameras();
        
        // Clear form
        document.getElementById('cameraForm').reset();
        document.getElementById('customPathGroup').style.display = 'none';
        
        alert(`Camera "${camera.name}" saved successfully!`);
    }

    getFormData() {
        return {
            cameraIp: document.getElementById('cameraIp').value.trim(),
            cameraPort: document.getElementById('cameraPort').value.trim(),
            cameraUsername: document.getElementById('cameraUsername').value.trim(),
            cameraPassword: document.getElementById('cameraPassword').value,
            cameraPath: document.getElementById('cameraPath').value,
            customPath: document.getElementById('customPath').value.trim(),
            cameraName: document.getElementById('cameraName').value.trim()
        };
    }

    buildRTSPUrl(formData) {
        const path = formData.cameraPath === 'custom' ? formData.customPath : formData.cameraPath;
        return `rtsp://${formData.cameraUsername}:${formData.cameraPassword}@${formData.cameraIp}:${formData.cameraPort}${path}`;
    }

    renderSavedCameras() {
        const container = document.getElementById('savedCameras');
        
        if (this.savedCameras.length === 0) {
            container.innerHTML = '<p class="no-cameras">No cameras saved yet. Add one above.</p>';
            return;
        }

        container.innerHTML = this.savedCameras.map(camera => `
            <div class="saved-camera-card">
                <div class="saved-camera-info">
                    <h4>${camera.name}</h4>
                    <p>${camera.ip}:${camera.port} - ${camera.path}</p>
                </div>
                <div class="saved-camera-actions">
                    <button class="btn btn-secondary btn-small" onclick="cameraSetup.editCamera('${camera.id}')">
                        Edit
                    </button>
                    <button class="btn btn-primary btn-small" onclick="cameraSetup.useInStream('${camera.id}')">
                        Use in Stream
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="cameraSetup.deleteCamera('${camera.id}')">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    useInStream(cameraId) {
        const camera = this.savedCameras.find(c => c.id === cameraId);
        if (camera) {
            // Store camera config for stream page
            localStorage.setItem('selectedCamera', JSON.stringify(camera));
            // Redirect to stream page
            window.location.href = '../index.html';
        }
    }

    editCamera(cameraId) {
        const camera = this.savedCameras.find(c => c.id === cameraId);
        if (camera) {
            document.getElementById('cameraIp').value = camera.ip;
            document.getElementById('cameraPort').value = camera.port;
            document.getElementById('cameraUsername').value = camera.username;
            document.getElementById('cameraPassword').value = camera.password;
            document.getElementById('cameraName').value = camera.name;
            
            // Set path
            const pathSelect = document.getElementById('cameraPath');
            const customPath = document.getElementById('customPath');
            const customGroup = document.getElementById('customPathGroup');
            
            const matchingOption = Array.from(pathSelect.options).find(opt => opt.value === camera.path);
            if (matchingOption) {
                pathSelect.value = camera.path;
                customGroup.style.display = 'none';
            } else {
                pathSelect.value = 'custom';
                customPath.value = camera.path;
                customGroup.style.display = 'block';
            }
            
            // Delete old camera
            this.deleteCamera(cameraId, false);
            
            // Scroll to form
            document.getElementById('cameraForm').scrollIntoView({ behavior: 'smooth' });
        }
    }

    deleteCamera(cameraId, confirm = true) {
        if (confirm && !window.confirm('Are you sure you want to delete this camera?')) {
            return;
        }
        
        this.savedCameras = this.savedCameras.filter(c => c.id !== cameraId);
        this.saveSavedCameras();
        this.renderSavedCameras();
    }

    saveSavedCameras() {
        localStorage.setItem('savedCameras', JSON.stringify(this.savedCameras));
    }

    loadSavedCameras() {
        const saved = localStorage.getItem('savedCameras');
        return saved ? JSON.parse(saved) : [];
    }
}

// Initialize on page load
const cameraSetup = new CameraSetup();

