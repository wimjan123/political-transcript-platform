"""
HTML parser for political transcript files
"""
import re
from typing import Dict, List, Optional, Tuple, Any
from bs4 import BeautifulSoup, Tag
from datetime import datetime
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class TranscriptHTMLParser:
    """Parser for political transcript HTML files"""
    
    def __init__(self):
        self.video_metadata = {}
        self.segments = []
    
    def parse_file(self, file_path: str) -> Dict[str, Any]:
        """
        Parse a single HTML transcript file
        
        Args:
            file_path: Path to the HTML file
            
        Returns:
            Dictionary containing video metadata and transcript segments
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            soup = BeautifulSoup(content, 'html.parser')
            
            # Extract video metadata from filename and HTML
            filename = Path(file_path).name
            video_metadata = self._extract_video_metadata(soup, filename)
            
            # Extract transcript segments
            segments = self._extract_transcript_segments(soup)
            
            return {
                'video_metadata': video_metadata,
                'segments': segments,
                'total_segments': len(segments)
            }
            
        except Exception as e:
            logger.error(f"Error parsing file {file_path}: {str(e)}")
            raise
    
    def _extract_video_metadata(self, soup: BeautifulSoup, filename: str) -> Dict[str, Any]:
        """Extract video metadata from HTML and filename"""
        metadata = {
            'filename': filename,
            'title': '',
            'date': None,
            'source': '',
            'channel': '',
            'description': '',
            'url': '',
            'format': '',
            'candidate': '',
            'place': '',
            'record_type': ''
        }
        
        # Extract title from meta tag or title tag
        title_tag = soup.find('meta', {'property': 'og:title'})
        if title_tag:
            metadata['title'] = title_tag.get('content', '').replace('Roll Call Factba.se - ', '')
        else:
            title_tag = soup.find('title')
            if title_tag:
                metadata['title'] = title_tag.get_text().replace('Roll Call Factba.se - ', '')
        
        # Extract date from filename (e.g., "may-16-2025", "april-30-2020", "february-6-2019")
        date_patterns = [
            r'([a-z]+-\d{1,2}-\d{4})',  # month-day-year
            r'(\d{1,2}-\d{1,2}-\d{4})',  # mm-dd-yyyy
            r'(\d{4}-\d{1,2}-\d{1,2})',  # yyyy-mm-dd
        ]
        
        for pattern in date_patterns:
            date_match = re.search(pattern, filename)
            if date_match:
                try:
                    date_str = date_match.group(1)
                    
                    # Handle month-day-year format
                    if re.match(r'[a-z]+-\d{1,2}-\d{4}', date_str):
                        date_str = date_str.replace('-', ' ')
                        metadata['date'] = datetime.strptime(date_str, '%B %d %Y').date()
                    # Handle mm-dd-yyyy format  
                    elif re.match(r'\d{1,2}-\d{1,2}-\d{4}', date_str):
                        metadata['date'] = datetime.strptime(date_str, '%m-%d-%Y').date()
                    # Handle yyyy-mm-dd format
                    elif re.match(r'\d{4}-\d{1,2}-\d{1,2}', date_str):
                        metadata['date'] = datetime.strptime(date_str, '%Y-%m-%d').date()
                    break
                except ValueError:
                    logger.warning(f"Could not parse date from filename: {filename}")
                    continue
        
        # If no date found in filename, try to extract from title or meta tags
        if not metadata['date']:
            # Try to extract from title - look for patterns like "February 6, 2019" or "August 13, 2025"
            title = metadata.get('title', '')
            date_in_title = re.search(r'([A-Z][a-z]+\s+\d{1,2},\s+\d{4})', title)
            if date_in_title:
                try:
                    metadata['date'] = datetime.strptime(date_in_title.group(1), '%B %d, %Y').date()
                except ValueError:
                    pass
            
            # Try to extract from meta modified time
            if not metadata['date']:
                modified_tag = soup.find('meta', {'property': 'article:modified_time'})
                if modified_tag:
                    try:
                        modified_time = modified_tag.get('content', '')
                        # Parse ISO format: 2024-04-22T15:47:56+00:00
                        metadata['date'] = datetime.fromisoformat(modified_time.replace('Z', '+00:00')).date()
                    except ValueError:
                        pass
        
        # Extract source/channel from filename or title
        if 'fox-news' in filename:
            metadata['source'] = 'Fox News'
        elif 'cnn' in filename:
            metadata['source'] = 'CNN'
        elif 'nbc' in filename:
            metadata['source'] = 'NBC'
        elif 'abc' in filename:
            metadata['source'] = 'ABC'
        elif 'cbs' in filename:
            metadata['source'] = 'CBS'
        elif 'newsmax' in filename:
            metadata['source'] = 'Newsmax'
        elif 'white-house' in filename or 'press-briefing' in filename:
            metadata['source'] = 'White House'
        
        # Extract event format from filename
        if 'political-rally' in filename or 'rally' in filename:
            metadata['format'] = 'Political Rally'
        elif 'press-briefing' in filename or 'briefing' in filename:
            metadata['format'] = 'Press Briefing'
        elif 'interview' in filename:
            metadata['format'] = 'Interview'
        elif 'speech' in filename:
            metadata['format'] = 'Speech'
        elif 'remarks' in filename:
            metadata['format'] = 'Remarks'
        elif 'debate' in filename:
            metadata['format'] = 'Debate'
        elif 'town-hall' in filename:
            metadata['format'] = 'Town Hall'
        elif 'meeting' in filename:
            metadata['format'] = 'Meeting'
        elif 'conference' in filename:
            metadata['format'] = 'Conference'
        
        # Extract candidate from filename
        if 'donald-trump' in filename or 'trump' in filename:
            metadata['candidate'] = 'Donald Trump'
        elif 'joe-biden' in filename or 'biden' in filename:
            metadata['candidate'] = 'Joe Biden'
        elif 'kamala-harris' in filename or 'harris' in filename:
            metadata['candidate'] = 'Kamala Harris'
        elif 'mike-pence' in filename or 'pence' in filename:
            metadata['candidate'] = 'Mike Pence'
        elif 'ron-desantis' in filename or 'desantis' in filename:
            metadata['candidate'] = 'Ron DeSantis'
        elif 'nikki-haley' in filename or 'haley' in filename:
            metadata['candidate'] = 'Nikki Haley'
        
        # Extract place from filename (location patterns)
        place_patterns = [
            (r'white-house', 'White House'),
            (r'mar-a-lago', 'Mar-a-Lago'),
            (r'trump-tower', 'Trump Tower'),
            (r'oval-office', 'Oval Office'),
            (r'rose-garden', 'Rose Garden'),
            (r'camp-david', 'Camp David'),
            # State patterns
            (r'florida', 'Florida'),
            (r'texas', 'Texas'),
            (r'california', 'California'),
            (r'new-york', 'New York'),
            (r'nevada', 'Nevada'),
            (r'pennsylvania', 'Pennsylvania'),
            (r'georgia', 'Georgia'),
            (r'arizona', 'Arizona'),
            (r'michigan', 'Michigan'),
            (r'wisconsin', 'Wisconsin'),
            (r'north-carolina', 'North Carolina'),
            (r'ohio', 'Ohio'),
            (r'virginia', 'Virginia'),
            (r'iowa', 'Iowa'),
            (r'new-hampshire', 'New Hampshire'),
            # City patterns
            (r'miami', 'Miami'),
            (r'tampa', 'Tampa'),
            (r'orlando', 'Orlando'),
            (r'phoenix', 'Phoenix'),
            (r'las-vegas', 'Las Vegas'),
            (r'atlanta', 'Atlanta'),
            (r'dallas', 'Dallas'),
            (r'houston', 'Houston'),
            (r'philadelphia', 'Philadelphia'),
            (r'detroit', 'Detroit'),
            (r'milwaukee', 'Milwaukee'),
            (r'charlotte', 'Charlotte'),
            (r'columbus', 'Columbus'),
            (r'richmond', 'Richmond'),
            (r'minden', 'Minden'),
            (r'waco', 'Waco'),
            (r'greenville', 'Greenville'),
            (r'youngstown', 'Youngstown'),
            (r'bedminster', 'Bedminster'),
            (r'washington', 'Washington'),
        ]
        
        for pattern, place_name in place_patterns:
            if re.search(pattern, filename):
                metadata['place'] = place_name
                break
        
        # Extract record type from format and context
        if metadata['format'] in ['Press Briefing', 'Remarks']:
            metadata['record_type'] = 'Official Statement'
        elif metadata['format'] in ['Political Rally', 'Speech']:
            metadata['record_type'] = 'Campaign Event'
        elif metadata['format'] == 'Interview':
            metadata['record_type'] = 'Media Interview'
        elif metadata['format'] == 'Debate':
            metadata['record_type'] = 'Political Debate'
        elif metadata['format'] in ['Meeting', 'Conference']:
            metadata['record_type'] = 'Official Meeting'
        elif metadata['format'] == 'Town Hall':
            metadata['record_type'] = 'Public Forum'
        
        # Extract description
        desc_tag = soup.find('meta', {'name': 'description'})
        if desc_tag:
            metadata['description'] = desc_tag.get('content', '')
        
        # Extract URL
        url_tag = soup.find('meta', {'property': 'og:url'})
        if url_tag:
            metadata['url'] = url_tag.get('content', '')
        
        # Extract video thumbnail URL and construct video URL
        video_thumb_tag = soup.find('meta', {'name': 'twitter:image'})
        if video_thumb_tag:
            thumb_url = video_thumb_tag.get('content', '')
            if 'media-cdn.factba.se' in thumb_url:
                metadata['video_thumbnail_url'] = thumb_url
                
                # Extract video ID from thumbnail URL and construct video URL
                # Pattern: https://media-cdn.factba.se/thumbs/video/941627232/941627232-1.jpg
                video_id_match = re.search(r'/video/(\d+)/\d+-\d+\.jpg', thumb_url)
                if video_id_match:
                    video_id = video_id_match.group(1)
                    # Construct factbase video URL
                    metadata['video_url'] = f"https://factba.se/video/{video_id}"
        
        # Extract Vimeo video ID from iframe
        vimeo_iframe = soup.find('iframe', {'id': 'vimeoPlayer'})
        if vimeo_iframe:
            vimeo_src = vimeo_iframe.get('src', '')
            # Pattern: https://player.vimeo.com/video/941627232?h=...
            vimeo_id_match = re.search(r'player\.vimeo\.com/video/(\d+)', vimeo_src)
            if vimeo_id_match:
                metadata['vimeo_video_id'] = vimeo_id_match.group(1)
                metadata['vimeo_embed_url'] = vimeo_src
        
        return metadata
    
    def _extract_transcript_segments(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """Extract all transcript segments from HTML"""
        segments = []
        
        # Find all transcript segments
        segment_divs = soup.find_all('div', class_='mb-4 border-b mx-6 my-4')
        
        for segment_div in segment_divs:
            try:
                segment_data = self._parse_segment(segment_div)
                if segment_data:
                    segments.append(segment_data)
            except Exception as e:
                logger.warning(f"Error parsing segment: {str(e)}")
                continue
        
        return segments
    
    def _parse_segment(self, segment_div: Tag) -> Optional[Dict[str, Any]]:
        """Parse a single transcript segment"""
        segment_data = {}
        
        # Extract segment ID
        segment_id = segment_div.get('id', '')
        if segment_id:
            segment_data['segment_id'] = segment_id.split('-')[-1]  # Get the number part
        
        # Extract video seconds from play button
        play_button = segment_div.find('a', class_='transcript-play-video')
        if play_button:
            seconds = play_button.get('data-seconds')
            if seconds:
                segment_data['video_seconds'] = int(seconds)
        
        # Extract speaker name and timestamp
        speaker_info = self._extract_speaker_info(segment_div)
        segment_data.update(speaker_info)
        
        # Extract transcript text
        text_div = segment_div.find('div', class_='flex-auto text-md text-gray-600 leading-loose')
        if text_div:
            segment_data['transcript_text'] = text_div.get_text(strip=True)
        
        # Extract analytics data from expandable section
        analytics_data = self._extract_analytics_data(segment_div)
        segment_data.update(analytics_data)
        
        # Calculate text metrics
        if 'transcript_text' in segment_data:
            text = segment_data['transcript_text']
            segment_data['word_count'] = len(text.split())
            segment_data['char_count'] = len(text)
        
        return segment_data if segment_data.get('transcript_text') else None
    
    def _extract_speaker_info(self, segment_div: Tag) -> Dict[str, Any]:
        """Extract speaker name and timestamp information"""
        speaker_info = {}
        
        # Find speaker name in h2 tag
        h2_tag = segment_div.find('h2', class_='text-md inline')
        if h2_tag:
            speaker_info['speaker_name'] = h2_tag.get_text(strip=True)
        
        # Find timestamp in span tag
        timestamp_span = segment_div.find('span', class_='text-xs text-gray-600 inline ml-2')
        if timestamp_span:
            timestamp_text = timestamp_span.get_text(strip=True)
            # Parse timestamp like "00:07:02-00:07:04 (2 sec)"
            timestamp_match = re.match(r'(\d{2}:\d{2}:\d{2})-(\d{2}:\d{2}:\d{2})\s*\((\d+)\s*sec\)', timestamp_text)
            if timestamp_match:
                speaker_info['timestamp_start'] = timestamp_match.group(1)
                speaker_info['timestamp_end'] = timestamp_match.group(2)
                speaker_info['duration_seconds'] = int(timestamp_match.group(3))
        
        return speaker_info
    
    def _extract_analytics_data(self, segment_div: Tag) -> Dict[str, Any]:
        """Extract sentiment, moderation, topic, and readability data"""
        analytics_data = {}
        
        # Find the expandable details section
        details_div = segment_div.find('div', {'x-show': 'openDetails'})
        if not details_div:
            return analytics_data
        
        # Extract sentiment analysis
        sentiment_data = self._extract_sentiment_data(details_div)
        analytics_data.update(sentiment_data)
        
        # Extract content moderation
        moderation_data = self._extract_moderation_data(details_div)
        analytics_data.update(moderation_data)
        
        # Extract topic classification
        topic_data = self._extract_topic_data(details_div)
        analytics_data.update(topic_data)
        
        # Extract readability metrics
        readability_data = self._extract_readability_data(details_div)
        analytics_data.update(readability_data)
        
        # Extract stresslens data
        stresslens_data = self._extract_stresslens_data(segment_div)
        analytics_data.update(stresslens_data)
        
        return analytics_data
    
    def _extract_sentiment_data(self, details_div: Tag) -> Dict[str, Any]:
        """Extract sentiment analysis data"""
        sentiment_data = {}
        
        # Look for sentiment sections
        sentiment_divs = details_div.find_all('div', class_='mb-4 flex gap-2')
        
        for div in sentiment_divs:
            text_content = div.get_text(strip=True)
            
            # Loughran McDonald sentiment
            if 'Loughran McDonald' in text_content:
                parts = text_content.split()
                if len(parts) >= 3:
                    try:
                        sentiment_data['sentiment_loughran_score'] = float(parts[-2])
                        sentiment_data['sentiment_loughran_label'] = parts[-1]
                    except (ValueError, IndexError):
                        pass
            
            # Harvard-IV sentiment (if present)
            elif 'Harvard' in text_content:
                parts = text_content.split()
                if len(parts) >= 3:
                    try:
                        sentiment_data['sentiment_harvard_score'] = float(parts[-2])
                        sentiment_data['sentiment_harvard_label'] = parts[-1]
                    except (ValueError, IndexError):
                        pass
            
            # VADER sentiment (if present)
            elif 'VADER' in text_content:
                parts = text_content.split()
                if len(parts) >= 3:
                    try:
                        sentiment_data['sentiment_vader_score'] = float(parts[-2])
                        sentiment_data['sentiment_vader_label'] = parts[-1]
                    except (ValueError, IndexError):
                        pass
        
        return sentiment_data
    
    def _extract_moderation_data(self, details_div: Tag) -> Dict[str, Any]:
        """Extract content moderation scores"""
        moderation_data = {}
        
        # Look for moderation sections
        moderation_divs = details_div.find_all('div', class_='mb-4')
        
        for div in moderation_divs:
            text_content = div.get_text(strip=True)
            
            if 'Harassment' in text_content:
                score_match = re.search(r'Harassment\s+([\d.]+)', text_content)
                if score_match:
                    moderation_data['moderation_harassment'] = float(score_match.group(1))
            
            elif 'Hate' in text_content:
                score_match = re.search(r'Hate\s+([\d.]+)', text_content)
                if score_match:
                    moderation_data['moderation_hate'] = float(score_match.group(1))
            
            elif 'Self-harm' in text_content or 'Self harm' in text_content:
                score_match = re.search(r'Self-?harm\s+([\d.]+)', text_content)
                if score_match:
                    moderation_data['moderation_self_harm'] = float(score_match.group(1))
            
            elif 'Sexual' in text_content:
                score_match = re.search(r'Sexual\s+([\d.]+)', text_content)
                if score_match:
                    moderation_data['moderation_sexual'] = float(score_match.group(1))
            
            elif 'Violence' in text_content:
                score_match = re.search(r'Violence\s+([\d.]+)', text_content)
                if score_match:
                    moderation_data['moderation_violence'] = float(score_match.group(1))
        
        # Calculate overall moderation score
        scores = [v for k, v in moderation_data.items() if k.startswith('moderation_') and not k.endswith('_flag')]
        if scores:
            moderation_data['moderation_overall_score'] = max(scores)
        
        # Set moderation flags based on scores (threshold: 0.3)
        threshold = 0.3
        moderation_data['moderation_harassment_flag'] = moderation_data.get('moderation_harassment', 0) >= threshold
        moderation_data['moderation_hate_flag'] = moderation_data.get('moderation_hate', 0) >= threshold
        moderation_data['moderation_violence_flag'] = moderation_data.get('moderation_violence', 0) >= threshold
        moderation_data['moderation_sexual_flag'] = moderation_data.get('moderation_sexual', 0) >= threshold
        moderation_data['moderation_selfharm_flag'] = moderation_data.get('moderation_self_harm', 0) >= threshold
        
        return moderation_data
    
    def _extract_topic_data(self, details_div: Tag) -> Dict[str, Any]:
        """Extract topic classification data"""
        topic_data = {}
        
        # Look for topic sections
        topic_divs = details_div.find_all('div', class_='flex gap-2 py-2 border-b')
        
        for div in topic_divs:
            text_content = div.get_text(strip=True)
            if 'Topic:' in text_content:
                topic_parts = text_content.split('Topic:')
                if len(topic_parts) > 1:
                    topic_data['primary_topic'] = topic_parts[1].strip()
                break
        
        return topic_data
    
    def _extract_readability_data(self, details_div: Tag) -> Dict[str, Any]:
        """Extract readability metrics"""
        readability_data = {}
        
        # Look for readability sections
        readability_divs = details_div.find_all('div', class_='mb-4 flex gap-2')
        
        for div in readability_divs:
            text_content = div.get_text(strip=True)
            
            if 'Flesch-Kincaid Grade' in text_content:
                score_match = re.search(r'Flesch-Kincaid Grade\s+([\d.]+)', text_content)
                if score_match:
                    readability_data['flesch_kincaid_grade'] = float(score_match.group(1))
            
            elif 'Gunning Fog' in text_content:
                score_match = re.search(r'Gunning Fog\s+([\d.]+)', text_content)
                if score_match:
                    readability_data['gunning_fog_index'] = float(score_match.group(1))
            
            elif 'Coleman-Liau' in text_content:
                score_match = re.search(r'Coleman-Liau\s+([\d.]+)', text_content)
                if score_match:
                    readability_data['coleman_liau_index'] = float(score_match.group(1))
            
            elif 'Automated Readability' in text_content:
                score_match = re.search(r'Automated Readability\s+([\d.]+)', text_content)
                if score_match:
                    readability_data['automated_readability_index'] = float(score_match.group(1))
            
            elif 'SMOG' in text_content:
                score_match = re.search(r'SMOG\s+([\d.]+)', text_content)
                if score_match:
                    readability_data['smog_index'] = float(score_match.group(1))
            
            elif 'Flesch Reading Ease' in text_content:
                score_match = re.search(r'Flesch Reading Ease\s+([\d.]+)', text_content)
                if score_match:
                    readability_data['flesch_reading_ease'] = float(score_match.group(1))
        
        return readability_data
    
    def _extract_stresslens_data(self, segment_div: Tag) -> Dict[str, Any]:
        """Extract stresslens stress analytics from HTML"""
        stresslens_data = {}
        
        # Look for stresslens display in the segment
        stress_divs = segment_div.find_all('div', class_='hidden sm:block')
        
        for div in stress_divs:
            text_content = div.get_text(strip=True)
            
            # Check for "No StressLens" case
            if 'No StressLens' in text_content:
                continue
                
            # Look for stress score patterns
            # Patterns might be like "High Stress 0.85" or "Medium Stress 0.45"
            stress_patterns = [
                (r'High Stress\s+([\d.]+)', 'high'),
                (r'Medium Stress\s+([\d.]+)', 'medium'), 
                (r'Low Stress\s+([\d.]+)', 'low'),
                (r'Stress Score\s+([\d.]+)', 'neutral'),
                (r'StressLens\s+([\d.]+)', 'neutral'),
                (r'Stress\s+([\d.]+)', 'neutral')
            ]
            
            for pattern, level in stress_patterns:
                match = re.search(pattern, text_content, re.IGNORECASE)
                if match:
                    score = float(match.group(1))
                    stresslens_data['stresslens_score'] = score
                    
                    # Assign rank based on score level
                    if level == 'high' or score >= 0.7:
                        stresslens_data['stresslens_rank'] = 1
                    elif level == 'medium' or score >= 0.4:
                        stresslens_data['stresslens_rank'] = 2
                    elif level == 'low' or score >= 0.2:
                        stresslens_data['stresslens_rank'] = 3
                    else:
                        stresslens_data['stresslens_rank'] = 4
                    break
        
        # Also check for stress level indicators in segment header
        stress_indicators = segment_div.find_all('div', string=re.compile(r'.*[Ss]tress.*'))
        for indicator in stress_indicators:
            text = indicator.get_text(strip=True)
            if 'No StressLens' not in text:
                # Try to extract numeric values from any stress-related text
                numbers = re.findall(r'\d+\.?\d*', text)
                if numbers:
                    try:
                        score = float(numbers[0])
                        if 0 <= score <= 1:  # Valid stress score range
                            stresslens_data['stresslens_score'] = score
                            # Calculate rank based on score
                            if score >= 0.7:
                                stresslens_data['stresslens_rank'] = 1
                            elif score >= 0.4:
                                stresslens_data['stresslens_rank'] = 2
                            elif score >= 0.2:
                                stresslens_data['stresslens_rank'] = 3
                            else:
                                stresslens_data['stresslens_rank'] = 4
                            break
                    except ValueError:
                        continue
        
        return stresslens_data