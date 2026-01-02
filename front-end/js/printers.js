// Klipper Printers Management

class PrintersManager {
    constructor() {
        this.printers = [];
        this.selectedPrinter = null;
    }

    async init() {
        // Load printers from backend
        this.printers = await this.loadPrinters();
        this.renderPrinters();
        this.setupAddPrinterForm();
        this.setupNetworkScanner();
        
        // Initial status check after loading
        setTimeout(() => {
            this.checkPrintersStatus();
        }, 1000);
    }

    setupAddPrinterForm() {
        const addBtn = document.getElementById('addPrinterBtn');
        const form = document.getElementById('addPrinterForm');
        const saveBtn = document.getElementById('savePrinterBtn');
        const cancelBtn = document.getElementById('cancelPrinterBtn');

        if (addBtn) {
            addBtn.addEventListener('click', () => {
                form.style.display = form.style.display === 'none' ? 'block' : 'none';
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                form.style.display = 'none';
                document.getElementById('newPrinterName').value = '';
                document.getElementById('newPrinterIp').value = '';
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const name = document.getElementById('newPrinterName').value.trim();
                const ip = document.getElementById('newPrinterIp').value.trim();
                
                if (!ip) {
                    alert('Please enter an IP address');
                    return;
                }

                // Validate IP format
                const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
                if (!ipRegex.test(ip)) {
                    alert('Please enter a valid IP address');
                    return;
                }

                await this.addPrinter(name || `Printer ${this.printers.length + 1}`, ip);
                form.style.display = 'none';
                document.getElementById('newPrinterName').value = '';
                document.getElementById('newPrinterIp').value = '';
            });
        }
    }

    setupNetworkScanner() {
        const scanBtn = document.getElementById('scanNetworkBtn');
        const scanResults = document.getElementById('scanResults');
        const scanProgress = document.getElementById('scanProgress');
        const scanResultsContent = document.getElementById('scanResultsContent');
        const closeScanResults = document.getElementById('closeScanResults');

        if (scanBtn) {
            scanBtn.addEventListener('click', () => {
                this.scanNetwork();
            });
        }

        if (closeScanResults) {
            closeScanResults.addEventListener('click', () => {
                scanResults.style.display = 'none';
            });
        }
    }

    async scanNetwork() {
        const scanProgress = document.getElementById('scanProgress');
        const scanProgressText = document.getElementById('scanProgressText');
        const scanResults = document.getElementById('scanResults');
        const scanResultsContent = document.getElementById('scanResultsContent');

        // Show progress
        scanProgress.style.display = 'block';
        scanResults.style.display = 'none';
        scanProgressText.textContent = 'Scanning network for Klipper printers...';

        try {
            const currentHost = window.location.hostname;
            // Extract network base from current host IP
            let ipRange = null;
            const hostMatch = currentHost.match(/^(\d+\.\d+\.\d+)\./);
            if (hostMatch && !currentHost.startsWith('127.') && !currentHost.startsWith('localhost')) {
                const networkBase = hostMatch[1];
                ipRange = `${networkBase}.1-254`;
            }
            
            const response = await fetch(`http://${currentHost}:3000/api/scan-printers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ipRange: ipRange // Send detected network range
                })
            });

            const data = await response.json();

            // Hide progress
            scanProgress.style.display = 'none';

            if (data.success && data.printers && data.printers.length > 0) {
                // Filter out printers that already exist in the list
                const existingIps = new Set(this.printers.map(p => p.ip));
                const newPrinters = data.printers.filter(printer => !existingIps.has(printer.ip));
                
                if (newPrinters.length === 0) {
                    // All printers already exist
                    scanResultsContent.innerHTML = `
                        <p style="margin: 0; color: #6c757d; font-size: 0.9em;">
                            All discovered printers are already in your list.
                        </p>
                    `;
                } else {
                    // Show results
                    scanResultsContent.innerHTML = `
                        <p style="margin: 0 0 10px 0; color: #495057; font-size: 0.9em;">
                            Found <strong>${newPrinters.length}</strong> new printer(s) in range ${data.scannedRange}:
                            ${data.printers.length > newPrinters.length ? ` (${data.printers.length - newPrinters.length} already in list)` : ''}
                        </p>
                        <div style="margin-bottom: 10px;">
                            <button 
                                id="addAllPrintersBtn" 
                                class="btn-add-all"
                                style="width: 100%; padding: 8px 12px; font-size: 0.9em; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;"
                            >
                                ➕ Add All Printers
                            </button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${newPrinters.map(printer => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: white; border-radius: 6px; border: 1px solid #dee2e6;">
                                    <div>
                                        <div style="font-weight: 600; color: #343a40;">${printer.name}</div>
                                        <div style="font-size: 0.85em; color: #6c757d; font-family: monospace;">${printer.ip}:80</div>
                                    </div>
                                    <button 
                                        class="btn-add-discovered" 
                                        data-ip="${printer.ip}" 
                                        data-name="${printer.name}"
                                        style="padding: 6px 12px; font-size: 0.85em; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;"
                                    >
                                        Add
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }

                // Add event listener to "Add All" button
                const addAllBtn = document.getElementById('addAllPrintersBtn');
                if (addAllBtn) {
                    addAllBtn.addEventListener('click', async () => {
                        // Use filtered list (newPrinters) instead of all printers
                        const existingIps = new Set(this.printers.map(p => p.ip));
                        const newPrinters = data.printers.filter(printer => !existingIps.has(printer.ip));
                        await this.addAllPrinters(newPrinters);
                        // Close scan results after adding
                        setTimeout(() => {
                            scanResults.style.display = 'none';
                        }, 500);
                    });
                }

                // Add event listeners to individual "Add" buttons
                scanResultsContent.querySelectorAll('.btn-add-discovered').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const ip = btn.dataset.ip;
                        const name = btn.dataset.name;
                        // Check if already exists
                        if (this.printers.find(p => p.ip === ip)) {
                            alert('This printer is already in your list');
                            return;
                        }
                        // Auto-add printer to list
                        await this.addPrinter(name, ip);
                        // Update button state
                        btn.textContent = 'Added ✓';
                        btn.disabled = true;
                        btn.style.background = '#6c757d';
                        // Close scan results after adding
                        setTimeout(() => {
                            scanResults.style.display = 'none';
                        }, 500);
                    });
                });

                scanResults.style.display = 'block';
            } else {
                // No printers found
                scanResultsContent.innerHTML = `
                    <p style="margin: 0; color: #495057;">
                        No Klipper printers found in the scanned range. Make sure:
                    </p>
                    <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #495057; font-size: 0.9em;">
                        <li>Printers are powered on and connected to the network</li>
                        <li>Moonraker API is running on port 80</li>
                        <li>Printers are on the same network as this server</li>
                    </ul>
                `;
                scanResults.style.display = 'block';
            }
        } catch (error) {
            console.error('Scan error:', error);
            scanProgress.style.display = 'none';
            scanResultsContent.innerHTML = `
                <p style="margin: 0; color: #dc3545;">
                    Error scanning network: ${error.message}
                </p>
            `;
            scanResults.style.display = 'block';
        }
    }

    async loadPrinters() {
        // Load from backend API
        try {
            const currentHost = window.location.hostname;
            const response = await fetch(`http://${currentHost}:3000/api/printers`);
            
            if (response.ok) {
                const data = await response.json();
                return data.printers || [];
            } else {
                console.error('Failed to load printers from server');
                return [];
            }
        } catch (error) {
            console.error('Error loading printers:', error);
            return [];
        }
    }

    async savePrinters() {
        // Save to backend API
        try {
            const currentHost = window.location.hostname;
            const response = await fetch(`http://${currentHost}:3000/api/printers`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ printers: this.printers })
            });
            
            if (!response.ok) {
                console.error('Failed to save printers to server');
            }
        } catch (error) {
            console.error('Error saving printers:', error);
        }
    }

    getThumbnailUrl(printer) {
        if (!printer.printStats || !printer.printStats.filename) {
            console.log('No filename in printStats for printer:', printer.name, printer.printStats);
            return null;
        }
        
        // Extract filename from path (e.g., "/opt/printer_data/gcodes/file.gcode" -> "file.gcode")
        let filename = printer.printStats.filename;
        if (filename.includes('/')) {
            filename = filename.split('/').pop();
        }
        
        // Remove .gcode extension and add thumbnail suffix
        const baseName = filename.replace(/\.gcode$/i, '');
        // Add timestamp to prevent caching issues
        const timestamp = Date.now() / 1000;
        const thumbnailUrl = `http://${printer.ip}/server/files/gcodes/.thumbs/${baseName}-300x300.png?date=${timestamp}`;
        
        console.log('Thumbnail URL for', printer.name, ':', thumbnailUrl);
        return thumbnailUrl;
    }

    renderPrinters() {
        const container = document.getElementById('printersList');
        
        if (this.printers.length === 0) {
            container.innerHTML = '<div class="no-printers">No printers configured</div>';
            return;
        }

        container.innerHTML = this.printers.map(printer => {
            const state = printer.printerState || 'unknown';
            const stateLabel = this.getStateLabel(state);
            const stateColor = this.getStateColor(state);
            const showPreview = (state === 'printing' || state === 'done') && printer.status === 'online';
            const thumbnailUrl = showPreview ? this.getThumbnailUrl(printer) : null;
            
            // Get filename for modal display
            let filename = null;
            if (printer.printStats && printer.printStats.filename) {
                let fullPath = printer.printStats.filename;
                if (fullPath.includes('/')) {
                    filename = fullPath.split('/').pop();
                } else {
                    filename = fullPath;
                }
            }
            
            console.log('Printer:', printer.name, 'State:', state, 'ShowPreview:', showPreview, 'ThumbnailURL:', thumbnailUrl);
            
            return `
            <div class="printer-item" data-printer-id="${printer.id}">
                <div class="printer-item-header" style="display: flex; align-items: flex-start; gap: 12px;">
                    ${thumbnailUrl ? `
                        <img src="${thumbnailUrl}" alt="Print Preview" class="printer-preview" style="cursor: pointer;" onclick="window.printerManager.openThumbnailModal('${thumbnailUrl}', ${filename ? `'${filename.replace(/'/g, "\\'")}'` : 'null'})" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <img src="imgs/3d_printer.png" alt="Printer" class="printer-icon" style="display: none;">
                    ` : `
                        <img src="imgs/3d_printer.png" alt="Printer" class="printer-icon">
                    `}
                    <div style="flex: 1;">
                        <div class="printer-name">${printer.name}</div>
                        <div class="printer-ip">${printer.ip}:80</div>
                        ${printer.status === 'online' ? `
                            <div class="printer-state" style="color: ${stateColor}; font-size: 0.85em; margin-top: 4px;">
                                ${stateLabel}
                            </div>
                        ` : ''}
                    </div>
                    <span class="printer-status ${printer.status}" title="${printer.status === 'online' ? 'Online' : 'Offline'}"></span>
                    <div class="printer-menu-container">
                        <button class="printer-menu-btn" onclick="event.stopPropagation(); printersManager.toggleMenu('${printer.id}')" title="More options">
                            ⋯
                        </button>
                        <div class="printer-menu" id="menu-${printer.id}" style="display: none;">
                            <button class="printer-menu-item" onclick="event.stopPropagation(); printersManager.editPrinterName('${printer.id}')">
                                ✏️ Edit Name
                            </button>
                            ${printer.status === 'online' && (printer.printerState === 'printing' || printer.printerState === 'paused') ? `
                            <button class="printer-menu-item printer-menu-item-danger" onclick="event.stopPropagation(); printersManager.cancelPrint('${printer.id}', '${printer.ip}')">
                                ⛔ Cancel Print
                            </button>
                            ` : ''}
                            <button class="printer-menu-item printer-menu-item-danger" onclick="event.stopPropagation(); printersManager.removePrinter('${printer.id}')">
                                🗑️ Remove
                            </button>
                        </div>
                    </div>
                </div>
                ${printer.status === 'online' && printer.temperature ? `
                    <div class="printer-details">
                        <div class="printer-temp">
                            <span>Bed: ${Math.round(printer.temperature.bed)}°C</span>
                            <span>Ext: ${Math.round(printer.temperature.extruder)}°C</span>
                        </div>
                        ${printer.printProgress !== null && printer.printProgress > 0 ? `
                            <div class="printer-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${printer.printProgress}%"></div>
                                </div>
                                <span class="progress-text">${printer.printProgress}%</span>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                <div style="margin-top: 8px; display: flex; gap: 8px;">
                    ${printer.status === 'online' && (printer.printerState === 'printing' || printer.printerState === 'paused') ? `
                        <button class="btn-pause" onclick="event.stopPropagation(); printersManager.pausePrint('${printer.id}', '${printer.ip}')" style="flex: 1; padding: 8px 12px; font-size: 0.85em; background: #ffc107; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            ${printer.printerState === 'paused' ? '▶️ Resume' : '⏸️ Pause'}
                        </button>
                    ` : ''}
                    <button class="btn-open" onclick="event.stopPropagation(); printersManager.openPrinterDashboard('${printer.ip}')" style="${printer.status === 'online' && (printer.printerState === 'printing' || printer.printerState === 'paused') ? 'flex: 1;' : 'width: 100%;'} padding: 8px 12px; font-size: 0.85em; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        🔗 Open Dashboard
                    </button>
                </div>
            </div>
        `;
        }).join('');

        // Add click handlers
        container.querySelectorAll('.printer-item').forEach(item => {
            item.addEventListener('click', () => {
                const printerId = item.dataset.printerId;
                this.selectPrinter(printerId);
            });
        });

        // Close menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.printer-menu-container')) {
                container.querySelectorAll('.printer-menu').forEach(menu => {
                    menu.style.display = 'none';
                });
            }
        });
    }

    toggleMenu(printerId) {
        const menu = document.getElementById(`menu-${printerId}`);
        if (!menu) return;

        // Close all other menus
        document.querySelectorAll('.printer-menu').forEach(m => {
            if (m.id !== `menu-${printerId}`) {
                m.style.display = 'none';
            }
        });

        // Toggle current menu
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }

    selectPrinter(printerId) {
        // Remove active class from all items
        document.querySelectorAll('.printer-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to selected item
        const selectedItem = document.querySelector(`[data-printer-id="${printerId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        }

        // Store selected printer
        this.selectedPrinter = this.printers.find(p => p.id === printerId);
        
        // You can add logic here to switch camera stream based on printer
        console.log('Selected printer:', this.selectedPrinter);
    }

    async checkPrintersStatus() {
        // Check status of each printer using Moonraker API
        const statusPromises = this.printers.map(printer => 
            this.checkMoonrakerStatus(printer).catch(error => {
                console.error(`Error checking printer ${printer.ip}:`, error);
                return { ...printer, status: 'offline', printerState: null };
            })
        );

        const updatedPrinters = await Promise.all(statusPromises);
        
        // Update printer data
        updatedPrinters.forEach(updatedPrinter => {
            const printer = this.printers.find(p => p.id === updatedPrinter.id);
            if (printer) {
                printer.status = updatedPrinter.status;
                printer.printerState = updatedPrinter.printerState;
                printer.temperature = updatedPrinter.temperature;
                printer.printProgress = updatedPrinter.printProgress;
                // Preserve printStats (including filename) if it exists
                if (updatedPrinter.printStats) {
                    printer.printStats = updatedPrinter.printStats;
                }
            }
        });

        // Update UI
        this.renderPrinters();
    }

    async checkMoonrakerStatus(printer) {
        // Use backend API proxy to avoid CORS issues
        const currentHost = window.location.hostname;
        const apiUrl = `http://${currentHost}:3000/api/moonraker/${printer.ip}`;
        
        try {
            // Check if Moonraker is accessible via proxy
            const serverInfoResponse = await fetch(`${apiUrl}/server/info`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });

            if (!serverInfoResponse.ok) {
                return { ...printer, status: 'offline', printerState: null };
            }

            // Get printer status
            const printerStatusResponse = await fetch(`${apiUrl}/printer/objects/query?print_stats&display_status`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });

            if (!printerStatusResponse.ok) {
                return { ...printer, status: 'online', printerState: 'unknown' };
            }

            const printerData = await printerStatusResponse.json();
            const printStats = printerData.result?.status?.print_stats || {};
            const displayStatus = printerData.result?.status?.display_status || {};
            
            // Get virtual_sdcard for accurate printing progress
            const virtualSdcardResponse = await fetch(`${apiUrl}/printer/objects/query?virtual_sdcard=null`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });
            
            let printProgress = null;
            let isPrintingActive = false;
            let currentFileName = null;
            
            if (virtualSdcardResponse.ok) {
                const virtualSdcardData = await virtualSdcardResponse.json();
                const virtualSdcard = virtualSdcardData.result?.status?.virtual_sdcard || {};
                
                if (virtualSdcard.is_active && virtualSdcard.progress !== undefined) {
                    // Convert progress from decimal (0-1) to percentage (0-100)
                    printProgress = Math.round(virtualSdcard.progress * 100);
                    isPrintingActive = virtualSdcard.is_active;
                    currentFileName = virtualSdcard.file_path || null;
                }
            }
            
            // Get temperature info
            const tempResponse = await fetch(`${apiUrl}/printer/objects/query?heater_bed&extruder`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });
            
            let temperature = null;
            if (tempResponse.ok) {
                const tempData = await tempResponse.json();
                const heaterBed = tempData.result?.status?.heater_bed || {};
                const extruder = tempData.result?.status?.extruder || {};
                temperature = {
                    bed: heaterBed.temperature || 0,
                    extruder: extruder.temperature || 0
                };
            }

            // Determine printer state
            let state = printStats.state || 'unknown';
            
            // If virtual_sdcard shows active printing but state is not printing, update state
            if (isPrintingActive && state !== 'printing') {
                state = 'printing';
            }
            
            // Map "complete" state to "done" for better UX
            if (state === 'complete') {
                state = 'done';
            }
            
            // Use progress from virtual_sdcard if available, otherwise fallback to old calculation
            let progress = printProgress;
            if (progress === null && state === 'printing') {
                // Fallback: calculate progress from print_duration if virtual_sdcard not available
                if (printStats.print_duration && printStats.total_duration) {
                    progress = Math.round((printStats.print_duration / printStats.total_duration) * 100);
                } else if (printStats.print_duration) {
                    progress = 0; // Will be updated as print progresses
                }
            }

            // Get filename from printStats if not available from virtual_sdcard
            // Preserve existing filename if we have one, otherwise use new one
            const filename = currentFileName || printStats.filename || printer.printStats?.filename || null;
            
            return {
                ...printer,
                status: 'online',
                printerState: state,
                printProgress: progress,
                temperature: temperature,
                printStats: {
                    filename: filename,
                    printDuration: printStats.print_duration || 0
                }
            };

        } catch (error) {
            // Network error or timeout
            console.error(`Error checking Moonraker for ${printer.ip}:`, error);
            return { ...printer, status: 'offline', printerState: null };
        }
    }

    async addPrinter(name, ip) {
        // Check if printer with this IP already exists
        if (this.printers.find(p => p.ip === ip)) {
            alert('A printer with this IP address already exists');
            return;
        }

        try {
            const currentHost = window.location.hostname;
            const response = await fetch(`http://${currentHost}:3000/api/printers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, ip })
            });

            if (response.ok) {
                // Reload printers from server to get the saved version
                this.printers = await this.loadPrinters();
                this.renderPrinters();
                // Check status immediately after adding
                setTimeout(() => {
                    this.checkPrintersStatus();
                }, 500);
            } else {
                alert('Failed to add printer to server');
            }
        } catch (error) {
            console.error('Error adding printer:', error);
            alert('Error adding printer: ' + error.message);
        }
    }

    async addAllPrinters(printersToAdd) {
        let addedCount = 0;
        let skippedCount = 0;

        try {
            const currentHost = window.location.hostname;
            
            // Add each printer via API
            for (const printer of printersToAdd) {
                // Check if printer with this IP already exists
                if (!this.printers.find(p => p.ip === printer.ip)) {
                    const response = await fetch(`http://${currentHost}:3000/api/printers`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ name: printer.name, ip: printer.ip })
                    });
                    
                    if (response.ok) {
                        addedCount++;
                    }
                } else {
                    skippedCount++;
                }
            }

            // Reload printers from server
            this.printers = await this.loadPrinters();
            this.renderPrinters();
            
            // Check status immediately after adding
            if (addedCount > 0) {
                setTimeout(() => {
                    this.checkPrintersStatus();
                }, 500);
            }

            // Show feedback
            if (addedCount > 0 && skippedCount > 0) {
                alert(`Added ${addedCount} printer(s). ${skippedCount} printer(s) were already in your list.`);
            } else if (addedCount > 0) {
                alert(`Successfully added ${addedCount} printer(s)!`);
            } else {
                alert('All printers are already in your list.');
            }
        } catch (error) {
            console.error('Error adding printers:', error);
            alert('Error adding printers: ' + error.message);
        }
    }

    async editPrinterName(printerId) {
        // Close menu
        const menu = document.getElementById(`menu-${printerId}`);
        if (menu) menu.style.display = 'none';

        const printer = this.printers.find(p => p.id === printerId);
        if (!printer) {
            alert('Printer not found');
            return;
        }

        const newName = prompt('Enter new printer name:', printer.name);
        if (newName === null) {
            // User cancelled
            return;
        }

        const trimmedName = newName.trim();
        if (!trimmedName) {
            alert('Printer name cannot be empty');
            return;
        }

        if (trimmedName === printer.name) {
            // No change
            return;
        }

        try {
            const currentHost = window.location.hostname;
            const response = await fetch(`http://${currentHost}:3000/api/printers/${printerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: trimmedName })
            });

            if (response.ok) {
                // Reload printers from server
                this.printers = await this.loadPrinters();
                this.renderPrinters();
            } else {
                const data = await response.json();
                alert(`Failed to update printer name: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error updating printer name:', error);
            alert('Failed to update printer name. Please try again.');
        }
    }

    async removePrinter(printerId) {
        // Close menu
        const menu = document.getElementById(`menu-${printerId}`);
        if (menu) menu.style.display = 'none';

        if (!confirm('Are you sure you want to remove this printer?')) {
            return;
        }

        try {
            const currentHost = window.location.hostname;
            const response = await fetch(`http://${currentHost}:3000/api/printers/${printerId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Reload printers from server
                this.printers = await this.loadPrinters();
                this.renderPrinters();
            } else {
                const data = await response.json();
                alert(`Failed to remove printer: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error removing printer:', error);
            alert('Failed to remove printer. Please try again.');
        }
    }

    openPrinterDashboard(printerIp) {
        // Open printer dashboard in new tab (port 80)
        const dashboardUrl = `http://${printerIp}:80`;
        window.open(dashboardUrl, '_blank');
    }

    async pausePrint(printerId, printerIp) {
        const printer = this.printers.find(p => p.id === printerId);
        if (!printer) {
            alert('Printer not found');
            return;
        }

        if (!confirm(`Pause print on ${printer.name}?`)) {
            return;
        }

        try {
            const currentHost = window.location.hostname;
            const response = await fetch(`http://${currentHost}:3000/api/moonraker/${printerIp}/printer/print/pause`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || data.details || 'Failed to pause print');
            }

            alert(`Print paused on ${printer.name}`);
            
            // Refresh printer status
            setTimeout(() => {
                this.checkPrintersStatus();
            }, 1000);
        } catch (error) {
            console.error('Error pausing print:', error);
            alert(`Failed to pause print: ${error.message}`);
        }
    }

    async cancelPrint(printerId, printerIp) {
        // Close menu
        const menu = document.getElementById(`menu-${printerId}`);
        if (menu) menu.style.display = 'none';

        const printer = this.printers.find(p => p.id === printerId);
        if (!printer) {
            alert('Printer not found');
            return;
        }

        if (!confirm(`Cancel print on ${printer.name}? This action cannot be undone.`)) {
            return;
        }

        try {
            const currentHost = window.location.hostname;
            const response = await fetch(`http://${currentHost}:3000/api/moonraker/${printerIp}/printer/print/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || data.details || 'Failed to cancel print');
            }

            alert(`Print canceled on ${printer.name}`);
            
            // Refresh printer status
            setTimeout(() => {
                this.checkPrintersStatus();
            }, 1000);
        } catch (error) {
            console.error('Error canceling print:', error);
            alert(`Failed to cancel print: ${error.message}`);
        }
    }

    getStateLabel(state) {
        const stateLabels = {
            'printing': '🟢 Printing',
            'paused': '⏸️ Paused',
            'complete': '✅ Done',
            'done': '✅ Done',
            'cancelled': '❌ Cancelled',
            'error': '⚠️ Error',
            'standby': '💤 Standby',
            'ready': '✅ Ready',
            'unknown': '❓ Unknown',
            'offline': '🔴 Offline'
        };
        return stateLabels[state] || `❓ ${state}`;
    }

    getStateColor(state) {
        const stateColors = {
            'printing': '#28a745',
            'paused': '#ffc107',
            'complete': '#28a745',
            'done': '#28a745',
            'cancelled': '#dc3545',
            'error': '#dc3545',
            'standby': '#6c757d',
            'ready': '#28a745',
            'unknown': '#6c757d',
            'offline': '#dc3545'
        };
        return stateColors[state] || '#6c757d';
    }

    openThumbnailModal(thumbnailUrl, filename = null) {
        const modal = document.getElementById('thumbnailModal');
        const modalImg = document.getElementById('thumbnailModalImage');
        const modalFileName = document.getElementById('thumbnailModalFileName');
        const closeBtn = document.querySelector('.thumbnail-modal-close');
        
        if (!modal || !modalImg) {
            console.error('Thumbnail modal elements not found');
            return;
        }
        
        // Set the image source
        modalImg.src = thumbnailUrl;
        
        // Set the filename if provided
        if (modalFileName) {
            if (filename) {
                modalFileName.textContent = filename;
                modalFileName.style.display = 'block';
            } else {
                modalFileName.style.display = 'none';
            }
        }
        
        // Show the modal
        modal.style.display = 'flex';
        
        // Close modal when clicking the X button
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.style.display = 'none';
            };
        }
        
        // Close modal when clicking outside the image
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
        
        // Close modal with Escape key
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                modal.style.display = 'none';
                document.removeEventListener('keydown', escapeHandler);
            }
        });
    }
}

// Initialize printers manager when page loads
let printersManager;
window.printerManager = null; // Make it globally accessible
document.addEventListener('DOMContentLoaded', async () => {
    printersManager = new PrintersManager();
    window.printerManager = printersManager; // Make it globally accessible for onclick handlers
    await printersManager.init();
    
    // Refresh printer statuses every 10 seconds
    setInterval(() => {
        printersManager.checkPrintersStatus();
    }, 10000);
});

