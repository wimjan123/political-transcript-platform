#!/usr/bin/env python3
"""
Test to validate the party detection fix for video id 26936 speakers.

This test validates that the party detection improvements correctly handle
the problematic speakers mentioned in the issue: Jetten, Akerboom, and Van der Lee.
"""

import unittest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from src.parsers.vlos_parser import VLOSParser


class TestPartyDetectionFix(unittest.TestCase):
    """Test the party detection fix for specific problematic speakers."""

    def setUp(self):
        """Set up test fixtures."""
        self.parser = VLOSParser()

    def test_jetten_d66_detection(self):
        """Test that Jetten (D66) is correctly detected."""
        xml_content = '''<?xml version="1.0" encoding="UTF-8"?>
        <vlosCoreDocument xmlns="http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0">
            <vergadering>
                <activiteit>
                    <activiteithoofd>
                        <activiteitdeel>
                            <activiteititem>
                                <tekst>
                                    <alinea>
                                        <alineaitem>De heer Jetten (D66):</alineaitem>
                                        <alineaitem>Dit is een test speech van Jetten.</alineaitem>
                                    </alinea>
                                </tekst>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
            </vergadering>
        </vlosCoreDocument>'''

        result = self.parser.parse_content(xml_content.encode('utf-8'), 'test_jetten.xml')
        segments = result['segments']
        
        self.assertEqual(len(segments), 1)
        self.assertEqual(segments[0]['speaker_name'], 'Jetten')
        self.assertEqual(segments[0]['speaker_party'], 'D66')

    def test_akkerboom_christenunie_detection(self):
        """Test that Akerboom (ChristenUnie) is correctly detected."""
        xml_content = '''<?xml version="1.0" encoding="UTF-8"?>
        <vlosCoreDocument xmlns="http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0">
            <vergadering>
                <activiteit>
                    <activiteithoofd>
                        <activiteitdeel>
                            <activiteititem>
                                <tekst>
                                    <alinea>
                                        <alineaitem>De heer Akerboom (ChristenUnie):</alineaitem>
                                        <alineaitem>Dit is een test speech van Akerboom.</alineaitem>
                                    </alinea>
                                </tekst>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
            </vergadering>
        </vlosCoreDocument>'''

        result = self.parser.parse_content(xml_content.encode('utf-8'), 'test_akkerboom.xml')
        segments = result['segments']
        
        self.assertEqual(len(segments), 1)
        self.assertEqual(segments[0]['speaker_name'], 'Akerboom')
        self.assertEqual(segments[0]['speaker_party'], 'CHRISTENUNIE')

    def test_van_der_lee_groenlinks_detection(self):
        """Test that Van der Lee (GroenLinks) is correctly detected."""
        xml_content = '''<?xml version="1.0" encoding="UTF-8"?>
        <vlosCoreDocument xmlns="http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0">
            <vergadering>
                <activiteit>
                    <activiteithoofd>
                        <activiteitdeel>
                            <activiteititem>
                                <tekst>
                                    <alinea>
                                        <alineaitem>Mevrouw Van der Lee (GroenLinks):</alineaitem>
                                        <alineaitem>Dit is een test speech van Van der Lee.</alineaitem>
                                    </alinea>
                                </tekst>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
            </vergadering>
        </vlosCoreDocument>'''

        result = self.parser.parse_content(xml_content.encode('utf-8'), 'test_van_der_lee.xml')
        segments = result['segments']
        
        self.assertEqual(len(segments), 1)
        self.assertEqual(segments[0]['speaker_name'], 'Van der Lee')
        self.assertEqual(segments[0]['speaker_party'], 'GROENLINKS')

    def test_mixed_case_party_variations(self):
        """Test various mixed-case party variations."""
        test_cases = [
            ('(d66)', 'D66'),
            ('(D66)', 'D66'),
            ('(ChristenUnie)', 'CHRISTENUNIE'),
            ('(christenunie)', 'CHRISTENUNIE'),
            ('(GroenLinks)', 'GROENLINKS'),
            ('(groenlinks)', 'GROENLINKS'),
            ('(P.v.d.A.)', 'PVDA'),
            ('(p.v.d.a.)', 'PVDA'),
            ('(50Plus)', '50PLUS'),
            ('(50plus)', '50PLUS'),
        ]
        
        for input_party, expected in test_cases:
            with self.subTest(input=input_party, expected=expected):
                xml_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<vlosCoreDocument xmlns="http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0">
    <vergadering>
        <activiteit>
            <activiteithoofd>
                <activiteitdeel>
                    <activiteititem>
                        <tekst>
                            <alinea>
                                <alineaitem>Test Speaker {input_party}:</alineaitem>
                                <alineaitem>Test content.</alineaitem>
                            </alinea>
                        </tekst>
                    </activiteititem>
                </activiteitdeel>
            </activiteithoofd>
        </activiteit>
    </vergadering>
</vlosCoreDocument>'''

                result = self.parser.parse_content(xml_content.encode('utf-8'), 'test.xml')
                segments = result['segments']
                
                # Filter out very short segments
                segments = [s for s in segments if len(s['text']) > 5]
                self.assertEqual(len(segments), 1, f"Expected 1 segment, got {len(segments)}: {[s['text'] for s in segments]}")
                self.assertEqual(segments[0]['speaker_party'], expected)


if __name__ == '__main__':
    unittest.main()