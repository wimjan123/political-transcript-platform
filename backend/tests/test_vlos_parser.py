import unittest
from datetime import datetime
import sys
import os
from unittest.mock import patch, MagicMock
from xml.etree import ElementTree as ET

# Add the src directory to the path so we can import the parser
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from parsers.vlos_parser import VLOSParser


class TestVLOSParser(unittest.TestCase):
    """Comprehensive unit tests for VLOS XML parser improvements."""

    def setUp(self):
        """Set up test fixtures with sample XML data."""
        self.parser = VLOSParser()
        
        # Sample XML with Dutch parliamentary structure
        self.sample_xml = '''<?xml version="1.0" encoding="UTF-8"?>
        <vlosCoreDocument xmlns="http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0">
            <vergadering>
                <activiteit>
                    <activiteithoofd>
                        <markeertijdbegin>2018-11-08T14:01:51</markeertijdbegin>
                        <markeertijdeind>2018-11-08T14:01:55</markeertijdeind>
                        <activiteitdeel>
                            <activiteititem>
                                <woordvoerder>
                                    <spreker>
                                        <aanhef>De heer</aanhef>
                                        <verslagnaam>Tony van Dijck</verslagnaam>
                                    </spreker>
                                    <markeertijdbegin>2018-11-08T14:02:21</markeertijdbegin>
                                    <markeertijdeind>2018-11-08T14:07:15</markeertijdeind>
                                    <tekst>
                                        <alinea>
                                            <alineaitem>De heer <nadruk type="Vet">Tony van Dijck</nadruk> (PVV):</alineaitem>
                                            <alineaitem>Test speech content here.</alineaitem>
                                        </alinea>
                                    </tekst>
                                </woordvoerder>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
            </vergadering>
        </vlosCoreDocument>'''
        
        # Sample XML with Minister speaker
        self.minister_xml = '''<?xml version="1.0" encoding="UTF-8"?>
        <vlosCoreDocument xmlns="http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0">
            <vergadering>
                <activiteit>
                    <activiteithoofd>
                        <activiteitdeel>
                            <activiteititem>
                                <woordvoerder>
                                    <spreker>
                                        <aanhef>Minister</aanhef>
                                        <verslagnaam>Hoekstra</verslagnaam>
                                    </spreker>
                                    <markeertijdbegin>2018-11-08T15:11:34</markeertijdbegin>
                                    <markeertijdeind>2018-11-08T15:15:43</markeertijdeind>
                                    <tekst>
                                        <alinea>
                                            <alineaitem>Minister <nadruk type="Vet">Hoekstra</nadruk>:</alineaitem>
                                            <alineaitem>Minister speech content.</alineaitem>
                                        </alinea>
                                    </tekst>
                                </woordvoerder>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
            </vergadering>
        </vlosCoreDocument>'''
        
        # Sample XML with Mevrouw speaker
        self.mevrouw_xml = '''<?xml version="1.0" encoding="UTF-8"?>
        <vlosCoreDocument xmlns="http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0">
            <vergadering>
                <activiteit>
                    <activiteithoofd>
                        <activiteitdeel>
                            <activiteititem>
                                <woordvoerder>
                                    <spreker>
                                        <aanhef>Mevrouw</aanhef>
                                        <verslagnaam>Leijten</verslagnaam>
                                    </spreker>
                                    <markeertijdbegin>2018-11-08T14:51:28</markeertijdbegin>
                                    <markeertijdeind>2018-11-08T14:58:03</markeertijdeind>
                                    <tekst>
                                        <alinea>
                                            <alineaitem>Mevrouw <nadruk type="Vet">Leijten</nadruk> (SP):</alineaitem>
                                            <alineaitem>Mevrouw speech content.</alineaitem>
                                        </alinea>
                                    </tekst>
                                </woordvoerder>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
            </vergadering>
        </vlosCoreDocument>'''

    def test_parse_datetime_to_seconds_valid_iso_format(self):
        """Test parsing valid ISO datetime format to seconds."""
        test_cases = [
            ("2018-11-08T14:01:51", 14*3600 + 1*60 + 51),  # 2:01:51 PM = 50,511 seconds
            ("2018-11-08T00:00:00", 0),  # Midnight = 0 seconds
            ("2018-11-08T23:59:59", 23*3600 + 59*60 + 59),  # 11:59:59 PM
            ("2018-11-08T09:30:45", 9*3600 + 30*60 + 45),  # 9:30:45 AM
        ]
        
        for iso_datetime, expected_seconds in test_cases:
            with self.subTest(iso_datetime=iso_datetime):
                result = self.parser._parse_datetime_to_seconds(iso_datetime)
                self.assertEqual(result, expected_seconds)

    def test_parse_datetime_to_seconds_invalid_format(self):
        """Test parsing invalid datetime formats returns None (unknown timing)."""
        invalid_formats = [
            "invalid-datetime",
            "2018-11-08",  # No time part
            "14:01:51",  # No date part
            "",  # Empty string
            None,  # None value
            "2018-13-08T14:01:51",  # Invalid month
            "2018-11-32T14:01:51",  # Invalid day
            "2018-11-08T25:01:51",  # Invalid hour
        ]
        
        for invalid_format in invalid_formats:
            with self.subTest(invalid_format=invalid_format):
                result = self.parser._parse_datetime_to_seconds(invalid_format)
                self.assertIsNone(result)

    def test_extract_speaker_name_de_heer_pattern(self):
        """Test extracting speaker names with 'De heer' pattern."""
        test_cases = [
            ("De heer Tony van Dijck (PVV):", "Tony van Dijck"),
            ("De heer Van der Linde (VVD):", "Van der Linde"), 
            ("De heer Nijboer (PvdA):", "Nijboer"),
            ("De heer Anne Mulder:", "Anne Mulder"),
            ("De heer Ronnes (CDA):", "Ronnes"),
        ]
        
        for text, expected_name in test_cases:
            with self.subTest(text=text):
                result = self.parser._extract_speaker_name(text)
                self.assertEqual(result, expected_name)

    def test_extract_speaker_name_mevrouw_pattern(self):
        """Test extracting speaker names with 'Mevrouw' pattern."""
        test_cases = [
            ("Mevrouw Leijten (SP):", "Leijten"),
            ("Mevrouw Van der Berg:", "Van der Berg"),
            ("Mevrouw De Wit (D66):", "De Wit"),
        ]
        
        for text, expected_name in test_cases:
            with self.subTest(text=text):
                result = self.parser._extract_speaker_name(text)
                self.assertEqual(result, expected_name)

    def test_extract_speaker_name_minister_pattern(self):
        """Test extracting speaker names with 'Minister' pattern."""
        test_cases = [
            ("Minister Hoekstra:", "Minister Hoekstra"),
            ("Minister Van der Berg:", "Minister Van der Berg"),
            ("Minister Ollongren:", "Minister Ollongren"),
        ]
        
        for text, expected_name in test_cases:
            with self.subTest(text=text):
                result = self.parser._extract_speaker_name(text)
                self.assertEqual(result, expected_name)

    def test_extract_speaker_name_staatssecretaris_pattern(self):
        """Test extracting speaker names with 'Staatssecretaris' pattern."""
        test_cases = [
            ("Staatssecretaris Van Huffelen:", "Staatssecretaris Van Huffelen"),
            ("Staatssecretaris De Jonge:", "Staatssecretaris De Jonge"),
        ]
        
        for text, expected_name in test_cases:
            with self.subTest(text=text):
                result = self.parser._extract_speaker_name(text)
                self.assertEqual(result, expected_name)

    def test_extract_speaker_name_voorzitter_pattern(self):
        """Test extracting speaker names with 'voorzitter' pattern."""
        test_cases = [
            ("De voorzitter:", "De voorzitter"),
            ("Voorzitter:", "Voorzitter"),
        ]
        
        for text, expected_name in test_cases:
            with self.subTest(text=text):
                result = self.parser._extract_speaker_name(text)
                self.assertEqual(result, expected_name)

    def test_extract_speaker_name_no_match(self):
        """Test extracting speaker names when no pattern matches."""
        test_cases = [
            "Random text without pattern",
            "",
            "Just some speech content",
            "No speaker pattern here:",
        ]
        
        for text in test_cases:
            with self.subTest(text=text):
                result = self.parser._extract_speaker_name(text)
                self.assertEqual(result, "Onbekend")

    def test_extract_party_simple_cases(self):
        """Test extracting political party codes from speaker text."""
        test_cases = [
            ("De heer Tony van Dijck (PVV):", "PVV"),
            ("Mevrouw Leijten (SP):", "SP"),
            ("De heer Van der Linde (VVD):", "VVD"),
            ("De heer Nijboer (PvdA):", "PVDA"),  # Should normalize to uppercase
            ("Mevrouw De Wit (D66):", "D66"),
            ("De heer Test (CDA):", "CDA"),
            ("Mevrouw Test (GL):", "GL"),
            ("De heer Test (50PLUS):", "50PLUS"),
        ]
        
        for text, expected_party in test_cases:
            with self.subTest(text=text):
                result = self.parser._extract_party(text)
                self.assertEqual(result, expected_party)

    def test_extract_party_dotted_abbreviations(self):
        """Test extracting party codes with dots (e.g., P.v.d.A.)."""
        test_cases = [
            ("De heer Test (P.v.d.A.):", "PVDA"),  # Remove dots and normalize
            ("Mevrouw Test (S.P.):", "SP"),       # Remove dots
            ("De heer Test (V.V.D.):", "VVD"),    # Remove dots
            ("De heer Test (C.D.A.):", "CDA"),    # Remove dots
        ]
        
        for text, expected_party in test_cases:
            with self.subTest(text=text):
                result = self.parser._extract_party(text)
                self.assertEqual(result, expected_party)

    def test_extract_party_mixed_case(self):
        """Test extracting party codes with mixed case."""
        test_cases = [
            ("De heer Test (GroenLinks):", "GROENLINKS"),  # Full name, mixed case
            ("Mevrouw Test (Pvda):", "PVDA"),              # Mixed case
            ("De heer Test (vvd):", "VVD"),                # Lowercase
            ("De heer Test (Sp):", "SP"),                  # Mixed case
        ]
        
        for text, expected_party in test_cases:
            with self.subTest(text=text):
                result = self.parser._extract_party(text)
                self.assertEqual(result, expected_party)

    def test_extract_party_with_hyphens_slashes(self):
        """Test extracting party codes with hyphens and slashes."""
        test_cases = [
            ("De heer Test (PVV/JA21):", "PVV/JA21"),      # Slash separator
            ("Mevrouw Test (50-PLUS):", "50-PLUS"),        # Hyphen in name
            ("De heer Test (CDA-VVD):", "CDA-VVD"),        # Coalition
            ("De heer Test (GL/PvdA):", "GL/PVDA"),        # Mixed formats
        ]
        
        for text, expected_party in test_cases:
            with self.subTest(text=text):
                result = self.parser._extract_party(text)
                self.assertEqual(result, expected_party)

    def test_extract_party_no_match(self):
        """Test party extraction when no party code is found."""
        test_cases = [
            "De heer Test:",                    # No parentheses
            "Minister Hoekstra:",               # No party for ministers
            "De voorzitter:",                   # No party for chair
            "De heer Test (invalid format",    # Unclosed parentheses
            "De heer Test invalid) format:",   # Unmatched parentheses
            "",                                 # Empty string
            "Random text without party",       # No pattern match
        ]
        
        for text in test_cases:
            with self.subTest(text=text):
                result = self.parser._extract_party(text)
                self.assertEqual(result, "")

    def test_extract_party_edge_cases(self):
        """Test party extraction edge cases."""
        test_cases = [
            ("De heer Test ( PVV ):", "PVV"),              # Spaces inside parentheses
            ("De heer Test (PVV) extra text:", "PVV"),     # Extra text after party
            ("Multiple (VVD) and (PvdA) parties:", "VVD"), # Multiple - should get first
            ("De heer Test (P.v.d.A) no dot:", "PVDA"),   # Missing final dot
        ]
        
        for text, expected_party in test_cases:
            with self.subTest(text=text):
                result = self.parser._extract_party(text)
                self.assertEqual(result, expected_party)

    def test_extract_speaker_name_with_nadruk_formatting(self):
        """Test extracting speaker names with XML nadruk formatting."""
        test_cases = [
            ('De heer <nadruk type="Vet">Tony van Dijck</nadruk> (PVV):', "Tony van Dijck"),
            ('Minister <nadruk type="Vet">Hoekstra</nadruk>:', "Minister Hoekstra"),
            ('Mevrouw <nadruk type="Vet">Leijten</nadruk> (SP):', "Leijten"),
            ('De <nadruk type="Vet">voorzitter</nadruk>:', "De voorzitter"),
        ]
        
        for text, expected_name in test_cases:
            with self.subTest(text=text):
                result = self.parser._extract_speaker_name(text)
                self.assertEqual(result, expected_name)

    @patch('parsers.vlos_parser.VLOSParser._parse_datetime_to_seconds')
    @patch('parsers.vlos_parser.VLOSParser._extract_speaker_name')
    def test_parse_single_speech_with_timing(self, mock_extract_speaker, mock_parse_datetime):
        """Test parsing single speech segment with proper timing extraction."""
        # Setup mocks
        mock_parse_datetime.side_effect = [50511, 50515]  # start_time, end_time
        mock_extract_speaker.return_value = "Tony van Dijck"
        
        root = ET.fromstring(self.sample_xml)
        
        # Find a woordvoerder element
        woordvoerder = root.find('.//{http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0}woordvoerder')
        
        # Mock the database operations
        with patch.object(self.parser, 'cursor') as mock_cursor:
            mock_cursor.fetchone.return_value = None  # No existing speech
            
            result = self.parser._parse_speech_segment(woordvoerder)
            
            # Verify the parsing results
            self.assertIsNotNone(result)
            self.assertEqual(result['speaker'], "Tony van Dijck")
            self.assertEqual(result['start_time'], 50511)
            self.assertEqual(result['end_time'], 50515)
            self.assertIn("Test speech content here", result['content'])
            
            # Verify timing extraction was called with correct values
            mock_parse_datetime.assert_any_call("2018-11-08T14:02:21")
            mock_parse_datetime.assert_any_call("2018-11-08T14:07:15")

    def test_timing_extraction_hierarchy_traversal(self):
        """Test that timing information is extracted by traversing up the XML hierarchy."""
        xml_with_nested_timing = '''<?xml version="1.0" encoding="UTF-8"?>
        <vlosCoreDocument xmlns="http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0">
            <vergadering>
                <activiteit>
                    <activiteithoofd>
                        <markeertijdbegin>2018-11-08T14:00:00</markeertijdbegin>
                        <markeertijdeind>2018-11-08T14:10:00</markeertijdeind>
                        <activiteitdeel>
                            <markeertijdbegin>2018-11-08T14:01:00</markeertijdbegin>
                            <markeertijdeind>2018-11-08T14:05:00</markeertijdeind>
                            <activiteititem>
                                <markeertijdbegin>2018-11-08T14:02:00</markeertijdbegin>
                                <markeertijdeind>2018-11-08T14:04:00</markeertijdeind>
                                <woordvoerder>
                                    <spreker>
                                        <aanhef>De heer</aanhef>
                                        <verslagnaam>Test Speaker</verslagnaam>
                                    </spreker>
                                    <markeertijdbegin>2018-11-08T14:02:30</markeertijdbegin>
                                    <markeertijdeind>2018-11-08T14:03:30</markeertijdeind>
                                    <tekst>
                                        <alinea>
                                            <alineaitem>De heer Test Speaker:</alineaitem>
                                            <alineaitem>Speech content.</alineaitem>
                                        </alinea>
                                    </tekst>
                                </woordvoerder>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
            </vergadering>
        </vlosCoreDocument>'''
        
        root = ET.fromstring(xml_with_nested_timing)
        woordvoerder = root.find('.//{http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0}woordvoerder')
        
        with patch.object(self.parser, 'cursor') as mock_cursor:
            mock_cursor.fetchone.return_value = None
            
            result = self.parser._parse_speech_segment(woordvoerder)
            
            # Should use the most specific timing (from woordvoerder level)
            expected_start = 14*3600 + 2*60 + 30  # 14:02:30
            expected_end = 14*3600 + 3*60 + 30    # 14:03:30
            
            self.assertEqual(result['start_time'], expected_start)
            self.assertEqual(result['end_time'], expected_end)

    def test_timing_extraction_fallback_to_parent(self):
        """Test timing extraction falls back to parent elements when woordvoerder has no timing."""
        xml_no_timing = '''<?xml version="1.0" encoding="UTF-8"?>
        <vlosCoreDocument xmlns="http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0">
            <vergadering>
                <activiteit>
                    <activiteithoofd>
                        <activiteitdeel>
                            <activiteititem>
                                <markeertijdbegin>2018-11-08T14:05:00</markeertijdbegin>
                                <markeertijdeind>2018-11-08T14:08:00</markeertijdeind>
                                <woordvoerder>
                                    <spreker>
                                        <aanhef>De heer</aanhef>
                                        <verslagnaam>Test Speaker</verslagnaam>
                                    </spreker>
                                    <tekst>
                                        <alinea>
                                            <alineaitem>De heer Test Speaker:</alineaitem>
                                            <alineaitem>Speech content.</alineaitem>
                                        </alinea>
                                    </tekst>
                                </woordvoerder>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
            </vergadering>
        </vlosCoreDocument>'''
        
        root = ET.fromstring(xml_no_timing)
        woordvoerder = root.find('.//{http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0}woordvoerder')
        
        with patch.object(self.parser, 'cursor') as mock_cursor:
            mock_cursor.fetchone.return_value = None
            
            result = self.parser._parse_speech_segment(woordvoerder)
            
            # Should fall back to parent timing (from activiteititem level)
            expected_start = 14*3600 + 5*60 + 0   # 14:05:00
            expected_end = 14*3600 + 8*60 + 0     # 14:08:00
            
            self.assertEqual(result['start_time'], expected_start)
            self.assertEqual(result['end_time'], expected_end)

    def test_parse_full_xml_document_integration(self):
        """Integration test parsing a complete XML document."""
        with patch.object(self.parser, 'cursor') as mock_cursor:
            mock_cursor.fetchone.return_value = None
            mock_cursor.execute.return_value = None
            mock_cursor.fetchall.return_value = []
            
            with patch.object(self.parser, 'conn') as mock_conn:
                mock_conn.commit.return_value = None
                
                # Test parsing the sample XML
                root = ET.fromstring(self.sample_xml)
                speeches = []
                
                # Find all woordvoerder elements
                for woordvoerder in root.findall('.//{http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0}woordvoerder'):
                    result = self.parser._parse_speech_segment(woordvoerder)
                    if result:
                        speeches.append(result)
                
                # Verify we parsed speeches correctly
                self.assertGreater(len(speeches), 0)
                
                # Check first speech
                speech = speeches[0]
                self.assertEqual(speech['speaker'], "Tony van Dijck")
                self.assertIn("Test speech content here", speech['content'])
                self.assertGreater(speech['start_time'], 0)
                self.assertGreater(speech['end_time'], speech['start_time'])

    def test_minister_speaker_parsing(self):
        """Test parsing Minister speakers correctly."""
        root = ET.fromstring(self.minister_xml)
        woordvoerder = root.find('.//{http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0}woordvoerder')
        
        with patch.object(self.parser, 'cursor') as mock_cursor:
            mock_cursor.fetchone.return_value = None
            
            result = self.parser._parse_speech_segment(woordvoerder)
            
            self.assertIsNotNone(result)
            self.assertEqual(result['speaker'], "Minister Hoekstra")
            self.assertIn("Minister speech content", result['content'])

    def test_mevrouw_speaker_parsing(self):
        """Test parsing Mevrouw speakers correctly."""
        root = ET.fromstring(self.mevrouw_xml)
        woordvoerder = root.find('.//{http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0}woordvoerder')
        
        with patch.object(self.parser, 'cursor') as mock_cursor:
            mock_cursor.fetchone.return_value = None
            
            result = self.parser._parse_speech_segment(woordvoerder)
            
            self.assertIsNotNone(result)
            self.assertEqual(result['speaker'], "Leijten")
            self.assertIn("Mevrouw speech content", result['content'])

    def test_edge_cases_empty_elements(self):
        """Test handling of edge cases like empty elements."""
        xml_empty = '''<?xml version="1.0" encoding="UTF-8"?>
        <vlosCoreDocument xmlns="http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0">
            <vergadering>
                <activiteit>
                    <activiteithoofd>
                        <activiteitdeel>
                            <activiteititem>
                                <woordvoerder>
                                    <tekst></tekst>
                                </woordvoerder>
                            </activiteititem>
                        </activiteitdeel>
                    </activiteithoofd>
                </activiteit>
            </vergadering>
        </vlosCoreDocument>'''
        
        root = ET.fromstring(xml_empty)
        woordvoerder = root.find('.//{http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0}woordvoerder')
        
        with patch.object(self.parser, 'cursor') as mock_cursor:
            mock_cursor.fetchone.return_value = None
            
            result = self.parser._parse_speech_segment(woordvoerder)
            
            # Should handle empty content gracefully
            self.assertIsNotNone(result)
            self.assertEqual(result['speaker'], "Onbekend")
            self.assertEqual(result['content'].strip(), "")

    def test_database_insertion_prevention_duplicate(self):
        """Test that duplicate speeches are not inserted into database."""
        root = ET.fromstring(self.sample_xml)
        woordvoerder = root.find('.//{http://www.tweedekamer.nl/ggm/vergaderverslag/v1.0}woordvoerder')
        
        with patch.object(self.parser, 'cursor') as mock_cursor:
            # Simulate existing speech found
            mock_cursor.fetchone.return_value = (1,)  # Returns existing ID
            
            result = self.parser._parse_speech_segment(woordvoerder)
            
            # Should return existing speech data but not insert duplicate
            self.assertIsNotNone(result)
            # Verify no INSERT was called (only SELECT)
            insert_calls = [call for call in mock_cursor.execute.call_args_list 
                          if call[0][0].strip().upper().startswith('INSERT')]
            self.assertEqual(len(insert_calls), 0)

    def tearDown(self):
        """Clean up after tests."""
        self.parser = None


if __name__ == '__main__':
    unittest.main()