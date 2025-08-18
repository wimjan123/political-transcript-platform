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
        tree = ET.parse(file_path)
        root = tree.getroot()

        filename = Path(file_path).name

        title = self._find_text(root, ["sessionTitle", "title", "VergaderingTitel", "vergadering_titel"]) or filename
        date_value = self._find_text(root, ["date", "Datum", "vergadering_datum"]) or root.attrib.get("date")
        session_date: Optional[date] = None
        if date_value:
            for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y%m%d", "%d/%m/%Y"):
                try:
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
        # Try common element names for utterances
        utterance_tags = ["utterance", "speech", "Uitspraak", "Uitsprak", "interruption", "interruptie"]
        utterance_elements: List[ET.Element] = []
        for tag in utterance_tags:
            utterance_elements.extend(root.findall(f".//{tag}"))

        # If no hits, fall back to any elements with a speaker child and text
        if not utterance_elements:
            for el in root.iter():
                if el.find("speaker") is not None and (el.text or "" ).strip():
                    utterance_elements.append(el)

        for idx, u in enumerate(utterance_elements):
            kind = (u.attrib.get("kind") or u.tag or "speech").lower()
            start = _parse_time_to_seconds(u.attrib.get("start") or (u.findtext("start") or None))
            end = _parse_time_to_seconds(u.attrib.get("end") or (u.findtext("end") or None))
            duration = end - start if (start is not None and end is not None and end >= start) else None
            text = (u.findtext("text") or u.text or "").strip()
            text_plain = _strip_preamble(text)

            speaker_el = u.find("speaker")
            display_name = (speaker_el.findtext("display_name") if speaker_el is not None else None) or (
                speaker_el.findtext("name") if speaker_el is not None else None
            ) or (speaker_el.text.strip() if (speaker_el is not None and speaker_el.text) else None) or ""
            first_name = speaker_el.findtext("first_name") if speaker_el is not None else None
            last_name = speaker_el.findtext("last_name") if speaker_el is not None else None
            party = speaker_el.findtext("party") if speaker_el is not None else None
            role_type = speaker_el.findtext("role_type") if speaker_el is not None else None

            speaker_name = display_name or ""
            segment: Dict[str, Any] = {
                "segment_id": f"{filename}-{idx+1}",
                "speaker_name": speaker_name,
                "transcript_text": text_plain or text,
                "video_seconds": start,
                "timestamp_start": None,
                "timestamp_end": None,
                "duration_seconds": duration,
                "word_count": len((text_plain or text).split()),
                "char_count": len(text_plain or text),
            }

            segments.append(segment)

        return {
            "video_metadata": video_metadata,
            "segments": segments,
            "total_segments": len(segments),
        }

    def _find_text(self, root: ET.Element, tags: List[str]) -> Optional[str]:
        for t in tags:
            el = root.find(f".//{t}")
            if el is not None and (el.text or "").strip():
                return el.text.strip()
        return None

