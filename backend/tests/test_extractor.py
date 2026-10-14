import pytest
from app.extractor import classify_extractor_error, is_direct_file_url
from app.downloader import build_format_selector


def test_classify_extractor_error():
    assert "DRM" in classify_extractor_error("This video is DRM protected")
    assert "login credentials" in classify_extractor_error("Sign in to confirm your age")
    assert "geographic" in classify_extractor_error("Video is not available in your country due to geoblocking")
    assert "not found" in classify_extractor_error("HTTP Error 404: Not Found")
    assert "not currently supported" in classify_extractor_error("Unsupported URL: no suitable extractor")
    assert "rate-limiting" in classify_extractor_error("HTTP Error 429: Too Many Requests")


def test_is_direct_file_url():
    assert is_direct_file_url("https://example.com/assets/video.mp4") is True
    assert is_direct_file_url("https://example.com/movie.mkv?token=123") is True
    assert is_direct_file_url("https://example.com/audio.mp3") is True
    assert is_direct_file_url("https://www.youtube.com/watch?v=123") is False
    assert is_direct_file_url("https://vimeo.com/456") is False


def test_build_format_selector():
    # Audio only
    assert build_format_selector("audio_only", "mp3") == "bestaudio/best"
    
    # Specific resolutions
    sel_1080 = build_format_selector("1080p", "mp4")
    assert "height<=1080" in sel_1080

    sel_720 = build_format_selector("720p", "mp4")
    assert "height<=720" in sel_720

    # Best
    assert build_format_selector("best", "mp4") == "bestvideo+bestaudio/best"
