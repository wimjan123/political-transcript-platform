import os
from pathlib import Path

import pytest

# Adjust import to match actual parser location
from backend.src.parsers.html_parser import TranscriptHTMLParser


def test_transcript_html_parser_parses_basic_segment(tmp_path: Path):
    # Minimal HTML structure matching the parser's expected classes/selectors
    sample_html = (
        """
        <html><body>
            <div class="mb-4 border-b mx-6 my-4" id="segment-1">
                <a class="transcript-play-video" data-seconds="10"></a>
                <div>
                    <h2 class="text-md inline">Speaker A</h2>
                    <span class="text-xs text-gray-600 inline ml-2">00:00:10-00:00:12 (2 sec)</span>
                </div>
                <div class="flex-auto text-md text-gray-600 leading-loose">
                    This is a test transcript segment.
                </div>
            </div>
        </body></html>
        """
    )

    # Write to a temporary file to use parse_file API
    html_file = tmp_path / "test.html"
    html_file.write_text(sample_html, encoding="utf-8")

    parser = TranscriptHTMLParser()
    result = parser.parse_file(str(html_file))

    assert "segments" in result
    assert result["total_segments"] == 1
    segment = result["segments"][0]
    assert segment["speaker_name"] == "Speaker A"
    assert "test transcript segment" in segment["transcript_text"].lower()
    assert segment["video_seconds"] == 10

