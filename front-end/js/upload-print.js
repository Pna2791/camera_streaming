// Upload & Print functionality
class UploadPrintManager {
    constructor() {
        this.modal = document.getElementById('uploadPrintModal');
        this.fileInput = document.getElementById('gcodeFile');
        this.selectedFileName = document.getElementById('selectedFileName');
        this.printerSelectionList = document.getElementById('printerSelectionList');
        this.startBtn = document.getElementById('startUploadPrintBtn');
        this.cancelBtn = document.getElementById('cancelUploadPrintBtn');
        this.closeBtn = document.getElementById('closeUploadPrintModal');
        this.progressDiv = document.getElementById('uploadPrintProgress');
        this.statusText = document.getElementById('uploadPrintStatusText');
        this.detailsText = document.getElementById('uploadPrintDetails');
        
        this.selectedFile = null;
        this.selectedPrinters = new Set();
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Open modal button
        const uploadPrintBtn = document.getElementById('uploadPrintBtn');
        if (uploadPrintBtn) {
            uploadPrintBtn.addEventListener('click', () => this.openModal());
        }
        
        // File input change
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Start button
        this.startBtn.addEventListener('click', () => this.startUploadAndPrint());
        
        // Cancel/Close buttons
        this.cancelBtn.addEventListener('click', () => this.closeModal());
        this.closeBtn.addEventListener('click', () => this.closeModal());
        
        // Close modal when clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
    }
    
    openModal() {
        this.modal.style.display = 'block';
        this.loadPrinterList();
        this.resetForm();
    }
    
    closeModal() {
        this.modal.style.display = 'none';
        this.resetForm();
    }
    
    resetForm() {
        this.fileInput.value = '';
        this.selectedFile = null;
        this.selectedFileName.textContent = '';
        this.selectedPrinters.clear();
        this.startBtn.disabled = true;
        this.progressDiv.style.display = 'none';
        this.updateStartButton();
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            if (!file.name.toLowerCase().endsWith('.gcode')) {
                alert('Please select a .gcode file');
                this.fileInput.value = '';
                return;
            }
            this.selectedFile = file;
            this.selectedFileName.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
            this.updateStartButton();
        }
    }
    
    async loadPrinterList() {
        try {
            const currentHost = window.location.hostname;
            const response = await fetch(`http://${currentHost}:3000/api/printers`);
            const data = await response.json();
            
            if (data.success && data.printers) {
                this.renderPrinterList(data.printers);
            } else {
                this.printerSelectionList.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No printers available. Please add printers first.</p>';
            }
        } catch (error) {
            console.error('Error loading printers:', error);
            this.printerSelectionList.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 20px;">Error loading printers</p>';
        }
    }
    
    renderPrinterList(printers) {
        if (printers.length === 0) {
            this.printerSelectionList.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No printers available. Please add printers first.</p>';
            return;
        }
        
        this.printerSelectionList.innerHTML = printers.map(printer => `
            <div class="printer-checkbox-item" data-printer-id="${printer.id}">
                <input 
                    type="checkbox" 
                    id="printer-${printer.id}" 
                    value="${printer.id}"
                    onchange="uploadPrintManager.togglePrinter('${printer.id}')"
                >
                <label for="printer-${printer.id}">
                    <span class="printer-checkbox-name">${printer.name}</span>
                    <span class="printer-checkbox-ip">${printer.ip}:80</span>
                </label>
                <span class="printer-checkbox-status ${printer.status || 'offline'}" title="${printer.status === 'online' ? 'Online' : 'Offline'}"></span>
            </div>
        `).join('');
    }
    
    togglePrinter(printerId) {
        const checkbox = document.getElementById(`printer-${printerId}`);
        if (checkbox.checked) {
            this.selectedPrinters.add(printerId);
        } else {
            this.selectedPrinters.delete(printerId);
        }
        this.updateStartButton();
    }
    
    updateStartButton() {
        this.startBtn.disabled = !this.selectedFile || this.selectedPrinters.size === 0;
    }
    
    async startUploadAndPrint() {
        if (!this.selectedFile || this.selectedPrinters.size === 0) {
            alert('Please select a file and at least one printer');
            return;
        }
        
        this.startBtn.disabled = true;
        this.progressDiv.style.display = 'block';
        this.statusText.textContent = 'Processing...';
        this.detailsText.textContent = '';
        
        try {
            // Get printer details
            const currentHost = window.location.hostname;
            const printersResponse = await fetch(`http://${currentHost}:3000/api/printers`);
            const printersData = await printersResponse.json();
            
            if (!printersData.success || !printersData.printers) {
                throw new Error('Failed to get printer list');
            }
            
            const printers = printersData.printers.filter(p => this.selectedPrinters.has(p.id));
            const totalPrinters = printers.length;
            let completed = 0;
            let failed = 0;
            const results = [];
            
            // Process each printer
            for (const printer of printers) {
                try {
                    this.statusText.textContent = `Uploading to ${printer.name}... (${completed + failed + 1}/${totalPrinters})`;
                    this.detailsText.textContent = `Printer: ${printer.name} (${printer.ip})`;
                    
                    // Upload file
                    const formData = new FormData();
                    formData.append('file', this.selectedFile);
                    
                    const uploadResponse = await fetch(`http://${currentHost}:3000/api/moonraker/${printer.ip}/server/files/upload`, {
                        method: 'POST',
                        body: formData
                    });
                    
                    console.log('Upload response status:', uploadResponse.status, uploadResponse.statusText);
                    
                    let uploadData;
                    const contentType = uploadResponse.headers.get('content-type') || '';
                    
                    if (contentType.includes('application/json')) {
                        uploadData = await uploadResponse.json();
                    } else {
                        const text = await uploadResponse.text();
                        console.error('Non-JSON response from upload:', text.substring(0, 200));
                        // If it's a 404, the route might not exist
                        if (uploadResponse.status === 404) {
                            throw new Error(`Upload endpoint not found (404). Check if the route is registered.`);
                        }
                        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
                    }
                    
                    if (!uploadResponse.ok) {
                        throw new Error(uploadData.error || uploadData.details || `Upload failed: ${uploadResponse.status}`);
                    }
                    
                    if (!uploadData.success && uploadData.error) {
                        throw new Error(uploadData.error || 'Upload failed');
                    }
                    
                    // Wait a bit before starting print
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Start print
                    this.statusText.textContent = `Starting print on ${printer.name}... (${completed + failed + 1}/${totalPrinters})`;
                    
                    const startResponse = await fetch(`http://${currentHost}:3000/api/moonraker/${printer.ip}/printer/print/start`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            filename: this.selectedFile.name
                        })
                    });
                    
                    const startData = await startResponse.json();
                    
                    if (!startData.success && !startResponse.ok) {
                        throw new Error(startData.error || 'Start print failed');
                    }
                    
                    completed++;
                    results.push({
                        printer: printer.name,
                        ip: printer.ip,
                        success: true
                    });
                    
                } catch (error) {
                    failed++;
                    results.push({
                        printer: printer.name,
                        ip: printer.ip,
                        success: false,
                        error: error.message
                    });
                    console.error(`Error processing ${printer.name}:`, error);
                }
            }
            
            // Show results
            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;
            
            this.statusText.textContent = `Completed: ${successCount} successful, ${failCount} failed`;
            this.detailsText.innerHTML = results.map(r => 
                r.success 
                    ? `✓ ${r.printer}: Uploaded and started print`
                    : `✗ ${r.printer}: ${r.error}`
            ).join('<br>');
            
            // Re-enable button after a delay
            setTimeout(() => {
                this.startBtn.disabled = false;
            }, 2000);
            
            // Refresh printer statuses
            if (window.printersManager) {
                setTimeout(() => {
                    window.printersManager.checkPrintersStatus();
                }, 2000);
            }
            
        } catch (error) {
            console.error('Upload and print error:', error);
            this.statusText.textContent = 'Error';
            this.detailsText.textContent = error.message;
            this.startBtn.disabled = false;
        }
    }
}

// Initialize when DOM is ready
let uploadPrintManager;
document.addEventListener('DOMContentLoaded', () => {
    uploadPrintManager = new UploadPrintManager();
    window.uploadPrintManager = uploadPrintManager;
});

