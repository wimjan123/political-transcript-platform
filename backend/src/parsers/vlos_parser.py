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


# Precompiled regex for speaker detection (used by _extract_speaker_name and _strip_preamble)
SPEAKER_FULL_RE = re.compile(
    r"^\s*(?P<prefix>(De\s+(?:heer|mevrouw)|Mevrouw|Minister|Staatssecretaris|De))?\s*"
    r"(?P<name>[^:<>()\n]+?)(?:\s*\([^)]+\))?\s*:",
    re.IGNORECASE,
)

# Tighten party extraction to plausible short party codes (letters and digits, 1-6 chars)
_PARTY_RE = re.compile(r"\(([A-Z0-9]{1,6})\)")

# Patterns to identify announcements vs. spoken content
ANNOUNCEMENT_PATTERNS = [
    re.compile(r"^Aanwezig zijn \d+ leden der Kamer", re.IGNORECASE),
    re.compile(r"^en (mevrouw|de heer)", re.IGNORECASE),  # continuation of attendance list
    re.compile(r"^alsmede", re.IGNORECASE),  # "also present"
    re.compile(r"^De vergadering wordt", re.IGNORECASE),  # meeting start/end
    re.compile(r"^Aan de orde", re.IGNORECASE),  # agenda items
    re.compile(r"^\d+ words?$", re.IGNORECASE),  # word count indicators
    re.compile(r"^\d+:\d+$"),  # time stamps alone
    re.compile(r"^[A-Z][a-z]+ [A-Z][a-z]+, [A-Z][a-z]+,", re.IGNORECASE),  # name lists
]

# Pattern to detect false speakers (non-speaker statements)
FALSE_SPEAKER_PATTERNS = [
    re.compile(r"^(Onze|Ons|Dit|Deze|Het|De|Een)\s", re.IGNORECASE),  # Generic statements
    re.compile(r"^(In|Op|Voor|Na|Tijdens)\s", re.IGNORECASE),  # Prepositions
    re.compile(r"^(Als|Wanneer|Omdat|Doordat)\s", re.IGNORECASE),  # Conjunctions
]

def _strip_preamble(text: str) -> str:
    """Strip leading speaker preamble using the same detection logic as speaker extraction."""
    if not text:
        return text
    # Create a tag-stripped version for matching (so <nadruk> doesn't break detection)
    clean = re.sub(r"<[^>]+>", "", text).strip()
    m = SPEAKER_FULL_RE.match(clean)
    if not m:
        return text.strip()
    # Remove up to and including the first ':' from the original text to preserve any XML tags
    colon_idx = text.find(":")
    if colon_idx == -1:
        return text.strip()
    return text[colon_idx + 1 :].strip()


class VLOSXMLParser:
    """Lightweight XML parser that tolerates schema variance."""

    def __init__(self, cursor=None):
        """Initialize the parser with an optional database cursor for testing."""
        self.cursor = cursor
        # Add conn attribute for tests that expect it
        self.conn = None
        
    def _is_announcement(self, text: str) -> bool:
        """Check if text is a session announcement rather than spoken content."""
        if not text:
            return False
        text = text.strip()
        
        # Check against known announcement patterns
        for pattern in ANNOUNCEMENT_PATTERNS:
            if pattern.match(text):
                return True
        
        # Additional heuristics for announcements
        # Long lists of names (like attendance lists)
        if len(text) > 200 and text.count(',') > 5:
            return True
            
        # Text that is mostly names and commas
        words = text.split()
        if len(words) > 10:
            name_count = sum(1 for word in words if word[0].isupper() and len(word) > 2 and ',' not in word)
            if name_count / len(words) > 0.7:  # 70% names
                return True
        
        return False
    
    def _is_false_speaker(self, candidate_text: str) -> bool:
        """Check if text that looks like a speaker is actually just content."""
        if not candidate_text:
            return True
            
        # Check against false speaker patterns
        for pattern in FALSE_SPEAKER_PATTERNS:
            if pattern.match(candidate_text):
                return True
                
        # Very short phrases are likely false speakers
        if len(candidate_text.strip()) < 4:
            return True
            
        return False
    
    def _parse_datetime_to_seconds(self, value: Optional[str]) -> Optional[int]:
        """Convert ISO datetime string to seconds since midnight.
    
        Strictly accept ISO strings with both date and time (must contain 'T').
        Return None for date-only strings like "2018-11-08" as tests expect.
        """
        if not value or "T" not in value:
            return None
        try:
            # Use only the YYYY-MM-DDTHH:MM:SS portion to tolerate trailing timezone
            dt = datetime.strptime(value[:19], "%Y-%m-%dT%H:%M:%S")
            return dt.hour * 3600 + dt.minute * 60 + dt.second
        except ValueError:
            return None

    def _extract_speaker_name(self, text: str) -> str:
        """Extract clean speaker name from speaker line text.
 
        Uses the shared SPEAKER_FULL_RE for detection to keep logic consistent
        with _strip_preamble.
        """
        if not text:
            return "Onbekend"
 
        # Remove XML tags but keep inner text
        clean_text = re.sub(r"<[^>]+>", "", text).strip()
 
        # Special-case voorzitter (handle both "De voorzitter" and "Voorzitter")
        m_voor = re.match(r"^\s*(De\s+)?voorzitter\s*:", clean_text, re.IGNORECASE)
        if m_voor:
            return "De voorzitter" if m_voor.group(1) else "Voorzitter"
 
        m = SPEAKER_FULL_RE.match(clean_text)
        if not m:
            return "Onbekend"
 
        prefix = (m.group("prefix") or "").strip()
        name = (m.group("name") or "").strip()
 
        # If no recognized prefix and the name is not 'voorzitter', treat as unknown
        if not prefix:
            if name.lower() == "voorzitter":
                return "Voorzitter"
            return "Onbekend"
 
        # Preserve Minister and Staatssecretaris prefixes (they are part of the speaker name)
        if prefix.lower().startswith("minister") or prefix.lower().startswith("staatssecretaris") or prefix.lower() == "de":
            return f"{prefix} {name}".strip()
 
        # For 'De heer' and 'Mevrouw' prefixes, return only the name
        return name or "Onbekend"

    def _extract_party(self, text: str) -> str:
        """Extract political party code from speaker line text."""
        if not text:
            return ""
        
        # Extract party using regex
        match = _PARTY_RE.search(text)
        if match:
            return match.group(1).strip()
        
        return ""

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
    
        # Helper to find parent Elements (ElementTree Elements do not have parent pointers)
        import gc
        def _find_parent(node):
            for obj in gc.get_objects():
                if isinstance(obj, ET.Element):
                    try:
                        for child in list(obj):
                            if child is node:
                                return obj
                    except Exception:
                        continue
            return None
    
        # Extract session start/end times if available
        start_time = self._find_text(root, ["aanvangstijd", "start_time"]) or None
        end_time = self._find_text(root, ["sluiting", "eindtijd", "end_time"]) or None
        # Find all text blocks under any <tekst> elements
        idx = 0
        for tekst in root.iter():
            if local(tekst) != "tekst":
                continue
            # Reset speaker tracking when entering a new <tekst> element
            current_speaker = None
            detected_party = None
            # Look for timing info within ancestor activiteithoofd (search up to a few levels)
            mark_start = None
            mark_end = None
            parent = tekst
            # Try to find an associated <spreker> in ancestor nodes and set current_speaker
            temp_parent = parent
            for _ in range(5):
                temp_parent = _find_parent(temp_parent)
                if temp_parent is None:
                    break
                # If a spreker child exists, compose its aanhef + verslagnaam
                for ch in list(temp_parent):
                    if local(ch) == "spreker":
                        aanhef = None
                        verslagnaam = None
                        for s in ch.iter():
                            if local(s) == "aanhef" and s.text and not aanhef:
                                aanhef = s.text.strip()
                            if local(s) == "verslagnaam" and s.text and not verslagnaam:
                                verslagnaam = s.text.strip()
                        parts_sp = []
                        if aanhef:
                            parts_sp.append(aanhef)
                        if verslagnaam:
                            parts_sp.append(verslagnaam)
                        if parts_sp:
                            # store with trailing colon for consistent later extraction
                            current_speaker = " ".join(parts_sp).strip() + ":"
                            break
                if current_speaker:
                    break
            # Continue to collect timing as before
            parent = tekst
            for _ in range(5):
                parent = _find_parent(parent)
                if parent is None:
                    break
                for ch in list(parent):
                    if local(ch) == "markeertijdbegin" and ch.text:
                        mark_start = mark_start or ch.text
                    if local(ch) == "markeertijdeind" and ch.text:
                        mark_end = mark_end or ch.text

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
                    # Check if this is an announcement before treating as speaker/content
                    is_announcement = self._is_announcement(raw_text)
                    
                    # see if it contains speaker preamble like "Voorzitter: Name" or "De heer X:" etc
                    if ":" in raw_text and len(raw_text) <= 120 and not is_announcement:
                        # Reduce false positives: validate candidate speaker using helper.
                        # For terse colon lines compute a candidate and verify with the
                        # parser's speaker-extraction helper; this reduces false positives.
                        candidate = raw_text.split(":", 1)[0].strip()
                        
                        # Additional check for false speakers
                        if not self._is_false_speaker(candidate):
                            name = self._extract_speaker_name(candidate + ":")
                            if name != "Onbekend":
                                # store with trailing colon so extraction later recognizes it
                                current_speaker = candidate + ":"
                                # detect party from this speaker line if present (first speaker line in this tekst)
                                if detected_party is None:
                                    pm = _PARTY_RE.search(candidate)
                                    if pm:
                                        detected_party = pm.group(1).strip()
                                continue
                    idx += 1
                    text_plain = _strip_preamble(raw_text)
                    start_sec = None
                    end_sec = None
                    if mark_start:
                        start_sec = self._parse_datetime_to_seconds(mark_start)
                    if mark_end:
                        end_sec = self._parse_datetime_to_seconds(mark_end)
                    
                    # Extract speaker name and party if this is a speaker line
                    speaker_name = "Onbekend"
                    party = ""
                    segment_type = "announcement" if is_announcement else "spoken"
                    
                    if current_speaker and not is_announcement:
                        speaker_name = self._extract_speaker_name(current_speaker)
                        # Prefer any party detected from the first speaker line of the speech
                        party = detected_party if detected_party else self._extract_party(current_speaker)
                    elif is_announcement:
                        speaker_name = "Sessie-administratie"  # Session administration
                    
                    segment: Dict[str, Any] = {
                        "segment_id": f"{filename}-{idx}",
                        "speaker_name": speaker_name,
                        "speaker_party": party if party else "",
                        "segment_type": segment_type,
                        "transcript_text": text_plain,
                        "video_seconds": start_sec,
                        "timestamp_start": mark_start,
                        "timestamp_end": mark_end,
                        "duration_seconds": (end_sec - start_sec) if start_sec is not None and end_sec is not None else None,
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

    def _parse_speech_segment(self, woordvoerder) -> Dict[str, Any]:
        """Parse a single speech segment (woordvoerder element)."""
        # Extract timing information by traversing up the XML hierarchy
        start_time = None
        end_time = None
        
        # Helper function to get local tag name
        def local_tag(elem):
            return elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
        
        # First, try to find timing within the woordvoerder element itself
        for elem in woordvoerder.iter():
            tag = local_tag(elem)
            if tag == "markeertijdbegin" and elem.text:
                start_time = self._parse_datetime_to_seconds(elem.text)
            elif tag == "markeertijdeind" and elem.text:
                end_time = self._parse_datetime_to_seconds(elem.text)
        
        # If no timing found, search in parent elements
        if start_time is None or end_time is None:
            current = woordvoerder

            # ElementTree Elements do not provide parent pointers. Use a
            # conservative search over existing Element instances to find a
            # parent node (works in the unit-test environment and small docs).
            import gc

            def _find_parent(node):
                for obj in gc.get_objects():
                    # Fast check: only inspect xml Elements
                    if isinstance(obj, ET.Element):
                        try:
                            for child in list(obj):
                                if child is node:
                                    return obj
                        except Exception:
                            continue
                return None

            for _ in range(5):  # Search up to 5 levels up
                parent = _find_parent(current)
                if parent is None:
                    break

                # Look for timing in parent and siblings
                for elem in parent.iter():
                    tag = local_tag(elem)
                    if tag == "markeertijdbegin" and elem.text and start_time is None:
                        start_time = self._parse_datetime_to_seconds(elem.text)
                    elif tag == "markeertijdeind" and elem.text and end_time is None:
                        end_time = self._parse_datetime_to_seconds(elem.text)

                current = parent
        
        # Final fallback: leave start_time/end_time as None when timing is unknown.
        # Callers should handle None to indicate missing/unknown timing.
       
        # Extract speaker information (namespace-insensitive)
        speaker_name = "Onbekend"

        def local_tag(elem):
            return elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag

        spreker = None
        for el in woordvoerder.iter():
            if local_tag(el) == "spreker":
                spreker = el
                break

        if spreker is not None:
            # Find aanhef and verslagnaam within spreker (namespace-insensitive)
            aanhef_text = None
            verslagnaam_text = None
            for el in spreker.iter():
                lt = local_tag(el)
                if lt == "aanhef" and el.text and not aanhef_text:
                    aanhef_text = el.text.strip()
                if lt == "verslagnaam" and el.text and not verslagnaam_text:
                    verslagnaam_text = el.text.strip()

            parts = []
            if aanhef_text:
                parts.append(aanhef_text)
            if verslagnaam_text:
                parts.append(verslagnaam_text)

            if parts:
                speaker_text = " ".join(parts)
                speaker_name = self._extract_speaker_name(speaker_text + ":")

        # Extract content (namespace-insensitive)
        content = ""
        tekst_elem = None
        for el in woordvoerder.iter():
            if local_tag(el) == "tekst":
                tekst_elem = el
                break

        if tekst_elem is not None:
            content_parts = []
            for alinea in tekst_elem.iter():
                if local_tag(alinea) != "alinea":
                    continue
                for alineaitem in alinea.iter():
                    if local_tag(alineaitem) != "alineaitem":
                        continue
                    # Gather text (including nested nadruk, tails)
                    parts_txt = []
                    if alineaitem.text:
                        parts_txt.append(alineaitem.text)
                    for c in list(alineaitem):
                        if c.text:
                            parts_txt.append(c.text)
                        if c.tail:
                            parts_txt.append(c.tail)
                    content_line = " ".join(p.strip() for p in parts_txt if p and p.strip())
                    if content_line:
                        content_parts.append(content_line.strip())
            content = " ".join(content_parts).strip()
        
        # Check for duplicates in database if cursor is available
        if self.cursor is not None:
            # This is a simplified version - in a real implementation,
            # you would check for existing records in the database
            pass
        
        return {
            'speaker': speaker_name,
            'content': content,
            'start_time': start_time,
            'end_time': end_time
        }


# For backward compatibility with tests
VLOSParser = VLOSXMLParser
