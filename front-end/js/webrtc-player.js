class WebRTCPlayer {
    constructor() {
        this.pc = null;
        this.controller = null;
        this.video = document.getElementById('videoPlayer');
        this.streamUrl = document.getElementById('streamUrl');
        this.authUsername = document.getElementById('authUsername');
        this.authPassword = document.getElementById('authPassword');
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.videoOverlay = document.getElementById('videoOverlay');
        
        this.connectBtn.addEventListener('click', () => this.connect());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        
        // Update status info
        this.updateInfo('status', 'Disconnected');
    }

    updateStatus(status, text) {
        this.statusIndicator.className = 'status-indicator ' + status;
        this.statusText.textContent = text;
    }

    updateInfo(key, value) {
        const element = document.getElementById(`info${key.charAt(0).toUpperCase() + key.slice(1)}`);
        if (element) {
            element.textContent = value;
        }
    }

    async connect() {
        let baseUrl = this.streamUrl.value.trim();
        if (!baseUrl) {
            alert('Please enter a stream URL');
            return;
        }

        // Convert WebSocket URL to HTTP URL for MediaMTX
        // ws://localhost:8555/camera -> http://localhost:8555/camera
        baseUrl = baseUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
        
        // Extract path (e.g., /camera)
        const url = new URL(baseUrl);
        const path = url.pathname || '/camera';
        const serverUrl = `${url.protocol}//${url.host}`;

        try {
            this.updateStatus('connecting', 'Connecting...');
            this.connectBtn.disabled = true;
            this.disconnectBtn.disabled = false;

            // Create RTCPeerConnection with optimized settings for smooth playback
            this.pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
                // Optimize for low latency and smooth playback
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            });

            // Handle ICE candidates
            this.pc.onicecandidate = async (event) => {
                if (event.candidate && this.controller) {
                    try {
                        const headers = {
                            'Content-Type': 'application/trickle-ice-sdpfrag'
                        };
                        const username = this.authUsername ? this.authUsername.value.trim() : '';
                        const password = this.authPassword ? this.authPassword.value.trim() : '';
                        if (username && password) {
                            const credentials = btoa(`${username}:${password}`);
                            headers['Authorization'] = `Basic ${credentials}`;
                        }
                        
                        await fetch(`${serverUrl}${path}/whep`, {
                            method: 'PATCH',
                            headers: headers,
                            body: event.candidate.candidate
                        });
                    } catch (err) {
                        console.error('Error sending ICE candidate:', err);
                    }
                }
            };

            // Handle track (video/audio)
            this.pc.ontrack = (event) => {
                console.log('Received track:', event.track.kind);
                this.video.srcObject = event.streams[0];
                this.videoOverlay.classList.add('hidden');
                this.updateStatus('connected', 'Streaming');
                this.updateInfo('status', 'Connected');
                
                // Optimize video playback for smooth streaming
                this.video.playsInline = true;
                this.video.muted = true;  // Muted for autoplay
                
                // Get video dimensions
                this.video.onloadedmetadata = () => {
                    this.updateInfo('resolution', 
                        `${this.video.videoWidth}x${this.video.videoHeight}`);
                };
                
                // Monitor video playback for issues
                this.video.onstalled = () => {
                    console.warn('Video playback stalled - possible network issue');
                };
                
                this.video.onwaiting = () => {
                    console.warn('Video waiting for data - buffering');
                };
            };

            this.pc.onconnectionstatechange = () => {
                console.log('Connection state:', this.pc.connectionState);
                if (this.pc.connectionState === 'failed' || 
                    this.pc.connectionState === 'disconnected' ||
                    this.pc.connectionState === 'closed') {
                    this.updateStatus('error', 'Connection lost');
                    this.cleanup();
                }
            };

            // Create offer
            const offer = await this.pc.createOffer({
                offerToReceiveVideo: true,
                offerToReceiveAudio: true
            });
            await this.pc.setLocalDescription(offer);

            // Prepare headers with optional authentication
            const headers = {
                'Content-Type': 'application/sdp'
            };
            
            // Add Basic Auth if username/password provided
            const username = this.authUsername ? this.authUsername.value.trim() : '';
            const password = this.authPassword ? this.authPassword.value.trim() : '';
            if (username && password) {
                const credentials = btoa(`${username}:${password}`);
                headers['Authorization'] = `Basic ${credentials}`;
            }

            // Send offer to MediaMTX using WHEP protocol
            console.log('Connecting to:', `${serverUrl}${path}/whep`);
            console.log('SDP Offer length:', offer.sdp.length);
            
            const response = await fetch(`${serverUrl}${path}/whep`, {
                method: 'POST',
                headers: headers,
                body: offer.sdp
            });

            console.log('Response status:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                console.error('Error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText || response.statusText}`);
            }

            // Get answer from MediaMTX
            const answerSdp = await response.text();
            await this.pc.setRemoteDescription({
                type: 'answer',
                sdp: answerSdp
            });

            // Store AbortController for cleanup
            this.controller = new AbortController();

        } catch (error) {
            console.error('Connection error:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            let errorMessage = 'Failed to connect: ' + error.message;
            
            // Provide more helpful error messages
            if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                errorMessage = 'Failed to fetch: Check if MediaMTX is running and URL is correct. ' +
                              'If connecting from browser, ensure CORS is allowed or use same origin.';
            } else if (error.message.includes('NetworkError')) {
                errorMessage = 'Network error: Cannot reach MediaMTX server. Check URL and network connectivity.';
            } else if (error.message.includes('HTTP error')) {
                errorMessage = error.message;
            }
            
            this.updateStatus('error', errorMessage);
            this.cleanup();
        }
    }

    disconnect() {
        this.cleanup();
        this.updateStatus('', 'Ready to connect');
        this.updateInfo('status', 'Disconnected');
        this.updateInfo('resolution', '-');
        this.updateInfo('fps', '-');
    }

    cleanup() {
        if (this.controller) {
            this.controller.abort();
            this.controller = null;
        }

        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }

        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
            this.video.srcObject = null;
        }

        this.videoOverlay.classList.remove('hidden');
        this.connectBtn.disabled = false;
        this.disconnectBtn.disabled = true;
    }
}

// Initialize player when page loads
document.addEventListener('DOMContentLoaded', () => {
    new WebRTCPlayer();
});

