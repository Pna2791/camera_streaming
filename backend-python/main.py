"""
FastAPI backend for Klipper printer management and camera streaming.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import asyncio
import aiohttp
from contextlib import asynccontextmanager

# Import scanner function
from scan_printers import check_printer, scan_network

app = FastAPI(title="Camera Streaming & Klipper API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class ScanRequest(BaseModel):
    ipRange: Optional[str] = None
    startIp: Optional[str] = None
    endIp: Optional[str] = None


class PrinterInfo(BaseModel):
    ip: str
    name: str
    moonraker_connected: bool
    info: Dict


class ScanResponse(BaseModel):
    success: bool
    discovered: int
    printers: List[PrinterInfo]
    scannedRange: str


# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "camera-streaming-api-python",
        "version": "1.0.0"
    }


# Scan network for Klipper printers
@app.post("/api/scan-printers", response_model=ScanResponse)
async def scan_printers(request: ScanRequest):
    """
    Scan network for Klipper printers using Moonraker API on port 80.
    """
    network_base = None
    start = 1
    end = 254
    
    # Determine IP range to scan
    if request.ipRange:
        # Parse range like "192.168.1.1-254" or "192.168.1.0/24"
        if "-" in request.ipRange:
            base, range_part = request.ipRange.rsplit(".", 1)
            start_str, end_str = range_part.split("-")
            network_base = base
            start = int(start_str)
            end = int(end_str)
        elif "/" in request.ipRange:
            # CIDR notation
            import ipaddress
            network = ipaddress.ip_network(request.ipRange, strict=False)
            network_base = ".".join(str(network.network_address).split(".")[:3])
            start = 1
            end = 254
        else:
            raise HTTPException(
                status_code=400,
                detail='Invalid IP range format. Use format like "192.168.1.1-254" or "192.168.1.0/24"'
            )
    elif request.startIp and request.endIp:
        # Parse start and end IPs
        start_parts = request.startIp.split(".")
        end_parts = request.endIp.split(".")
        if len(start_parts) == 4 and len(end_parts) == 4:
            if start_parts[:3] == end_parts[:3]:
                network_base = ".".join(start_parts[:3])
                start = int(start_parts[3])
                end = int(end_parts[3])
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Start and end IPs must be on the same network"
                )
        else:
            raise HTTPException(status_code=400, detail="Invalid IP format")
    else:
        # Default: scan common local network range
        network_base = "192.168.1"
        start = 1
        end = 254
    
    # Validate range
    if start < 1 or end > 254 or start > end:
        raise HTTPException(
            status_code=400,
            detail="Invalid IP range. Last octet must be between 1 and 254"
        )
    
    # Scan network (using port 80)
    try:
        printers = await scan_network(network_base, start, end, max_concurrent=20, port=80)
        
        return ScanResponse(
            success=True,
            discovered=len(printers),
            printers=[PrinterInfo(**p) for p in printers],
            scannedRange=f"{network_base}.{start}-{end}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error during network scan: {str(e)}"
        )


# Moonraker API proxy endpoints
@app.get("/api/moonraker/{printer_ip:path}")
async def moonraker_proxy(printer_ip: str, path: str = "server/info"):
    """
    Proxy requests to Moonraker API.
    Format: /api/moonraker/{ip}/{moonraker_path}
    """
    # Extract IP and path from the route
    parts = printer_ip.split("/", 1)
    ip = parts[0]
    moonraker_path = parts[1] if len(parts) > 1 else "server/info"
    
    # Build Moonraker URL (using port 80)
    moonraker_url = f"http://{ip}:80/{moonraker_path}"
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                moonraker_url,
                timeout=aiohttp.ClientTimeout(total=3)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data
                else:
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Moonraker API error: {response.status}"
                    )
    except aiohttp.ClientError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to Moonraker: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)

