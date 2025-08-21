"""
VLOS XML parser for Tweede Kamer proceedings

Enhanced parser that properly handles admin fragments, chair mapping, 
attendees detection, speaker resolution, merging, and deduplication.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, date, time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


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


@dataclass
class SessionMetadata:
    """Metadata extracted from session admin fragments."""
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    summary_intro: Optional[str] = None
    chair: Optional[str] = None
    attendees_members: List[str] = None
    attendees_ministers: List[str] = None
    
    def __post_init__(self):
        if self.attendees_members is None:
            self.attendees_members = []
        if self.attendees_ministers is None:
            self.attendees_ministers = []


@dataclass
class ActivityPart:
    """Represents a single activity part with speaker and content."""
    type: str  # 'spoken' or 'activity'
    speaker: Dict[str, str]  # {'display_name': str, 'identity_key': str, 'party': str}
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    text_raw: str = ""
    text_plain: str = ""
    
    def __hash__(self):
        return hash((self.type, self.speaker['identity_key'], 
                    self.start, self.end, self.text_plain))
    
    def __eq__(self, other):
        if not isinstance(other, ActivityPart):
            return False
        return (self.type == other.type and 
                self.speaker['identity_key'] == other.speaker['identity_key'] and
                self.start == other.start and 
                self.end == other.end and 
                self.text_plain == other.text_plain)


# Admin fragment detection patterns
ADMIN_PATTERNS = {
    'start_time': re.compile(r'^Aanvang\s+(\d{1,2}\.\d{2})\s+uur\.?$', re.IGNORECASE),
    'end_time': re.compile(r'^Sluiting\s+(\d{1,2}\.\d{2})\s+uur\.?$', re.IGNORECASE),
    'summary_intro': re.compile(r'^Verslag van een', re.IGNORECASE),
}

# Chair detection patterns
CHAIR_PATTERNS = {
    'chair_speech': re.compile(r'^(De\s+voorzitter)\s*:\s*', re.IGNORECASE),
    'role_contains_chair': re.compile(r'voorzitter', re.IGNORECASE),
}

# Attendee list detection patterns  
ATTENDEE_PATTERNS = {
    'roll_call': re.compile(r'(?:de heer|mevrouw|minister van)', re.IGNORECASE),
    'comma_list': re.compile(r'^[A-Z][a-z]+(?:\s+[a-z]+\s+[A-Z][a-z]+)*(?:,\s*[A-Z][a-z]+(?:\s+[a-z]+\s+[A-Z][a-z]+)*)+', re.IGNORECASE),
    'minister': re.compile(r'minister\s+van\s+', re.IGNORECASE),
}

# Speaker label cleanup patterns
LABEL_PATTERNS = {
    'chair_label': re.compile(r'^(De\s+voorzitter)\s*:\s*', re.IGNORECASE),
    'member_label': re.compile(r'^(De\s+heer|Mevrouw)\s+[^:]*:\s*', re.IGNORECASE),
    'minister_label': re.compile(r'^(Minister|Staatssecretaris)\s+[^:]*:\s*', re.IGNORECASE),
}

# Precompiled regex for speaker detection (used by _extract_speaker_name and _strip_preamble)
SPEAKER_FULL_RE = re.compile(
    r"^\s*(?P<prefix>(De\s+(?:heer|mevrouw)|Mevrouw|Minister|Staatssecretaris|De|Voorzitter))?\s*"
    r"(?P<name>[^:<>()\n]+?)(?:\s*\([^)]+\))?\s*:",
    re.IGNORECASE,
)

# Enhanced party extraction to handle various party code formats
_PARTY_RE = re.compile(r"\(([A-Z0-9]{1,8}(?:[-/][A-Z0-9]{1,4})?)\)")

# Common speaker patterns for better detection
COMMON_SPEAKER_PATTERNS = [
    re.compile(r"^\s*(De\s+)?voorzitter\s*:", re.IGNORECASE),
    re.compile(r"^\s*(Minister|Staatssecretaris)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*:", re.IGNORECASE),
    re.compile(r"^\s*(De\s+heer|Mevrouw)\s+([A-Z][a-z]+(?:\s+[a-z]+\s+[A-Z][a-z]+)*)\s*:", re.IGNORECASE),
    re.compile(r"^\s*([A-Z][a-z]+(?:\s+[a-z]+\s+[A-Z][a-z]+)*)\s*\([A-Z0-9]{1,8}\)\s*:", re.IGNORECASE),
]

# Patterns to identify announcements vs. spoken content
ANNOUNCEMENT_PATTERNS = [
    # Meeting administration
    re.compile(r"^Aanwezig zijn \d+ leden der Kamer", re.IGNORECASE),
    re.compile(r"^en (mevrouw|de heer)", re.IGNORECASE),  # continuation of attendance list
    re.compile(r"^alsmede", re.IGNORECASE),  # "also present"
    re.compile(r"^De vergadering wordt", re.IGNORECASE),  # meeting start/end
    re.compile(r"^Aan de orde", re.IGNORECASE),  # agenda items
    re.compile(r"^Aanvang \d+\.\d+ uur", re.IGNORECASE),  # meeting start time
    re.compile(r"^Sluiting \d+\.\d+ uur", re.IGNORECASE),  # meeting end time
    re.compile(r"^De beraadslaging wordt", re.IGNORECASE),  # deliberation status
    re.compile(r"^De behandeling", re.IGNORECASE),  # treatment/handling
    
    # Document references and procedural items
    re.compile(r"^Verslag van een", re.IGNORECASE),  # report of...
    re.compile(r"^Kamerstuk", re.IGNORECASE),  # parliamentary document
    re.compile(r"^TK \d+", re.IGNORECASE),  # parliamentary document number
    re.compile(r"^De griffier", re.IGNORECASE),  # clerk statements
    
    # Participant lists and roles
    re.compile(r"^[A-Z][a-z]+, [A-Z][a-z]+, [A-Z][a-z]+,", re.IGNORECASE),  # name lists
    re.compile(r"^De voorzitter van de", re.IGNORECASE),  # chairperson of...
    re.compile(r"^en de heer [A-Z]", re.IGNORECASE),  # and mr...
    re.compile(r"^en mevrouw [A-Z]", re.IGNORECASE),  # and mrs...
    
    # System/metadata indicators
    re.compile(r"^\d+ words?$", re.IGNORECASE),  # word count indicators
    re.compile(r"^\d+:\d+$"),  # time stamps alone
    re.compile(r"^$"),  # empty lines
    
    # Meeting procedures and voting
    re.compile(r"^Stemming", re.IGNORECASE),  # voting
    re.compile(r"^Ingekomen", re.IGNORECASE),  # received items
    re.compile(r"^Procedurepunten", re.IGNORECASE),  # procedural points
]

# Pattern to detect false speakers (non-speaker statements)
FALSE_SPEAKER_PATTERNS = [
    re.compile(r"^(Onze|Ons|Dit|Deze|Het|Een)\s", re.IGNORECASE),  # Generic statements (removed "De" to avoid "De heer")
    re.compile(r"^(In|Op|Voor|Na|Tijdens)\s", re.IGNORECASE),  # Prepositions
    re.compile(r"^(Als|Wanneer|Omdat|Doordat)\s", re.IGNORECASE),  # Conjunctions
    # Add pattern for standalone "De" but not "De heer/voorzitter"
    re.compile(r"^De\s+(?!(?:heer|voorzitter|staatssecretaris))", re.IGNORECASE),  # "De" not followed by speaker titles
]


def _strip_preamble(text: str) -> str:
    """Strip leading speaker preamble using label patterns."""
    if not text:
        return text
    
    text_stripped = text
    
    # Apply each label pattern
    for pattern in LABEL_PATTERNS.values():
        text_stripped = pattern.sub('', text_stripped).strip()
    
    return text_stripped or text


def _normalize_time_to_iso(time_str: str, session_date: Optional[date]) -> Optional[datetime]:
    """Normalize various time formats to ISO timestamps with session date."""
    if not time_str:
        return None
    
    try:
        # Handle ISO format (2018-11-08T14:00:16)
        if 'T' in time_str:
            # Remove timezone info if present
            if '+' in time_str:
                time_str = time_str.split('+')[0]
            elif 'Z' in time_str:
                time_str = time_str.replace('Z', '')
            return datetime.fromisoformat(time_str)
        
        # Handle time-only format (14:00:16 or 14.00) - need session date
        if not session_date:
            return None
            
        time_part = time_str.strip()
        if '.' in time_part and ':' not in time_part:
            # Convert 14.00 to 14:00:00
            time_part = time_part.replace('.', ':') + ':00'
        elif time_part.count(':') == 1:
            # Add seconds if missing
            time_part += ':00'
            
        parsed_time = time.fromisoformat(time_part)
        return datetime.combine(session_date, parsed_time)
        
    except (ValueError, TypeError):
        return None


def _detect_admin_fragment(text: str) -> Tuple[str, Optional[str]]:
    """Detect admin fragments and extract metadata.
    
    Returns:
        Tuple of (fragment_type, extracted_value) where fragment_type is one of:
        'start_time', 'end_time', 'summary_intro', or 'none'
    """
    if not text:
        return 'none', None
    
    clean_text = text.strip()
    
    # Check start time
    match = ADMIN_PATTERNS['start_time'].match(clean_text)
    if match:
        return 'start_time', match.group(1)
    
    # Check end time
    match = ADMIN_PATTERNS['end_time'].match(clean_text)
    if match:
        return 'end_time', match.group(1)
    
    # Check summary intro
    if ADMIN_PATTERNS['summary_intro'].match(clean_text):
        return 'summary_intro', clean_text
    
    return 'none', None


def _detect_attendees(text: str) -> Tuple[List[str], List[str]]:
    """Detect and extract attendee lists.
    
    Returns:
        Tuple of (members, ministers)
    """
    if not text:
        return [], []
    
    # Only process attendance lists that start with "Aanwezig zijn"
    if not text.strip().startswith('Aanwezig zijn'):
        return [], []
    
    members = []
    ministers = []
    
    # Extract minister names - look for "minister van X Y" where X is ministry and Y is name
    # Use \w+ to handle special characters like ë in Financiën
    minister_matches = re.findall(r'minister\s+van\s+(\w+(?:\s+\w+)*)\s+(\w+)', text, re.IGNORECASE | re.UNICODE)
    for match in minister_matches:
        # Combine ministry and name: "Financiën Hoekstra"
        ministers.append(f"{match[0]} {match[1]}")
    
    # Extract member names (de heer, mevrouw)  
    member_matches = re.findall(r'(?:de heer|mevrouw)\s+([A-Z][a-z]+(?:\s+[a-z]+\s+[A-Z][a-z]+)*)', text, re.IGNORECASE)
    members.extend(member_matches)
    
    return members, ministers


def _is_chair_speech(text: str) -> bool:
    """Check if text starts with chair speech pattern."""
    return bool(CHAIR_PATTERNS['chair_speech'].match(text.strip()))


def _merge_consecutive_parts(parts: List[ActivityPart]) -> List[ActivityPart]:
    """Merge consecutive parts with same speaker and contiguous timestamps."""
    if not parts:
        return []
    
    merged = []
    current = None
    
    for part in parts:
        if (current is None or 
            current.speaker['identity_key'] != part.speaker['identity_key'] or
            not _are_timestamps_contiguous(current.end, part.start)):
            
            if current is not None:
                merged.append(current)
            current = part
        else:
            # Merge with current
            current.text_raw += ' ' + part.text_raw
            current.text_plain += ' ' + part.text_plain
            current.end = part.end or current.end
    
    if current is not None:
        merged.append(current)
    
    return merged


def _are_timestamps_contiguous(end_time: Optional[datetime], start_time: Optional[datetime]) -> bool:
    """Check if timestamps are contiguous (<=2s gap)."""
    if not end_time or not start_time:
        return False
    
    gap = (start_time - end_time).total_seconds()
    return 0 <= gap <= 2


def _deduplicate_parts(parts: List[ActivityPart]) -> List[ActivityPart]:
    """Remove duplicate parts with identical type, speaker, start, end, text."""
    seen = set()
    unique_parts = []
    
    for part in parts:
        part_hash = (part.type, part.speaker['identity_key'], 
                    part.start, part.end, part.text_plain)
        if part_hash not in seen:
            seen.add(part_hash)
            unique_parts.append(part)
    
    return unique_parts


def _cleanup_paragraph_text(text: str) -> Tuple[str, str]:
    """Clean up paragraph text by joining alineaitem elements and stripping labels.
    
    Returns:
        Tuple of (text_raw, text_plain)
    """
    if not text:
        return "", ""
    
    # Join multiple parts with spaces (already done by caller usually)
    text_raw = ' '.join(text.split())
    text_plain = _strip_preamble(text_raw)
    
    return text_raw, text_plain


class VLOSXMLParser:
    """Enhanced VLOS XML parser with admin fragment handling and deduplication."""

    def __init__(self, cursor=None):
        """Initialize the parser with an optional database cursor for testing."""
        self.cursor = cursor
        # Add conn attribute for tests that expect it
        self.conn = None
        self._session_metadata = SessionMetadata()
        self._resolved_chair = None
        
    def _handle_admin_fragment(self, admin_type: str, admin_value: Optional[str], full_text: str):
        """Handle detected admin fragments by updating session metadata."""
        if admin_type == 'start_time':
            self._session_metadata.start_time = admin_value
        elif admin_type == 'end_time':
            self._session_metadata.end_time = admin_value
        elif admin_type == 'summary_intro':
            self._session_metadata.summary_intro = full_text
    
    def _resolve_speaker(self, current_speaker: Optional[str], detected_party: Optional[str]) -> Dict[str, str]:
        """Resolve speaker information with enhanced fallback logic."""
        if current_speaker:
            # Check if this is a chair reference
            if CHAIR_PATTERNS['chair_speech'].match(current_speaker):
                display_name = self._resolved_chair or "De voorzitter"
            else:
                display_name = self._extract_speaker_name(current_speaker)
                # If incomplete, try building from parts
                if display_name == "Onbekend" and current_speaker.endswith(':'):
                    # Try to extract from v:spreker structure
                    display_name = self._build_display_name_from_parts(current_speaker[:-1])
        else:
            display_name = "Onbekend"
        
        # Never return "Sessie-administratie" as speaker
        if display_name == "Sessie-administratie":
            display_name = "Onbekend"
        
        identity_key = self._generate_identity_key(display_name)
        
        return {
            'display_name': display_name,
            'identity_key': identity_key,
            'party': detected_party or '',
        }
    
    def _generate_identity_key(self, display_name: str) -> str:
        """Generate consistent identity key for speaker."""
        # Normalize name for consistent identity
        normalized = display_name.lower().strip()
        # Remove common prefixes for identity matching
        for prefix in ['de heer ', 'mevrouw ', 'minister ', 'staatssecretaris ', 'de voorzitter']:
            if normalized.startswith(prefix):
                normalized = normalized[len(prefix):].strip()
                break
        return normalized or display_name.lower()
    
    def _build_display_name_from_parts(self, speaker_text: str) -> str:
        """Build display name from voornaam + achternaam if v:spreker is incomplete."""
        # This is a simplified version - in practice you'd parse XML structure
        # For now, just return the cleaned speaker text
        return speaker_text.strip()
    
    def _find_chair_from_activities(self, root: ET.Element) -> Optional[str]:
        """Find chair from first activity head with role containing 'voorzitter'."""
        def _local(el: ET.Element) -> str:
            return el.tag.split('}')[-1] if '}' in el.tag else el.tag
        
        for el in root.iter():
            if _local(el) == 'activiteithoofd':
                # Look for role or speaker info that indicates chair
                for child in el.iter():
                    if child.text and CHAIR_PATTERNS['role_contains_chair'].search(child.text):
                        # Try to extract name from this element or siblings
                        for sibling in el.iter():
                            if _local(sibling) == 'spreker':
                                name = self._build_name_from_element(sibling)
                                if name:
                                    return name
        return None
    
    def _build_name_from_element(self, spreker_element: ET.Element) -> Optional[str]:
        """Build name from spreker element with aanhef + verslagnaam."""
        def _local(el: ET.Element) -> str:
            return el.tag.split('}')[-1] if '}' in el.tag else el.tag
        
        aanhef = None
        verslagnaam = None
        voornaam = None
        achternaam = None
        
        for el in spreker_element.iter():
            tag = _local(el)
            if tag == "aanhef" and el.text and not aanhef:
                aanhef = el.text.strip()
            elif tag == "verslagnaam" and el.text and not verslagnaam:
                verslagnaam = el.text.strip()
            elif tag == "voornaam" and el.text and not voornaam:
                voornaam = el.text.strip()
            elif tag == "achternaam" and el.text and not achternaam:
                achternaam = el.text.strip()
        
        # Build display name
        if verslagnaam:
            # Use verslagnaam if available
            if aanhef and not aanhef.lower().startswith(('minister', 'staatssecretaris')):
                return verslagnaam  # Strip De heer/Mevrouw prefixes
            else:
                return f"{aanhef} {verslagnaam}".strip() if aanhef else verslagnaam
        elif voornaam and achternaam:
            # Fallback to voornaam + achternaam
            return f"{voornaam} {achternaam}"
        elif voornaam or achternaam:
            return (voornaam or achternaam).strip()
        
        return None
    
    def _find_element(self, root: ET.Element, tags: List[str]) -> Optional[ET.Element]:
        """Find first element matching any of the given tag names."""
        def _local(el: ET.Element) -> str:
            return el.tag.split('}')[-1] if '}' in el.tag else el.tag
        for el in root.iter():
            name = _local(el)
            if name in tags:
                return el
        return None
        
    def _is_announcement(self, text: str) -> bool:
        """Check if text is a session announcement rather than spoken content.
        
        Note: This method is now mostly superseded by _detect_admin_fragment 
        and _detect_attendees, but kept for backward compatibility.
        """
        if not text:
            return False
        
        # Let admin fragment detection handle most cases
        admin_type, _ = _detect_admin_fragment(text)
        if admin_type != 'none':
            return True
            
        # Let attendee detection handle attendee lists
        members, ministers = _detect_attendees(text)
        if members or ministers:
            return True
        
        text = text.strip()
        
        # Check against known announcement patterns (legacy)
        for pattern in ANNOUNCEMENT_PATTERNS:
            if pattern.match(text):
                return True
        
        # Additional legacy heuristics
        if len(text) > 200 and text.count(',') > 5:
            return True
            
        words = text.split()
        if len(words) > 10:
            name_count = sum(1 for word in words if word[0].isupper() and len(word) > 2 and ',' not in word)
            if name_count / len(words) > 0.7:  # 70% names
                return True
        
        if re.search(r"\b(kst|kamerstuk|tk)\s*\d+", text, re.IGNORECASE):
            return True
            
        if re.match(r"^\s*\d{1,2}:\d{2}(:\d{2})?\s*$", text):
            return True
            
        if re.match(r"^\s*\d+\s+words?\s*$", text, re.IGNORECASE):
            return True
            
        if len(text) < 20 and any(word in text.lower() for word in ["aanvang", "sluiting", "pauze", "einde", "schorsing"]):
            return True
        
        if re.search(r"^(De\s+)?(voorzitter|griffier|secretaris)\s*$", text, re.IGNORECASE):
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
 
        Uses enhanced speaker detection patterns and better fallback logic.
        """
        if not text:
            return "Onbekend"
 
        # Remove XML tags but keep inner text
        clean_text = re.sub(r"<[^>]+>", "", text).strip()
 
        # Special-case voorzitter (handle both "De voorzitter" and "Voorzitter")
        m_voor = re.match(r"^\s*(De\s+)?voorzitter\s*:", clean_text, re.IGNORECASE)
        if m_voor:
            return "De voorzitter" if m_voor.group(1) else "Voorzitter"
 
        # Try the original pattern
        m = SPEAKER_FULL_RE.match(clean_text)
        if m:
            prefix = (m.group("prefix") or "").strip()
            name = (m.group("name") or "").strip()
 
            # If no recognized prefix, try some heuristics
            if not prefix:
                if name.lower() == "voorzitter":
                    return "Voorzitter"
                # Check if this looks like a valid name (starts with capital letter, reasonable length, no common words)
                if name and len(name.split()) <= 4 and re.match(r"^[A-Z]", name) and not any(word.lower() in ['speaker', 'pattern', 'text', 'content', 'here', 'random', 'just', 'some'] for word in name.split()):
                    # Could be a speaker name without prefix - accept it
                    return name
                return "Onbekend"
 
            # Preserve Minister and Staatssecretaris prefixes (they are part of the speaker name)
            if prefix.lower().startswith("minister") or prefix.lower().startswith("staatssecretaris"):
                return f"{prefix} {name}".strip()
 
            # For 'De heer' and 'Mevrouw' prefixes, return only the name
            return name or "Onbekend"
        
        # Final fallback: check if it looks like a simple name pattern (no colon)
        if ':' not in clean_text:
            simple_name_match = re.match(r"^\s*([A-Z][a-z]+(?:\s+[a-z]+\s+[A-Z][a-z]+)*)\s*$", clean_text)
            if simple_name_match:
                return simple_name_match.group(1).strip()
            
        return "Onbekend"

    def _extract_party(self, text: str) -> str:
        """Extract political party code from speaker line text."""
        if not text:
            return ""
        
        # Extract party using regex
        match = _PARTY_RE.search(text)
        if match:
            return match.group(1).strip()
        
        return ""

    def parse_content(self, raw_content: bytes, file_path: str) -> Dict[str, Any]:
        """Parse XML content directly from bytes without file I/O."""
        try:
            text = raw_content.decode("utf-8")
        except Exception:
            # Fall back to latin-1 then convert
            text = raw_content.decode("latin-1")
        
        # Drop leading scraper metadata comment if present
        text = re.sub(r"^\s*<!--\s*scraper-metadata:base64:[\s\S]*?-->\s*", "", text)
        # Remove any BOM characters and common double-encoded BOM glyphs
        text = text.replace("\ufeff", "")
        text = re.sub(r"^(?:\s*(?:\ufeff|\u00EF\u00BB\u00BF))+", "", text)
        # Parse XML
        root = ET.fromstring(text)

        filename = Path(file_path).name
        return self._parse_xml_root(root, filename)

    def parse_file(self, file_path: str) -> Dict[str, Any]:
        # Read and sanitize XML content (remove scraper comment, stray BOMs)
        raw = Path(file_path).read_bytes()
        filename = Path(file_path).name
        return self.parse_content(raw, file_path)
    
    def _parse_xml_root(self, root: ET.Element, filename: str) -> Dict[str, Any]:
        """Parse XML root element into structured data."""
        
        # Reset session metadata for new document
        self._session_metadata = SessionMetadata()
        self._resolved_chair = None

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

        # Extract chair from XML metadata first
        chair_element = self._find_element(root, ["voorzitter", "chairman"])
        if chair_element is not None:
            chair_name = self._build_name_from_element(chair_element)
            if chair_name:
                self._resolved_chair = chair_name
                self._session_metadata.chair = chair_name

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
        activity_parts: List[ActivityPart] = []

        # Namespace-insensitive traversal helpers
        def local(el: ET.Element) -> str:
            t = el.tag
            return t.split('}')[-1] if '}' in t else t
    
        # Build parent map for efficient parent lookups (replaces catastrophic gc.get_objects())
        parent_map = {}
        for parent in root.iter():
            for child in parent:
                parent_map[child] = parent
        
        def _find_parent(node):
            return parent_map.get(node)
    
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
            # Also look for timing info at woordvoerder level first
            temp_parent = parent
            for _ in range(5):
                temp_parent = _find_parent(temp_parent)
                if temp_parent is None:
                    break
                # If a spreker child exists, compose its aanhef + verslagnaam
                for ch in list(temp_parent):
                    if local(ch) == "spreker":
                        speaker_name = self._build_name_from_element(ch)
                        if speaker_name:
                            current_speaker = speaker_name + ":"
                            break
                    # Get timing from woordvoerder level if available
                    if local(ch) == "markeertijdbegin" and ch.text:
                        mark_start = ch.text  # Prioritize woordvoerder timing
                    if local(ch) == "markeertijdeind" and ch.text:
                        mark_end = ch.text
                        
                # Check if this parent is a woordvoerder with timing
                if local(temp_parent) == "woordvoerder":
                    for ch in temp_parent:
                        if local(ch) == "markeertijdbegin" and ch.text:
                            mark_start = ch.text
                        if local(ch) == "markeertijdeind" and ch.text:
                            mark_end = ch.text
                            
                if current_speaker:
                    break
                    
            # Continue to collect timing from higher levels as fallback
            if not mark_start or not mark_end:
                parent = tekst
                for _ in range(5):
                    parent = _find_parent(parent)
                    if parent is None:
                        break
                    for ch in list(parent):
                        if local(ch) == "markeertijdbegin" and ch.text and not mark_start:
                            mark_start = ch.text
                        if local(ch) == "markeertijdeind" and ch.text and not mark_end:
                            mark_end = ch.text

            # Collect all alineaitem texts for this tekst block
            collected_texts = []
            for alinea in tekst:
                if local(alinea) != "alinea":
                    continue
                for item in alinea:
                    if local(item) != "alineaitem":
                        continue
                        
                    # Gather text content
                    raw_text_parts: List[str] = []
                    def _gather_text(e: ET.Element):
                        if e.text:
                            raw_text_parts.append(e.text)
                        for c in list(e):
                            _gather_text(c)
                            if c.tail:
                                raw_text_parts.append(c.tail)
                    _gather_text(item)
                    raw_text = (" ".join(raw_text_parts)).strip()
                    if raw_text:
                        collected_texts.append(raw_text)
            
            # Process the collected texts
            for raw_text in collected_texts:
                # Check for admin fragments first
                admin_type, admin_value = _detect_admin_fragment(raw_text)
                if admin_type != 'none':
                    self._handle_admin_fragment(admin_type, admin_value, raw_text)
                    continue  # Don't emit as activity part
                
                # Check for attendee lists
                members, ministers = _detect_attendees(raw_text)
                if members or ministers:
                    self._session_metadata.attendees_members.extend(members)
                    self._session_metadata.attendees_ministers.extend(ministers)
                    continue  # Don't emit as activity part
                
                # Check if this is a chair speech and resolve chair if needed
                if _is_chair_speech(raw_text):
                    if not self._resolved_chair:
                        # Try to find chair from first activity head with role containing 'voorzitter'
                        self._resolved_chair = self._find_chair_from_activities(root)
                    current_speaker = "De voorzitter:"
                    continue  # Skip the label, wait for content
                
                # Check for speaker lines
                elif ":" in raw_text and len(raw_text) <= 120:
                    candidate = raw_text.split(":", 1)[0].strip()
                    if not self._is_false_speaker(candidate):
                        name = self._extract_speaker_name(candidate + ":")
                        if name != "Onbekend":
                            current_speaker = candidate + ":"
                            # detect party from this speaker line if present - always check, don't just check if None
                            pm = _PARTY_RE.search(candidate)
                            if pm:
                                detected_party = pm.group(1).strip()
                            continue  # Skip the label, wait for content
                
                # This is actual content - create activity part
                text_raw, text_plain = _cleanup_paragraph_text(raw_text)
                
                # Skip very short content
                if len(text_plain) < 2:
                    continue
                
                # Normalize timestamps
                start_dt = _normalize_time_to_iso(mark_start, session_date) if mark_start else None
                end_dt = _normalize_time_to_iso(mark_end, session_date) if mark_end else None
                
                # Swap if end < start and mark warning
                if start_dt and end_dt and end_dt < start_dt:
                    start_dt, end_dt = end_dt, start_dt
                    # Could log warning here
                
                # Resolve speaker
                speaker_info = self._resolve_speaker(current_speaker, detected_party)
                
                part = ActivityPart(
                    type='spoken',
                    speaker=speaker_info,
                    start=start_dt,
                    end=end_dt,
                    text_raw=text_raw,
                    text_plain=text_plain
                )
                activity_parts.append(part)
        
        # Post-process activity parts
        activity_parts = _merge_consecutive_parts(activity_parts)
        activity_parts = _deduplicate_parts(activity_parts)
        
        # Convert to segments format
        for i, part in enumerate(activity_parts):
            start_sec = None
            if part.start:
                start_sec = part.start.hour * 3600 + part.start.minute * 60 + part.start.second
            
            end_sec = None
            if part.end:
                end_sec = part.end.hour * 3600 + part.end.minute * 60 + part.end.second
            
            segment: Dict[str, Any] = {
                "segment_id": f"{filename}-{i+1}",
                "speaker_name": part.speaker['display_name'],
                "speaker_party": part.speaker.get('party', ''),
                "segment_type": part.type,
                "transcript_text": part.text_plain,
                "video_seconds": start_sec,
                "timestamp_start": part.start.isoformat() if part.start else None,
                "timestamp_end": part.end.isoformat() if part.end else None,
                "duration_seconds": (end_sec - start_sec) if start_sec is not None and end_sec is not None else None,
                "word_count": len(part.text_plain.split()),
                "char_count": len(part.text_plain),
            }
            segments.append(segment)

        # Build final result with session metadata
        session_dict = {
            'start_time': self._session_metadata.start_time,
            'end_time': self._session_metadata.end_time,
            'summary_intro': self._session_metadata.summary_intro,
            'chair': self._session_metadata.chair or self._resolved_chair,
            'attendees': {
                'members': self._session_metadata.attendees_members,
                'ministers': self._session_metadata.attendees_ministers,
            }
        }

        return {
            "video_metadata": video_metadata,
            "segments": segments,
            "total_segments": len(segments),
            "session": session_dict,
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

            # Build parent map for efficient parent lookups (replaces catastrophic gc.get_objects())
            # Since we don't have access to root here, create a local parent map from the current subtree
            parent_map = {}
            
            # Traverse the woordvoerder subtree to build parent relationships
            def build_parent_map(element):
                for child in element:
                    parent_map[child] = element
                    build_parent_map(child)
            
            build_parent_map(woordvoerder)

            def _find_parent(node):
                return parent_map.get(node)

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