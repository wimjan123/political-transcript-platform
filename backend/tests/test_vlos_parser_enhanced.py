import unittest
from datetime import datetime, date
import sys
import os
from unittest.mock import patch, MagicMock
from xml.etree import ElementTree as ET

# Add the src directory to the path so we can import the parser
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from parsers.vlos_parser import VLOSParser


class TestVLOSParserEnhanced(unittest.TestCase):
    """Enhanced tests for VLOS XML parser improvements."""

    def setUp(self):
        """Set up test fixtures with enhanced XML data."""
        self.parser = VLOSParser()
        
        # Enhanced XML with admin fragments, chair mapping, and attendees
        self.enhanced_xml = '''<?xml version="1.0" encoding="UTF-8"?>
        <vlosCoreDocument xmlns="http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0">
            <vergadering>
                <voorzitter>
                    <aanhef>Mevrouw</aanhef>
                    <verslagnaam>Aukje de Vries</verslagnaam>
                </voorzitter>
                <activiteit>
                    <activiteithoofd>
                        <markeertijdbegin>2018-11-08T14:00:16</markeertijdbegin>
                        <markeertijdeind>2018-11-08T14:05:30</markeertijdeind>
                        <activiteitdeel>
                            <activiteititem>
                                <tekst>
                                    <alinea>
                                        <alineaitem>Aanvang 14.00 uur.</alineaitem>
                                    </alinea>
                                </tekst>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
                <activiteit>
                    <activiteithoofd>
                        <markeertijdbegin>2018-11-08T14:00:16</markeertijdbegin>
                        <markeertijdeind>2018-11-08T14:05:30</markeertijdeind>
                        <activiteitdeel>
                            <activiteititem>
                                <tekst>
                                    <alinea>
                                        <alineaitem>Aanwezig zijn de heer Tony van Dijck, mevrouw Leijten, minister van Financiën Hoekstra.</alineaitem>
                                    </alinea>
                                </tekst>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
                <activiteit>
                    <activiteithoofd>
                        <markeertijdbegin>2018-11-08T14:00:16</markeertijdbegin>
                        <markeertijdeind>2018-11-08T14:05:30</markeertijdeind>
                        <activiteitdeel>
                            <activiteititem>
                                <woordvoerder>
                                    <spreker>
                                        <aanhef>Mevrouw</aanhef>
                                        <verslagnaam>Aukje de Vries</verslagnaam>
                                    </spreker>
                                    <tekst>
                                        <alinea>
                                            <alineaitem>De voorzitter:</alineaitem>
                                            <alineaitem>Goedemiddag allemaal.</alineaitem>
                                        </alinea>
                                    </tekst>
                                </woordvoerder>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
                <activiteit>
                    <activiteithoofd>
                        <markeertijdbegin>2018-11-08T14:05:30</markeertijdbegin>
                        <markeertijdeind>2018-11-08T14:10:15</markeertijdeind>
                        <activiteitdeel>
                            <activiteititem>
                                <woordvoerder>
                                    <spreker>
                                        <aanhef>De heer</aanhef>
                                        <verslagnaam>Tony van Dijck</verslagnaam>
                                    </spreker>
                                    <tekst>
                                        <alinea>
                                            <alineaitem>De heer Tony van Dijck (PVV):</alineaitem>
                                            <alineaitem>Dank u wel, voorzitter.</alineaitem>
                                        </alinea>
                                    </tekst>
                                </woordvoerder>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
                <activiteit>
                    <activiteithoofd>
                        <activiteitdeel>
                            <activiteititem>
                                <tekst>
                                    <alinea>
                                        <alineaitem>Sluiting 18.43 uur.</alineaitem>
                                    </alinea>
                                </tekst>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
            </vergadering>
        </vlosCoreDocument>'''
        
        # XML with Verslag intro
        self.verslag_xml = '''<?xml version="1.0" encoding="UTF-8"?>
        <vlosCoreDocument xmlns="http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0">
            <vergadering>
                <activiteit>
                    <activiteithoofd>
                        <activiteitdeel>
                            <activiteititem>
                                <tekst>
                                    <alinea>
                                        <alineaitem>Verslag van een commissiedebat over belastingzaken.</alineaitem>
                                    </alinea>
                                </tekst>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
            </vergadering>
        </vlosCoreDocument>'''
        
        # XML with duplicate content
        self.duplicate_xml = '''<?xml version="1.0" encoding="UTF-8"?>
        <vlosCoreDocument xmlns="http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0">
            <vergadering>
                <activiteit>
                    <activiteithoofd>
                        <markeertijdbegin>2018-11-08T14:00:16</markeertijdbegin>
                        <markeertijdeind>2018-11-08T14:05:30</markeertijdeind>
                        <activiteitdeel>
                            <activiteititem>
                                <woordvoerder>
                                    <spreker>
                                        <aanhef>De heer</aanhef>
                                        <verslagnaam>Test Speaker</verslagnaam>
                                    </spreker>
                                    <tekst>
                                        <alinea>
                                            <alineaitem>De heer Test Speaker:</alineaitem>
                                            <alineaitem>This is test content.</alineaitem>
                                        </alinea>
                                    </tekst>
                                </woordvoerder>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
                <activiteit>
                    <activiteithoofd>
                        <markeertijdbegin>2018-11-08T14:00:16</markeertijdbegin>
                        <markeertijdeind>2018-11-08T14:05:30</markeertijdeind>
                        <activiteitdeel>
                            <activiteititem>
                                <woordvoerder>
                                    <spreker>
                                        <aanhef>De heer</aanhef>
                                        <verslagnaam>Test Speaker</verslagnaam>
                                    </spreker>
                                    <tekst>
                                        <alinea>
                                            <alineaitem>De heer Test Speaker:</alineaitem>
                                            <alineaitem>This is test content.</alineaitem>
                                        </alinea>
                                    </tekst>
                                </woordvoerder>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
            </vergadering>
        </vlosCoreDocument>'''

    def test_no_sessie_administratie_speakers(self):
        """Assert no parts with speaker.display_name == "Sessie-administratie"."""
        result = self.parser.parse_content(self.enhanced_xml.encode('utf-8'), 'test.xml')
        
        for segment in result['segments']:
            self.assertNotEqual(segment['speaker_name'], "Sessie-administratie",
                              f"Found 'Sessie-administratie' speaker in segment: {segment}")

    def test_admin_fragments_moved_to_session(self):
        """Assert admin phrases are moved to session.start_time, session.end_time, or session.summary_intro."""
        result = self.parser.parse_content(self.enhanced_xml.encode('utf-8'), 'test.xml')
        
        # Check that admin fragments are in session metadata
        self.assertEqual(result['session']['start_time'], '14.00')
        self.assertEqual(result['session']['end_time'], '18.43')
        
        # Check that admin fragments are NOT in segments
        admin_texts = ['Aanvang 14.00 uur.', 'Sluiting 18.43 uur.']
        for segment in result['segments']:
            for admin_text in admin_texts:
                self.assertNotIn(admin_text, segment['transcript_text'],
                                f"Admin fragment '{admin_text}' found in segment: {segment}")

    def test_verslag_summary_intro(self):
        """Test that Verslag intro is moved to session.summary_intro."""
        result = self.parser.parse_content(self.verslag_xml.encode('utf-8'), 'test.xml')
        
        self.assertIsNotNone(result['session']['summary_intro'])
        self.assertIn('Verslag van een commissiedebat', result['session']['summary_intro'])
        
        # Should not appear in segments
        for segment in result['segments']:
            self.assertNotIn('Verslag van een', segment['transcript_text'])

    def test_attendees_moved_to_session(self):
        """Assert attendee list is in session.attendees.members and not in activities."""
        result = self.parser.parse_content(self.enhanced_xml.encode('utf-8'), 'test.xml')
        
        # Check attendees are extracted
        attendees = result['session']['attendees']
        self.assertIn('Tony van Dijck', attendees['members'])
        self.assertIn('Leijten', attendees['members'])
        self.assertIn('Financiën Hoekstra', attendees['ministers'])
        
        # Check attendee list is NOT in segments
        for segment in result['segments']:
            self.assertNotIn('Aanwezig zijn', segment['transcript_text'],
                            f"Attendee list found in segment: {segment}")

    def test_chair_attribution(self):
        """Assert the opening speech at 14:00:16 is attributed to Aukje de Vries and begins with "Goedemiddag allemaal." """
        result = self.parser.parse_content(self.enhanced_xml.encode('utf-8'), 'test.xml')
        
        # Find the opening speech segment
        opening_segments = [s for s in result['segments'] 
                          if s['timestamp_start'] and '14:00:16' in s['timestamp_start']]
        
        self.assertGreater(len(opening_segments), 0, "No segments found at 14:00:16")
        
        # Check the chair speech
        chair_segments = [s for s in opening_segments if 'Goedemiddag allemaal' in s['transcript_text']]
        self.assertGreater(len(chair_segments), 0, "Chair speech not found")
        
        chair_segment = chair_segments[0]
        # Should be attributed to resolved chair (Aukje de Vries)
        self.assertEqual(chair_segment['speaker_name'], 'Aukje de Vries')
        self.assertIn('Goedemiddag allemaal', chair_segment['transcript_text'])

    def test_no_duplicate_parts(self):
        """Assert no duplicate parts with same time range and text."""
        result = self.parser.parse_content(self.duplicate_xml.encode('utf-8'), 'test.xml')
        
        # Should only have one instance of the duplicate content
        test_content_segments = [s for s in result['segments'] 
                               if 'This is test content' in s['transcript_text']]
        
        self.assertEqual(len(test_content_segments), 1, 
                        f"Expected 1 segment with test content, found {len(test_content_segments)}")

    def test_chair_label_stripped(self):
        """Test that 'De voorzitter:' label is stripped from text_plain."""
        result = self.parser.parse_content(self.enhanced_xml.encode('utf-8'), 'test.xml')
        
        chair_segments = [s for s in result['segments'] if 'Goedemiddag allemaal' in s['transcript_text']]
        self.assertGreater(len(chair_segments), 0, "Chair segment not found")
        
        chair_segment = chair_segments[0]
        # The label should be stripped from the text
        self.assertEqual(chair_segment['transcript_text'].strip(), 'Goedemiddag allemaal.')
        self.assertNotIn('De voorzitter:', chair_segment['transcript_text'])

    def test_member_label_stripped(self):
        """Test that member labels like 'De heer Tony van Dijck (PVV):' are stripped."""
        result = self.parser.parse_content(self.enhanced_xml.encode('utf-8'), 'test.xml')
        
        member_segments = [s for s in result['segments'] if 'Dank u wel, voorzitter' in s['transcript_text']]
        self.assertGreater(len(member_segments), 0, "Member segment not found")
        
        member_segment = member_segments[0]
        # The label should be stripped from the text
        self.assertEqual(member_segment['transcript_text'].strip(), 'Dank u wel, voorzitter.')
        self.assertNotIn('De heer Tony van Dijck', member_segment['transcript_text'])

    def test_time_normalization(self):
        """Test that timestamps are properly normalized to ISO format."""
        result = self.parser.parse_content(self.enhanced_xml.encode('utf-8'), 'test.xml')
        
        # Check that all segments with timestamps have proper ISO format
        for segment in result['segments']:
            if segment['timestamp_start']:
                # Should be ISO format like '2018-11-08T14:00:16'
                self.assertRegex(segment['timestamp_start'], r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}')
            if segment['timestamp_end']:
                self.assertRegex(segment['timestamp_end'], r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}')

    def test_session_metadata_structure(self):
        """Test that session metadata has proper structure."""
        result = self.parser.parse_content(self.enhanced_xml.encode('utf-8'), 'test.xml')
        
        session = result['session']
        
        # Check structure
        self.assertIn('start_time', session)
        self.assertIn('end_time', session)
        self.assertIn('summary_intro', session)
        self.assertIn('chair', session)
        self.assertIn('attendees', session)
        
        # Check attendees structure
        self.assertIn('members', session['attendees'])
        self.assertIn('ministers', session['attendees'])
        self.assertIsInstance(session['attendees']['members'], list)
        self.assertIsInstance(session['attendees']['ministers'], list)

    def test_speaker_identity_keys(self):
        """Test that speaker identity keys are properly generated."""
        result = self.parser.parse_content(self.enhanced_xml.encode('utf-8'), 'test.xml')
        
        # Find segments with different speakers
        speakers_found = set()
        for segment in result['segments']:
            speakers_found.add(segment['speaker_name'])
        
        # Should have at least Aukje de Vries and Tony van Dijck
        self.assertIn('Aukje de Vries', speakers_found)
        self.assertIn('Tony van Dijck', speakers_found)

    def test_short_content_filtered_out(self):
        """Test that content with length < 2 characters is filtered out."""
        # Create XML with very short content
        short_xml = '''<?xml version="1.0" encoding="UTF-8"?>
        <vlosCoreDocument xmlns="http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0">
            <vergadering>
                <activiteit>
                    <activiteithoofd>
                        <activiteitdeel>
                            <activiteititem>
                                <woordvoerder>
                                    <spreker>
                                        <aanhef>De heer</aanhef>
                                        <verslagnaam>Test</verslagnaam>
                                    </spreker>
                                    <tekst>
                                        <alinea>
                                            <alineaitem>A</alineaitem>
                                        </alinea>
                                    </tekst>
                                </woordvoerder>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
            </vergadering>
        </vlosCoreDocument>'''
        
        result = self.parser.parse_content(short_xml.encode('utf-8'), 'test.xml')
        
        # Should have no segments due to short content
        self.assertEqual(len(result['segments']), 0)

    def test_voorzitter_period_kept_in_text(self):
        """Test that 'Voorzitter.' with period is kept as part of speech text."""
        # XML with "Voorzitter." as part of speech (not a label)
        period_xml = '''<?xml version="1.0" encoding="UTF-8"?>
        <vlosCoreDocument xmlns="http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0">
            <vergadering>
                <activiteit>
                    <activiteithoofd>
                        <activiteitdeel>
                            <activiteititem>
                                <woordvoerder>
                                    <spreker>
                                        <aanhef>De heer</aanhef>
                                        <verslagnaam>Test Speaker</verslagnaam>
                                    </spreker>
                                    <tekst>
                                        <alinea>
                                            <alineaitem>Dank u wel, Voorzitter. Dit is de inhoud.</alineaitem>
                                        </alinea>
                                    </tekst>
                                </woordvoerder>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
            </vergadering>
        </vlosCoreDocument>'''
        
        result = self.parser.parse_content(period_xml.encode('utf-8'), 'test.xml')
        
        # Should keep "Voorzitter." as part of the text
        self.assertGreater(len(result['segments']), 0)
        segment = result['segments'][0]
        self.assertIn('Voorzitter.', segment['transcript_text'])
        self.assertIn('Dit is de inhoud', segment['transcript_text'])

    def test_merging_consecutive_parts(self):
        """Test that consecutive parts with same speaker are merged."""
        # XML with consecutive parts from same speaker
        consecutive_xml = '''<?xml version="1.0" encoding="UTF-8"?>
        <vlosCoreDocument xmlns="http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0">
            <vergadering>
                <activiteit>
                    <activiteithoofd>
                        <markeertijdbegin>2018-11-08T14:00:16</markeertijdbegin>
                        <markeertijdeind>2018-11-08T14:00:18</markeertijdeind>
                        <activiteitdeel>
                            <activiteititem>
                                <woordvoerder>
                                    <spreker>
                                        <aanhef>De heer</aanhef>
                                        <verslagnaam>Test Speaker</verslagnaam>
                                    </spreker>
                                    <tekst>
                                        <alinea>
                                            <alineaitem>First part.</alineaitem>
                                        </alinea>
                                    </tekst>
                                </woordvoerder>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
                <activiteit>
                    <activiteithoofd>
                        <markeertijdbegin>2018-11-08T14:00:18</markeertijdbegin>
                        <markeertijdeind>2018-11-08T14:00:20</markeertijdeind>
                        <activiteitdeel>
                            <activiteititem>
                                <woordvoerder>
                                    <spreker>
                                        <aanhef>De heer</aanhef>
                                        <verslagnaam>Test Speaker</verslagnaam>
                                    </spreker>
                                    <tekst>
                                        <alinea>
                                            <alineaitem>Second part.</alineaitem>
                                        </alinea>
                                    </tekst>
                                </woordvoerder>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
            </vergadering>
        </vlosCoreDocument>'''
        
        result = self.parser.parse_content(consecutive_xml.encode('utf-8'), 'test.xml')
        
        # Should merge into one segment
        self.assertEqual(len(result['segments']), 1)
        segment = result['segments'][0]
        self.assertIn('First part', segment['transcript_text'])
        self.assertIn('Second part', segment['transcript_text'])

    def test_party_extraction(self):
        """Test that party codes are properly extracted."""
        result = self.parser.parse_content(self.enhanced_xml.encode('utf-8'), 'test.xml')
        
        # Find Tony van Dijck segment
        pvv_segments = [s for s in result['segments'] if 'Tony van Dijck' in s['speaker_name']]
        if pvv_segments:
            self.assertEqual(pvv_segments[0]['speaker_party'], 'PVV')

    def tearDown(self):
        """Clean up after tests."""
        self.parser = None


if __name__ == '__main__':
    unittest.main()