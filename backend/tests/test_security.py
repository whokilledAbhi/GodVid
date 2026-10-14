import pytest
from pathlib import Path
from app.security import (
    validate_url_security, parse_and_validate_batch, sanitize_filename,
    ensure_path_within_dir, is_ip_restricted
)


def test_ssrf_ip_restriction():
    # Loopback
    assert is_ip_restricted("127.0.0.1") is True
    assert is_ip_restricted("127.1.2.3") is True
    assert is_ip_restricted("::1") is True
    
    # Private RFC 1918
    assert is_ip_restricted("10.0.0.1") is True
    assert is_ip_restricted("172.16.5.4") is True
    assert is_ip_restricted("192.168.1.1") is True

    # Link-local / Cloud metadata
    assert is_ip_restricted("169.254.169.254") is True
    assert is_ip_restricted("169.254.1.1") is True

    # Carrier-grade NAT
    assert is_ip_restricted("100.64.0.1") is True

    # Public IP
    assert is_ip_restricted("8.8.8.8") is False
    assert is_ip_restricted("1.1.1.1") is False


def test_url_security_schemes():
    # Only HTTP and HTTPS
    assert validate_url_security("http://example.com", check_dns=False)[0] is True
    assert validate_url_security("https://example.com", check_dns=False)[0] is True
    
    # Reject other schemes
    assert validate_url_security("file:///etc/passwd", check_dns=False)[0] is False
    assert validate_url_security("javascript:alert(1)", check_dns=False)[0] is False
    assert validate_url_security("ftp://ftp.example.com", check_dns=False)[0] is False
    assert validate_url_security("data:text/plain;base64,SGVsbG8=", check_dns=False)[0] is False


def test_url_security_blocked_hosts():
    assert validate_url_security("http://localhost:8000", check_dns=False)[0] is False
    assert validate_url_security("http://127.0.0.1/admin", check_dns=False)[0] is False
    assert validate_url_security("http://metadata.google.internal/computeMetadata/v1", check_dns=False)[0] is False


def test_parse_and_validate_batch():
    raw_input = """
    https://www.youtube.com/watch?v=dQw4w9WgXcQ
    https://vimeo.com/76979871, https://www.youtube.com/watch?v=dQw4w9WgXcQ
    file:///secret.txt
    https://example.com/video1.mp4  https://example.com/video2.mp4
    """
    res = parse_and_validate_batch(raw_input, max_batch_size=5, check_dns=False)
    
    # Deduplication and rejection
    valid = res["valid_urls"]
    invalid = res["invalid_urls"]
    
    assert "https://www.youtube.com/watch?v=dQw4w9WgXcQ" in valid
    assert "https://vimeo.com/76979871" in valid
    assert "https://example.com/video1.mp4" in valid
    assert "https://example.com/video2.mp4" in valid
    
    # Check invalid contains file:///
    assert any("file:///" in inv["url"] for inv in invalid)
    
    # Ensure no duplicates in valid_urls
    assert len(valid) == len(set(valid))


def test_sanitize_filename():
    assert sanitize_filename("Normal Title.mp4") == "Normal Title.mp4"
    assert sanitize_filename("../../etc/passwd") == "etc_passwd"
    assert sanitize_filename("Dangerous: <Name>? *Bar|") == "Dangerous_ _Name_ _Bar"
    assert sanitize_filename("CON.mp4") == "file_CON.mp4"
    assert sanitize_filename("AUX.mkv") == "file_AUX.mkv"
    assert sanitize_filename("  trailing spaces...  ") == "trailing spaces"
    assert sanitize_filename("") == "video"


def test_path_traversal_prevention(tmp_path):
    base_dir = tmp_path / "downloads"
    base_dir.mkdir()
    
    safe_file = base_dir / "safe.mp4"
    safe_file.touch()
    
    # Safe path passes
    assert ensure_path_within_dir(safe_file, base_dir) == safe_file.resolve()
    
    # Traversal attempts fail
    unsafe_file = base_dir / ".." / "secret.txt"
    with pytest.raises(ValueError, match="Path traversal detected"):
        ensure_path_within_dir(unsafe_file, base_dir)
