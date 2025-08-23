# Changelog

## [Unreleased]

### Fixed
- **Party Detection in VLOS Parser**: Fixed issue where speaker party names were not being detected correctly for certain speakers in Tweede Kamer transcripts. The parser now properly handles mixed-case party names and common punctuation variations.

  **Problem**: Speakers like "Jetten (D66)", "Akerboom (ChristenUnie)", and "Van der Lee (GroenLinks)" were not having their party affiliations detected due to case-sensitivity issues in the regex pattern.

  **Solution**: Updated the `_PARTY_RE` regex pattern in [`vlos_parser.py`](backend/src/parsers/vlos_parser.py) to be case-insensitive and handle common punctuation variations (dots, hyphens, slashes). Also fixed a bug where party detection was bypassing the `_extract_party` method in one code path.

  **Impact**: All Dutch political party names are now correctly normalized to uppercase format regardless of original case or punctuation style.

## [Previous Releases]
...