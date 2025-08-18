"""
VLOS XML parser for Tweede Kamer proceedings

Parses XML files to extract session metadata and utterances into a
uniform structure consumable by the import service.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, date
from pathlib import Path
from typing import Any, Dict, List, Optional


def _parse_time_to_seconds(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    value = value.strip()
    # Accept formats like HH:MM:SS or MM:SS or seconds
    try:
        if value.isdigit():
            return int(value)
        parts = value.split(":")
        parts = [int(p) for p in parts]
        if len(parts) == 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
        if len(parts) == 2:
            return parts[0] * 60 + parts[1]
    except Exception:
        return None
    return None


_PREAMBLE_RE = re.compile(
    r"^(\s*(De\s+(heer|mevrouw|voorzitter)|Minister|Staatssecretaris)\s+[^:]+:)\s*",
    re.IGNORECASE,
)


def _strip_preamble(text: str) -> str:
    if not text:
        return text
    return _PREAMBLE_RE.sub("", text).strip()


class VLOSXMLParser:
    """Lightweight XML parser that tolerates schema variance."""

    def parse_file(self, file_path: str) -> Dict[str, Any]:
        # Read and sanitize XML content (remove scraper comment, stray BOMs)
        raw = Path(file_path).read_bytes()
        try:
            text = raw.decode("utf-8")
        except Exception:
            # Fall back to latin-1 then convert
            text = raw.decode("latin-1")
        # Drop leading scraper metadata comment if present
        text = re.sub(r"^\s*<!--\s*scraper-metadata:base64:[\s\S]*?-->\s*", "", text)
        # Remove any BOM characters and common double-encoded BOM glyphs
        text = text.replace("\ufeff", "")
        text = re.sub(r"^(?:\s*(?:\ufeff|\u00EF\u00BB\u00BF))+", "", text)
        # Parse XML
        root = ET.fromstring(text)

        filename = Path(file_path).name

        title = self._find_text(root, ["titel", "sessionTitle", "title", "VergaderingTitel", "vergadering_titel"]) or filename
        date_value = self._find_text(root, ["datum", "date", "Datum", "vergadering_datum"]) or root.attrib.get("date")
        session_date: Optional[date] = None
        if date_value:
            for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y%m%d", "%d/%m/%Y"):
                try:
                    # accept datetime strings
                    session_date = datetime.strptime(date_value[:10], fmt).date()
                    break
                except Exception:
                    continue

        video_metadata: Dict[str, Any] = {
            "filename": filename,
            "title": title,
            "date": session_date,
            "source": "Tweede Kamer",
            "channel": "VLOS XML",
            "description": None,
            "url": None,
            "format": "Parliamentary Session",
            "candidate": None,
            "place": "Den Haag, NL",
            "record_type": "Parliamentary Proceedings",
        }

        segments: List[Dict[str, Any]] = []
        # Namespace-insensitive traversal helpers
        def local(el: ET.Element) -> str:
            t = el.tag
            return t.split('}')[-1] if '}' in t else t

        # Extract session start/end times if available
        start_time = self._find_text(root, ["aanvangstijd", "start_time"]) or None
        end_time = self._find_text(root, ["sluiting", "eindtijd", "end_time"]) or None
        # Find all text blocks under any <tekst> elements
        current_speaker: Optional[str] = None
        idx = 0
        for tekst in root.iter():
            if local(tekst) != "tekst":
                continue
            # Look for timing info within ancestor activiteithoofd
            ancestor = tekst
            mark_start = None
            mark_end = None
            # climb up a couple of levels
            parent = ancestor
            for _ in range(3):
                parent = getattr(parent, 'getparent', lambda: None)() if hasattr(parent, 'getparent') else None
                if parent is None:
                    break
                ms = None
                me = None
                for ch in list(parent):
                    if local(ch) == "markeertijdbegin":
                        ms = ch.text
                    if local(ch) == "markeertijdeind":
                        me = ch.text
                mark_start = mark_start or ms
                mark_end = mark_end or me

            for alinea in tekst:
                if local(alinea) != "alinea":
                    continue
                for item in alinea:
                    if local(item) != "alineaitem":
                        continue
                    # If this line is emphasized with a colon, treat as speaker line
                    raw_text_parts: List[str] = []
                    def _gather_text(e: ET.Element):
                        if e.text:
                            raw_text_parts.append(e.text)
                        for c in list(e):
                            _gather_text(c)
                            if c.tail:
                                raw_text_parts.append(c.tail)
                    _gather_text(item)
                    raw_text = ("".join(raw_text_parts)).strip()
                    if not raw_text:
                        continue
                    # see if it contains speaker preamble like "Voorzitter: Name" or "De heer X:" etc
                    if ":" in raw_text and len(raw_text) <= 120:
                        # Heuristic: treat short colon-lines as speaker headers
                        maybe_name = raw_text.split(":", 1)[0]
                        # normalize
                        current_speaker = maybe_name.strip()
                        continue
                    idx += 1
                    text_plain = _strip_preamble(raw_text)
                    start_sec = None
                    end_sec = None
                    if mark_start:
                        try:
                            # markeertijdbegin is ISO datetime; convert to seconds offset not trivial without video ref
                            start_sec = None
                        except Exception:
                            start_sec = None
                    segment: Dict[str, Any] = {
                        "segment_id": f"{filename}-{idx}",
                        "speaker_name": (current_speaker or "Onbekend"),
                        "transcript_text": text_plain,
                        "video_seconds": start_sec,
                        "timestamp_start": None,
                        "timestamp_end": None,
                        "duration_seconds": None,
                        "word_count": len(text_plain.split()),
                        "char_count": len(text_plain),
                    }
                    segments.append(segment)

        return {
            "video_metadata": video_metadata,
            "segments": segments,
            "total_segments": len(segments),
        }

    def _find_text(self, root: ET.Element, tags: List[str]) -> Optional[str]:
        def _local(el: ET.Element) -> str:
            return el.tag.split('}')[-1] if '}' in el.tag else el.tag
        for el in root.iter():
            name = _local(el)
            if name in tags and (el.text or "").strip():
                return el.text.strip()
        return None
