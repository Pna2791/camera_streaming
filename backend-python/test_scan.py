#!/usr/bin/env python3
"""
Quick test script to test scanning a specific IP.
Usage: python test_scan.py 192.168.1.17
"""

import asyncio
import aiohttp
import sys
from scan_printers import check_printer


async def test_single_ip(ip: str, port: int = 80):
    """Test scanning a single IP."""
    print(f"Testing: http://{ip}:{port}/server/info")
    
    async with aiohttp.ClientSession() as session:
        result = await check_printer(session, ip, timeout=5, port=port)
        
        if result:
            print(f"\n✓ Found printer!")
            print(f"  IP: {result['ip']}")
            print(f"  Name: {result['name']}")
            print(f"  Moonraker Connected: {result['moonraker_connected']}")
            if result['info']:
                print(f"  Info: {result['info']}")
        else:
            print(f"\n✗ No printer found at {ip}:{port}")
            print("  Make sure:")
            print(f"    - Printer is powered on")
            print(f"    - Moonraker is running on port {port}")
            print("    - IP address is correct")


if __name__ == "__main__":
    ip = sys.argv[1] if len(sys.argv) > 1 else "192.168.1.17"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 80
    asyncio.run(test_single_ip(ip, port))

