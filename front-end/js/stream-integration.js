// Integration between setup page and stream page
document.addEventListener('DOMContentLoaded', () => {
    // Set default Stream URL based on current host
    const streamUrlInput = document.getElementById('streamUrl');
    if (streamUrlInput && !streamUrlInput.value) {
        // Get current host (IP or hostname) from the page URL
        const currentHost = window.location.hostname;
        const defaultUrl = `http://${currentHost}:8555/camera`;
        streamUrlInput.value = defaultUrl;
        streamUrlInput.placeholder = defaultUrl;
    }
    
    // Check if a camera was selected from setup page
    const selectedCamera = localStorage.getItem('selectedCamera');
    if (selectedCamera) {
        try {
            const camera = JSON.parse(selectedCamera);
            // Update stream URL if available
            if (streamUrlInput && camera.rtspUrl) {
                // Convert RTSP URL to WebRTC URL format
                // Extract server IP from RTSP URL
                const rtspMatch = camera.rtspUrl.match(/rtsp:\/\/(?:[^:]+:[^@]+@)?([^:]+):(\d+)/);
                if (rtspMatch) {
                    const serverIp = rtspMatch[1];
                    const webrtcUrl = `http://${serverIp}:8555/camera`;
                    streamUrlInput.value = webrtcUrl;
                }
            }
            // Clear the selection
            localStorage.removeItem('selectedCamera');
        } catch (e) {
            console.error('Error loading selected camera:', e);
        }
    }
});

