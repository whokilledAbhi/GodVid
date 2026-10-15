import urllib.request
import urllib.parse
import base64
import re
import json
import logging
import subprocess
import shutil
from typing import Optional, Dict, Any, List

logger = logging.getLogger("sniffer")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

DEFAULT_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Ch-Ua": '"Not-A.Brand";v="99", "Chromium";v="124"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
}


def _clean_title(raw: str) -> str:
    """Clean site noise, pipes, and extra whitespace from extracted titles."""
    if not raw:
        return "Video"
    title = re.sub(r"&[a-zA-Z]+;", " ", raw)
    parts = re.split(r"\s+[|\-•]\s+[A-Za-z0-9\s.]+$", title)
    clean = parts[0].strip() if parts else title.strip()
    return clean or "Video"


def _fetch_html_resilient(url: str, referer: Optional[str] = None) -> Optional[str]:
    """
    Fetch webpage HTML using standard urllib with an immediate fallback to Windows Schannel curl.exe.
    Handles Cloudflare TLS renegotiation, anti-bot handshake resets (WinError 10054), and redirects.
    """
    headers = dict(DEFAULT_HEADERS)
    if referer:
        headers["Referer"] = referer

    # 1. Attempt standard urllib
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            content_type = resp.headers.get("Content-Type", "")
            if any(t in content_type.lower() for t in ["video/", "audio/", "application/vnd.apple.mpegurl", "application/x-mpegurl"]):
                return f"__DIRECT_MEDIA_TYPE__{url}"
            return resp.read().decode("utf-8", errors="ignore")
    except Exception as e:
        logger.debug(f"urllib fetch failed for {url} ({e}); falling back to Windows Schannel curl...")

    # 2. Resilient curl.exe fallback (built-in Windows 10/11)
    curl_bin = shutil.which("curl") or "curl.exe"
    try:
        cmd = [
            curl_bin,
            "-s",
            "--ssl-no-revoke",
            "-L",
            "-A", USER_AGENT,
            "--max-time", "20",
            url
        ]
        if referer:
            cmd.extend(["-e", referer])
        p = subprocess.run(cmd, capture_output=True, timeout=25)
        if p.returncode == 0 and len(p.stdout) > 0:
            return p.stdout.decode("utf-8", errors="ignore")
    except Exception as err:
        logger.warning(f"Resilient curl fetch failed for {url}: {err}")

    return None


def sniff_page_media(url: str, max_depth: int = 1) -> Optional[Dict[str, Any]]:
    """
    Deep-scrapes a webpage for embedded video streams, iframes, HTML5 video tags,
    JSON-LD, base64 player configurations, and direct MP4/M3U8 URLs.
    """
    html = _fetch_html_resilient(url)
    if not html:
        return None

    if html.startswith("__DIRECT_MEDIA_TYPE__"):
        stream_url = html.replace("__DIRECT_MEDIA_TYPE__", "")
        return {
            "title": _clean_title(urllib.parse.urlsplit(url).path.split("/")[-1]),
            "thumbnail": None,
            "duration": None,
            "stream_url": stream_url,
            "all_candidates": [stream_url],
            "referer": url,
        }

    # Title extraction
    title = None
    m_og_title = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']', html, re.I)
    if m_og_title:
        title = m_og_title.group(1).strip()
    else:
        m_tw_title = re.search(r'<meta[^>]+name=["\']twitter:title["\'][^>]+content=["\']([^"\']+)["\']', html, re.I)
        if m_tw_title:
            title = m_tw_title.group(1).strip()
        else:
            m_t = re.search(r"<title>(.*?)</title>", html, re.I | re.S)
            if m_t:
                title = m_t.group(1).strip()

    title = _clean_title(title or "")

    # Thumbnail extraction
    thumbnail = None
    m_og_img = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', html, re.I)
    if m_og_img:
        thumbnail = urllib.parse.urljoin(url, m_og_img.group(1).strip())
    else:
        m_poster = re.search(r'poster=["\']([^"\']+)["\']', html, re.I)
        if m_poster:
            thumbnail = urllib.parse.urljoin(url, m_poster.group(1).strip())

    candidates: List[str] = []
    iframes: List[str] = []

    # Target video ID from URL (e.g. /shorts/980284/ -> 980284, /post/127611 -> 127611)
    id_match = re.search(r"/shorts/(\d+)", url) or re.search(r"/videos?/(\d+)", url) or re.search(r"/posts?/(\d+)", url)
    target_id = id_match.group(1) if id_match else None

    # Identify primary video player on single-post / watch pages
    primary_stream = None
    if target_id:
        m_v = re.search(rf'<video[^>]*id=["\'][^"\']*{target_id}[^"\']*["\'][^>]*>(.*?)</video>', html, re.I | re.S)
        if m_v:
            m_s = re.search(r'<source[^>]+src=["\']([^"\']+)["\']', m_v.group(1), re.I)
            if m_s:
                primary_stream = urllib.parse.urljoin(url, m_s.group(1))

    if not primary_stream:
        m_first_v = re.search(r'<video[^>]*>(.*?)</video>', html, re.I | re.S)
        if m_first_v:
            m_s = re.search(r'<source[^>]+src=["\']([^"\']+)["\']', m_first_v.group(1), re.I)
            if m_s:
                primary_stream = urllib.parse.urljoin(url, m_s.group(1))

    # 1. Attributes data-full, data-preview, data-src (tube and shorts sites)
    for m in re.findall(r'(?:data-full|data-preview|data-src|data-video)=["\']([^"\']+)["\']', html, re.I):
        candidates.append(urllib.parse.urljoin(url, m))

    # 2. Base64 encoded video tags or query params (common in WordPress tube plugins)
    for b64_match in re.findall(r"(?:q=|data=|tag=|source=|video=)([A-Za-z0-9+/=]{28,})", html):
        try:
            unquoted = urllib.parse.unquote(b64_match)
            decoded = base64.b64decode(unquoted).decode("utf-8", errors="ignore")
            for m in re.findall(r'(https?://[^\s"\'<>]+\.(?:mp4|m3u8|webm)(?:/[^\s"\'<>]*|\?[^\s"\'<>]*)?)', decoded, re.I):
                candidates.append(m)
            if not thumbnail:
                m_post = re.search(r'poster=["\']([^"\']+)["\']', decoded, re.I)
                if m_post:
                    thumbnail = m_post.group(1).strip()
        except Exception:
            pass

    # 3. HTML5 <video> and <source> tags
    for src in re.findall(r'<(?:video|source)[^>]+src=["\']([^"\']+)["\']', html, re.I):
        if not src.startswith("blob:") and not src.startswith("data:"):
            candidates.append(urllib.parse.urljoin(url, src))

    # 4. OpenGraph / Twitter video tags
    for og_vid in re.findall(
        r'<meta[^>]+(?:property|name)=["\'](?:og:video|og:video:url|og:video:secure_url|twitter:player:stream)["\'][^>]+content=["\']([^"\']+)["\']',
        html,
        re.I
    ):
        candidates.append(urllib.parse.urljoin(url, og_vid))

    # 5. JSON-LD Schema.org VideoObject
    for ld in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.I | re.S):
        try:
            data = json.loads(ld)
            items = data if isinstance(data, list) else [data]
            for it in items:
                if isinstance(it, dict) and it.get("@type") == "VideoObject":
                    if it.get("contentUrl"):
                        candidates.append(it["contentUrl"])
                    if it.get("embedUrl"):
                        iframes.append(it["embedUrl"])
                    if it.get("name") and not title:
                        title = _clean_title(it["name"])
                    if it.get("thumbnailUrl") and not thumbnail:
                        thumbnail = it["thumbnailUrl"]
        except Exception:
            pass

    # 6. Inline JavaScript player variables (JWPlayer, VideoJS, Plyr)
    clean_html = html.replace("\\/", "/").replace("&amp;", "&")
    for js_src in re.findall(r'(?:file|source|src|video_url|stream_url|hls)\s*[:=]\s*["\'](https?://[^"\']+\.(?:mp4|m3u8|webm)(?:/[^\s"\'<>]*|\?[^\s"\'<>]*)?)["\']', clean_html, re.I):
        candidates.append(js_src)

    # 7. Direct media links across page body (including trailing slash variants)
    for m in re.findall(r'(https?://[^\s"\'<>]+\.(?:mp4|m3u8|webm)(?:/[^\s"\'<>]*|\?[^\s"\'<>]*)?)', clean_html, re.I):
        candidates.append(m)

    # 8. Embedded RedGifs links
    for rg in re.findall(r'(https?://(?:www\.)?redgifs\.com/watch/[a-zA-Z0-9]+)', clean_html, re.I):
        iframes.append(rg)

    # 9. Collect iframes for deeper inspection
    for ifr in re.findall(r'<iframe[^>]+src=["\']([^"\']+)["\']', html, re.I):
        full_ifr = urllib.parse.urljoin(url, ifr)
        iframes.append(full_ifr)

    # Clean and prioritize candidates
    unique_candidates: List[str] = []
    seen = set()

    IMAGE_EXTENSIONS = (
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".ico",
        ".css", ".js", ".woff", ".woff2", ".ttf", ".bmp", ".tiff"
    )

    if primary_stream:
        clean_p = primary_stream.split("?")[0].lower()
        if not any(clean_p.endswith(ext) for ext in IMAGE_EXTENSIONS):
            seen.add(primary_stream)
            unique_candidates.append(primary_stream)

    for c in candidates:
        c = c.strip()
        if not c or c in seen:
            continue
        clean_url = c.split("?")[0].lower().rstrip("/")
        if any(clean_url.endswith(ext) for ext in IMAGE_EXTENSIONS):
            continue
        if any(bad in c.lower() for bad in ["adsystem", "doubleclick", "analytics", "pixel", "facebook.com/tr"]):
            continue
        seen.add(c)
        unique_candidates.append(c)

    def rank_candidate(link: str) -> int:
        score = 0
        if primary_stream and link == primary_stream:
            score += 10000
        if target_id and (f"/{target_id}/" in link or f"/{target_id}_" in link or f"={target_id}" in link or f"{target_id}." in link):
            score += 2000
        if "1080" in link or "2160" in link:
            score += 300
        elif "720" in link:
            score += 200
        elif "480" in link:
            score += 100
        return score

    unique_candidates.sort(key=rank_candidate, reverse=True)

    if unique_candidates:
        return {
            "title": title or "Media Video",
            "thumbnail": thumbnail,
            "duration": None,
            "stream_url": unique_candidates[0],
            "all_candidates": unique_candidates,
            "referer": url,
        }

    # Inspect embedded iframes or redgifs if direct candidates not found
    if max_depth > 0 and iframes:
        for ifr_url in iframes:
            if "redgifs.com" in ifr_url.lower():
                return {
                    "title": title or "RedGifs Video",
                    "thumbnail": thumbnail,
                    "duration": None,
                    "stream_url": ifr_url,
                    "all_candidates": [ifr_url],
                    "referer": url,
                }
            if any(p in ifr_url.lower() for p in ["player", "embed", "video", "clean-tube", "vimeo", "stream"]):
                sub_res = sniff_page_media(ifr_url, max_depth=0)
                if sub_res and sub_res.get("stream_url"):
                    return {
                        "title": title or sub_res.get("title") or "Embedded Video",
                        "thumbnail": thumbnail or sub_res.get("thumbnail"),
                        "duration": sub_res.get("duration"),
                        "stream_url": sub_res["stream_url"],
                        "all_candidates": sub_res.get("all_candidates", []),
                        "referer": ifr_url,
                    }

    return None
