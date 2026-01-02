#!/usr/bin/env python3
"""
Prototype script to scan network for Klipper printers using Moonraker API.
Tests the /server/info endpoint on port 7125.
"""

import asyncio
import aiohttp
import sys
from typing import List, Dict, Optional
import ipaddress


async def check_printer(session: aiohttp.ClientSession, ip: str, timeout: int = 2, port: int = 80) -> Optional[Dict]:
    """
    Check if a specific IP has a Klipper printer (Moonraker API) running.
    
    Args:
        session: aiohttp session
        ip: IP address to check
        timeout: Request timeout in seconds
        port: Port number (default: 80)
        
    Returns:
        Dict with printer info if found, None otherwise
    """
    url = f"http://{ip}:{port}/server/info"
    
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
            if response.status == 200:
                data = await response.json()
                
                # Try to get printer name/identifier
                printer_name = f"Printer {ip}"
                try:
                    printer_url = f"http://{ip}:{port}/printer/info"
                    async with session.get(printer_url, timeout=aiohttp.ClientTimeout(total=timeout)) as printer_response:
                        if printer_response.status == 200:
                            printer_data = await printer_response.json()
                            printer_name = (
                                printer_data.get("result", {}).get("hostname") or
                                printer_data.get("result", {}).get("name") or
                                printer_name
                            )
                except:
                    pass  # Ignore errors getting printer name
                
                return {
                    "ip": ip,
                    "name": printer_name,
                    "moonraker_connected": data.get("result", {}).get("klippy_connected", False),
                    "info": data.get("result", {})
                }
    except (aiohttp.ClientError, asyncio.TimeoutError, Exception):
        # IP doesn't have Moonraker or is unreachable
        return None


async def scan_network(network_base: str, start: int = 1, end: int = 254, max_concurrent: int = 20, port: int = 80) -> List[Dict]:
    """
    Scan a network range for Klipper printers.
    
    Args:
        network_base: Network base (e.g., "192.168.1")
        start: Starting IP last octet
        end: Ending IP last octet
        max_concurrent: Maximum concurrent requests
        port: Port number to scan (default: 80)
        
    Returns:
        List of discovered printers
    """
    discovered_printers = []
    
    # Create list of IPs to scan
    ips_to_scan = [f"{network_base}.{i}" for i in range(start, end + 1)]
    
    # Use semaphore to limit concurrent requests
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def check_with_semaphore(session, ip):
        async with semaphore:
            return await check_printer(session, ip, port=port)
    
    async with aiohttp.ClientSession() as session:
        # Create tasks for all IPs
        tasks = [check_with_semaphore(session, ip) for ip in ips_to_scan]
        
        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out None results and exceptions
        for result in results:
            if result and isinstance(result, dict):
                discovered_printers.append(result)
    
    return discovered_printers


async def main():
    """Main function for command-line usage."""
    if len(sys.argv) > 1:
        # Parse IP range from command line
        ip_range = sys.argv[1]
        if "-" in ip_range:
            # Format: 192.168.1.1-254
            base, range_part = ip_range.rsplit(".", 1)
            start_str, end_str = range_part.split("-")
            network_base = base
            start = int(start_str)
            end = int(end_str)
        else:
            # Single IP or network base
            if "/" in ip_range:
                # CIDR notation
                network = ipaddress.ip_network(ip_range, strict=False)
                network_base = ".".join(str(network.network_address).split(".")[:3])
                start = 1
                end = 254
            else:
                # Assume network base like "192.168.1"
                network_base = ip_range
                start = 1
                end = 254
    else:
        # Default: scan 192.168.1.1-254
        network_base = "192.168.1"
        start = 1
        end = 254
    
    print(f"Scanning network {network_base}.{start}-{end} for Klipper printers...")
    print("This may take 10-30 seconds...\n")
    
    printers = await scan_network(network_base, start, end)
    
    if printers:
        print(f"Found {len(printers)} printer(s):\n")
        for printer in printers:
            print(f"  • {printer['name']} ({printer['ip']}:80)")
            print(f"    Status: {'Connected' if printer['moonraker_connected'] else 'Disconnected'}")
    else:
        print("No Klipper printers found.")
    
    return printers


if __name__ == "__main__":
    # Run full scan
    asyncio.run(main())

