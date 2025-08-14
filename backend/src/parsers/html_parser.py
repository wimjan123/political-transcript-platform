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
            'url': ''
        }
        
        # Extract title from meta tag or title tag
        title_tag = soup.find('meta', {'property': 'og:title'})
        if title_tag:
            metadata['title'] = title_tag.get('content', '').replace('Roll Call Factba.se - ', '')
        else:
            title_tag = soup.find('title')
            if title_tag:
                metadata['title'] = title_tag.get_text().replace('Roll Call Factba.se - ', '')
        
        # Extract date from filename (e.g., "may-16-2025")
        date_match = re.search(r'([a-z]+-\d{1,2}-\d{4})', filename)
        if date_match:
            try:
                date_str = date_match.group(1)
                # Convert to proper format for parsing
                date_str = date_str.replace('-', ' ')
                metadata['date'] = datetime.strptime(date_str, '%B %d %Y').date()
            except ValueError:
                logger.warning(f"Could not parse date from filename: {filename}")
        
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
        scores = [v for k, v in moderation_data.items() if k.startswith('moderation_')]
        if scores:
            moderation_data['moderation_overall_score'] = max(scores)
        
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