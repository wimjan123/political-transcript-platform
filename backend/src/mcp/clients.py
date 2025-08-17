"""
MCP (Model Context Protocol) client integrations for external services
"""
import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

import httpx

from ..config import settings

logger = logging.getLogger(__name__)


class Context7Client:
    """Client for context7 MCP for conversation memory and prompt templates"""
    
    def __init__(self):
        self.api_key = settings.CONVERSATIONAL_LLM_API_KEY
        self.base_url = "https://api.openai.com/v1"  # Default to OpenAI, can be configured
        
    async def get_system_prompt(self, template_name: str = "political_search_assistant") -> str:
        """Get system prompt template for conversational search"""
        
        # Default system prompt for political transcript search
        default_prompt = """You are a helpful AI assistant specialized in political transcript analysis. 

Your role is to help users search and understand political video transcripts. You have access to a database of political speeches, debates, and other political content with rich metadata including sentiment analysis, content moderation flags, and readability metrics.

Guidelines:
1. Always base your answers on the provided transcript segments
2. Include specific citations with segment IDs and timestamps when possible
3. Never fabricate information not present in the sources
4. If no relevant information is found, clearly state this
5. Provide balanced, factual analysis without political bias
6. Highlight relevant metadata like sentiment scores when appropriate
7. Use clear, accessible language while maintaining accuracy

When citing sources, use the format: [Speaker • MM:SS] for timestamp references.

If you cannot find relevant information to answer the user's question, politely explain that no matching content was found in the transcript database."""

        try:
            # In a real implementation, this would call the context7 MCP
            # For now, return the default prompt
            return default_prompt
            
        except Exception as e:
            logger.warning(f"Failed to get system prompt from context7: {e}")
            return default_prompt
    
    async def call_llm(
        self, 
        messages: List[Dict[str, str]], 
        system_prompt: str,
        context_segments: List[Dict[str, Any]],
        stream: bool = True
    ) -> Union[str, AsyncIterator[str]]:
        """Call LLM with conversation context and retrieved segments"""
        
        if not self.api_key:
            raise ValueError("No LLM API key configured")
        
        # Build context from retrieved segments
        context_text = self._build_context_text(context_segments)
        
        # Prepare messages
        formatted_messages = [
            {"role": "system", "content": f"{system_prompt}\n\nContext from transcript database:\n{context_text}"}
        ]
        formatted_messages.extend(messages)
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "gpt-3.5-turbo",  # Can be configured
            "messages": formatted_messages,
            "stream": stream,
            "temperature": 0.7,
            "max_tokens": 1000
        }
        
        if stream:
            return self._stream_llm_response(headers, payload)
        else:
            return await self._call_llm_sync(headers, payload)
    
    def _build_context_text(self, segments: List[Dict[str, Any]]) -> str:
        """Build context text from retrieved segments"""
        if not segments:
            return "No relevant transcript segments found."
        
        context_parts = []
        for i, segment in enumerate(segments[:5], 1):  # Limit to top 5 segments
            speaker = segment.get("speaker", "Unknown")
            text = segment.get("text", "")
            video_title = segment.get("video_title", "")
            date = segment.get("date", "")
            video_seconds = segment.get("video_seconds")
            segment_id = segment.get("id", "")
            
            timestamp = f"{video_seconds//60:02d}:{video_seconds%60:02d}" if video_seconds else "Unknown"
            
            context_part = f"""
Segment {i}:
- Video: {video_title} ({date})
- Speaker: {speaker}
- Timestamp: {timestamp}
- Segment ID: {segment_id}
- Content: {text}
"""
            
            # Add sentiment if available
            sentiment = segment.get("sentiment", {})
            if sentiment and sentiment.get("vader"):
                sentiment_score = sentiment["vader"]
                sentiment_label = "positive" if sentiment_score > 0.1 else "negative" if sentiment_score < -0.1 else "neutral"
                context_part += f"- Sentiment: {sentiment_label} ({sentiment_score:.3f})\n"
            
            context_parts.append(context_part)
        
        return "\n".join(context_parts)
    
    async def _stream_llm_response(self, headers: Dict[str, str], payload: Dict[str, Any]):
        """Stream LLM response"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream(
                "POST", 
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload
            ) as response:
                if response.status_code != 200:
                    raise Exception(f"LLM API error: {response.status_code}")
                
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            if chunk.get("choices") and chunk["choices"][0].get("delta", {}).get("content"):
                                yield chunk["choices"][0]["delta"]["content"]
                        except json.JSONDecodeError:
                            continue
    
    async def _call_llm_sync(self, headers: Dict[str, str], payload: Dict[str, Any]) -> str:
        """Call LLM synchronously"""
        payload["stream"] = False
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload
            )
            
            if response.status_code != 200:
                raise Exception(f"LLM API error: {response.status_code} - {response.text}")
            
            result = response.json()
            return result["choices"][0]["message"]["content"]


class AirtableClient:
    """Client for Airtable MCP for logging search queries and analytics"""
    
    def __init__(self):
        self.api_key = settings.AIRTABLE_API_KEY
        self.base_id = settings.AIRTABLE_BASE_ID
        self.base_url = f"https://api.airtable.com/v0/{self.base_id}"
        
    async def log_chat_interaction(
        self,
        conversation_id: str,
        user_query: str,
        retrieved_segments: List[Dict[str, Any]],
        llm_response: str,
        latency_ms: int,
        filters: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Log a chat interaction to Airtable"""
        
        if not self.api_key or not self.base_id:
            logger.warning("Airtable credentials not configured, skipping logging")
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            # Prepare data for Airtable
            record_data = {
                "fields": {
                    "Conversation ID": conversation_id,
                    "User Query": user_query,
                    "Response": llm_response,
                    "Latency (ms)": latency_ms,
                    "Timestamp": datetime.utcnow().isoformat(),
                    "Retrieved Segments": len(retrieved_segments),
                    "Top Segment IDs": ", ".join([str(s.get("id", "")) for s in retrieved_segments[:3]]),
                    "Filters Applied": json.dumps(filters) if filters else None
                }
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/Chat Interactions",  # Table name
                    headers=headers,
                    json={"records": [record_data]}
                )
                
                if response.status_code in [200, 201]:
                    logger.info(f"Logged chat interaction to Airtable: {conversation_id}")
                    return True
                else:
                    logger.error(f"Failed to log to Airtable: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error logging to Airtable: {e}")
            return False
    
    async def log_search_query(
        self,
        query: str,
        search_type: str,
        results_count: int,
        latency_ms: int,
        clicked_result_id: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Log a search query to Airtable"""
        
        if not self.api_key or not self.base_id:
            return False
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            record_data = {
                "fields": {
                    "Query": query,
                    "Search Type": search_type,
                    "Results Count": results_count,
                    "Latency (ms)": latency_ms,
                    "Timestamp": datetime.utcnow().isoformat(),
                    "Clicked Result ID": clicked_result_id,
                    "Filters": json.dumps(filters) if filters else None
                }
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/Search Queries",  # Table name
                    headers=headers,
                    json={"records": [record_data]}
                )
                
                return response.status_code in [200, 201]
                
        except Exception as e:
            logger.error(f"Error logging search query to Airtable: {e}")
            return False


class MeilisearchMCPClient:
    """Extended Meilisearch client for admin operations via MCP"""
    
    def __init__(self):
        self.host = settings.MEILI_HOST
        self.master_key = settings.MEILI_MASTER_KEY
    
    def headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.master_key:
            headers["Authorization"] = f"Bearer {self.master_key}"
        return headers
    
    async def create_api_key(self, description: str, actions: List[str], indexes: List[str]) -> Optional[str]:
        """Create a new API key via MCP"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.host}/keys",
                    headers=self.headers(),
                    json={
                        "description": description,
                        "actions": actions,
                        "indexes": indexes,
                        "expiresAt": None
                    }
                )
                
                if response.status_code in [200, 201]:
                    return response.json().get("key")
                return None
                
        except Exception as e:
            logger.error(f"Error creating Meilisearch API key: {e}")
            return None
    
    async def get_index_stats(self, index_name: str) -> Optional[Dict[str, Any]]:
        """Get statistics for an index"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.host}/indexes/{index_name}/stats",
                    headers=self.headers()
                )
                
                if response.status_code == 200:
                    return response.json()
                return None
                
        except Exception as e:
            logger.error(f"Error getting index stats: {e}")
            return None


# Global client instances
context7_client = Context7Client()
airtable_client = AirtableClient()
meilisearch_mcp_client = MeilisearchMCPClient()