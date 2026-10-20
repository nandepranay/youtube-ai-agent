import re
from typing import List, Optional, Tuple
from urllib.parse import parse_qs, urlparse

# Strict YouTube Video ID Regex (11 chars of alphanumeric + '-' + '_')
YOUTUBE_VIDEO_ID_REGEX = re.compile(r'^[a-zA-Z0-9_-]{11}$')

# Broad regex to locate potential YouTube URLs inside arbitrary text
YOUTUBE_URL_REGEX = re.compile(
    r'(https?://(?:www\.|m\.)?(?:youtube\.com/(?:watch\?[^\s"\'<>]*v=|shorts/|embed/|v/)|youtu\.be/)[a-zA-Z0-9_-]{11}(?:[^\s"\'<>]*)?)',
    re.IGNORECASE
)

def extract_video_id(url_or_id: str) -> Optional[str]:
    """
    Extracts standard 11-character YouTube video ID from various URL formats or returns the ID if already clean.
    Supports:
    - https://www.youtube.com/watch?v=dQw4w9WgXcQ
    - https://youtu.be/dQw4w9WgXcQ
    - https://www.youtube.com/shorts/dQw4w9WgXcQ
    - https://www.youtube.com/embed/dQw4w9WgXcQ
    - https://m.youtube.com/watch?v=dQw4w9WgXcQ
    - https://www.youtube.com/watch?feature=player_embedded&v=dQw4w9WgXcQ
    - Raw ID: dQw4w9WgXcQ
    """
    if not url_or_id:
        return None
        
    s = url_or_id.strip()
    
    # Check if string is already a direct valid 11-char ID
    if YOUTUBE_VIDEO_ID_REGEX.match(s):
        return s

    try:
        parsed = urlparse(s)
        hostname = (parsed.hostname or "").lower()

        if "youtu.be" in hostname:
            path_parts = parsed.path.strip("/").split("/")
            if path_parts and YOUTUBE_VIDEO_ID_REGEX.match(path_parts[0]):
                return path_parts[0]

        if "youtube.com" in hostname:
            if parsed.path == "/watch":
                qs = parse_qs(parsed.query)
                v_list = qs.get("v")
                if v_list and YOUTUBE_VIDEO_ID_REGEX.match(v_list[0]):
                    return v_list[0]
            elif parsed.path.startswith("/shorts/"):
                parts = parsed.path.split("/shorts/")
                if len(parts) > 1:
                    vid = parts[1].split("/")[0].split("?")[0]
                    if YOUTUBE_VIDEO_ID_REGEX.match(vid):
                        return vid
            elif parsed.path.startswith("/embed/"):
                parts = parsed.path.split("/embed/")
                if len(parts) > 1:
                    vid = parts[1].split("/")[0].split("?")[0]
                    if YOUTUBE_VIDEO_ID_REGEX.match(vid):
                        return vid
            elif parsed.path.startswith("/v/"):
                parts = parsed.path.split("/v/")
                if len(parts) > 1:
                    vid = parts[1].split("/")[0].split("?")[0]
                    if YOUTUBE_VIDEO_ID_REGEX.match(vid):
                        return vid

    except Exception:
        pass

    return None

def validate_youtube_url(url: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Validates a YouTube URL.
    Returns (is_valid, video_id, normalized_url).
    """
    vid = extract_video_id(url)
    if vid:
        normalized_url = f"https://www.youtube.com/watch?v={vid}"
        return True, vid, normalized_url
    return False, None, None

def extract_all_youtube_urls_from_text(text: str) -> List[str]:
    """Finds all YouTube URLs or raw video IDs mentioned in user text."""
    if not text:
        return []
    matches = YOUTUBE_URL_REGEX.findall(text)
    # Deduplicate while preserving order
    unique_urls = []
    seen_ids = set()
    for m in matches:
        vid = extract_video_id(m)
        if vid and vid not in seen_ids:
            seen_ids.add(vid)
            unique_urls.append(f"https://www.youtube.com/watch?v={vid}")
    return unique_urls
