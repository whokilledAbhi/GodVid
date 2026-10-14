import ipaddress
import re
import socket
import urllib.parse
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

# Restricted IP networks for SSRF protection
RESTRICTED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),       # Link-local / Cloud metadata (169.254.169.254)
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("100.64.0.0/10"),        # Carrier-grade NAT
    ipaddress.ip_network("192.0.0.0/24"),
    ipaddress.ip_network("192.0.2.0/24"),         # TEST-NET-1
    ipaddress.ip_network("198.18.0.0/15"),        # Benchmarking
    ipaddress.ip_network("198.51.100.0/24"),      # TEST-NET-2
    ipaddress.ip_network("203.0.113.0/24"),       # TEST-NET-3
    ipaddress.ip_network("224.0.0.0/4"),          # Multicast
    ipaddress.ip_network("240.0.0.0/4"),          # Reserved
    ipaddress.ip_network("255.255.255.255/32"),
    # IPv6 restricted ranges
    ipaddress.ip_network("::1/128"),              # Loopback
    ipaddress.ip_network("::/128"),               # Unspecified
    ipaddress.ip_network("::ffff:0:0/96"),        # IPv4-mapped
    ipaddress.ip_network("fc00::/7"),             # Unique local address
    ipaddress.ip_network("fe80::/10"),            # Link-local unicast
    ipaddress.ip_network("ff00::/8"),             # Multicast
]

# Prohibited hostnames (cloud metadata, localhost aliases)
BLOCKED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "127.0.0.1",
    "::1",
    "metadata.google.internal",
    "metadata.azure.com",
    "instance-data",
}

# Windows reserved file names
WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
}


def is_ip_restricted(ip_str: str) -> bool:
    """Check if an IP string falls into restricted/private ranges."""
    try:
        ip = ipaddress.ip_address(ip_str)
        # Check standard properties
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return True
        # Check against explicitly enumerated networks
        for network in RESTRICTED_NETWORKS:
            if ip in network:
                return True
        return False
    except ValueError:
        return False


def validate_url_security(url: str, check_dns: bool = True) -> Tuple[bool, Optional[str]]:
    """
    Validate that a URL is safe from SSRF and has a valid HTTP/HTTPS scheme.
    """
    if not url or not isinstance(url, str):
        return False, "URL cannot be empty"

    url = url.strip()
    if len(url) > 2048:
        return False, "URL length exceeds maximum limit (2048 characters)"

    try:
        parsed = urllib.parse.urlsplit(url)
    except Exception as e:
        return False, f"Invalid URL syntax: {e}"

    scheme = parsed.scheme.lower()
    if scheme not in ("http", "https"):
        return False, f"Unsupported URL scheme '{scheme}'. Only http:// and https:// are permitted."

    hostname = parsed.hostname
    if not hostname:
        return False, "URL does not contain a valid hostname"

    hostname_lower = hostname.lower()

    if hostname_lower in BLOCKED_HOSTNAMES:
        return False, f"Access to '{hostname}' is restricted"

    if hostname_lower.endswith(".local") or hostname_lower.endswith(".internal"):
        return False, f"Access to internal domain '{hostname}' is restricted"

    # Check if hostname itself is an IP literal
    try:
        if is_ip_restricted(hostname):
            return False, f"IP address '{hostname}' is restricted (private or loopback)"
    except Exception:
        pass

    if check_dns:
        port = parsed.port or (443 if scheme == "https" else 80)
        try:
            addr_info = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
            if not addr_info:
                return False, f"Could not resolve host '{hostname}'"

            for res in addr_info:
                sockaddr = res[4]
                ip_addr = sockaddr[0]
                if is_ip_restricted(ip_addr):
                    return False, f"Host '{hostname}' resolves to restricted IP: {ip_addr}"
        except socket.gaierror as e:
            return False, f"DNS resolution failed for '{hostname}': {e}"
        except Exception as e:
            return False, f"Failed to verify address for '{hostname}': {e}"

    return True, None


def parse_and_validate_batch(raw_input: str, max_batch_size: int = 50, check_dns: bool = True) -> Dict[str, Any]:
    """
    Extract, normalize, deduplicate, and validate URLs from raw multi-line or delimited text.
    """
    if not raw_input or not raw_input.strip():
        return {
            "valid_urls": [],
            "invalid_urls": [],
            "total_detected": 0,
            "deduplicated_count": 0,
            "error": "No URLs provided"
        }

    # Split by newlines, carriage returns, or commas, preserving URL structure
    # Matches URLs or tokens separated by newlines, spaces, or commas
    tokens = re.split(r'[\r\n,]+|\s{2,}', raw_input)
    
    seen = set()
    valid_urls: List[str] = []
    invalid_urls: List[Dict[str, str]] = []
    total_tokens = 0

    for token in tokens:
        candidate = token.strip()
        if not candidate:
            continue
        # Check if candidate has multiple space-separated parts
        subparts = candidate.split()
        for sub in subparts:
            sub = sub.strip()
            if not sub:
                continue
            total_tokens += 1
            # Clean trailing punctuation often attached from prose
            cleaned = re.sub(r'[\)\]\>\"\']+$', '', sub)
            
            if cleaned in seen:
                continue
            seen.add(cleaned)

            is_safe, error_msg = validate_url_security(cleaned, check_dns=check_dns)
            if is_safe:
                if len(valid_urls) >= max_batch_size:
                    invalid_urls.append({
                        "url": cleaned,
                        "error": f"Batch size limit reached (max {max_batch_size} URLs per batch)"
                    })
                else:
                    valid_urls.append(cleaned)
            else:
                invalid_urls.append({
                    "url": cleaned,
                    "error": error_msg or "Invalid URL"
                })

    return {
        "valid_urls": valid_urls,
        "invalid_urls": invalid_urls,
        "total_detected": total_tokens,
        "deduplicated_count": len(valid_urls) + len(invalid_urls),
        "limit_reached": len(valid_urls) >= max_batch_size
    }


def sanitize_filename(name: str, max_length: int = 150, fallback: str = "video") -> str:
    """
    Sanitize an untrusted video title or filename into a secure, cross-platform filename.
    Guarantees no path traversal, control chars, or Windows reserved names.
    """
    if not name or not isinstance(name, str):
        return fallback

    # Remove null bytes and control chars
    clean = re.sub(r'[\x00-\x1f\x7f]', '', name)
    
    # Strip directory traversal sequences
    clean = re.sub(r'(\.\.[/\\])+', '', clean)
    clean = clean.replace('..', '')

    # Replace dangerous filesystem characters with underscore
    clean = re.sub(r'[<>:"/\\|?*]', '_', clean)
    
    # Collapse multiple underscores
    clean = re.sub(r'_+', '_', clean)
    
    # Strip leading/trailing spaces, dots, and underscores
    clean = clean.strip('._ ')

    # If empty after cleaning
    if not clean:
        clean = fallback

    # Check for Windows reserved names
    base_name = clean.split('.')[0].upper()
    if base_name in WINDOWS_RESERVED_NAMES:
        clean = f"file_{clean}"

    # Truncate length while preserving reasonable extension if present
    if len(clean) > max_length:
        parts = clean.rsplit('.', 1)
        if len(parts) == 2 and len(parts[1]) <= 6:
            ext = "." + parts[1]
            stem = parts[0][:max_length - len(ext)]
            clean = stem + ext
        else:
            clean = clean[:max_length]

    return clean.strip('. ') or fallback


def ensure_path_within_dir(target_path: Path, base_dir: Path) -> Path:
    """
    Ensure target_path resolves strictly within base_dir to prevent directory traversal.
    """
    resolved_target = target_path.resolve()
    resolved_base = base_dir.resolve()
    
    try:
        resolved_target.relative_to(resolved_base)
    except ValueError:
        raise ValueError(f"Path traversal detected: {target_path} is outside base directory {base_dir}")
        
    return resolved_target
