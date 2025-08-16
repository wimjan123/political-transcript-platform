// Mock Airtable service for demonstration
// In production, this would integrate with the real Airtable API

export interface ConversationalQueryLog {
  id?: string;
  timestamp: string;
  userQuery: string;
  extractedSearchQuery: string;
  searchMode: 'lexical' | 'hybrid' | 'semantic';
  filters: Record<string, any>;
  resultCount: number;
  responseTime: number;
  userId?: string;
  sessionId: string;
  language?: string;
}

export interface SearchAnalytics {
  id?: string;
  date: string;
  totalQueries: number;
  avgResponseTime: number;
  topQueries: Array<{ query: string; count: number }>;
  searchModeDistribution: Record<string, number>;
  languageDistribution: Record<string, number>;
}

class AirtableService {
  private baseUrl = process.env.REACT_APP_AIRTABLE_BASE_URL || 'mock://airtable';
  private apiKey = process.env.REACT_APP_AIRTABLE_API_KEY || 'mock-key';
  private baseId = process.env.REACT_APP_AIRTABLE_BASE_ID || 'appMockBase123';
  
  // Mock storage for demo purposes
  private mockLogs: ConversationalQueryLog[] = [];
  private mockAnalytics: SearchAnalytics[] = [];

  async logConversationalQuery(log: Omit<ConversationalQueryLog, 'id' | 'timestamp'>): Promise<string> {
    const newLog: ConversationalQueryLog = {
      id: `rec${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };

    if (this.apiKey === 'mock-key') {
      // Mock implementation
      this.mockLogs.push(newLog);
      console.log('Mock Airtable: Logged conversational query', newLog);
      return newLog.id!;
    }

    try {
      // Real Airtable implementation would go here
      const response = await fetch(`${this.baseUrl}/v0/${this.baseId}/ConversationalQueries`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            UserQuery: log.userQuery,
            ExtractedSearchQuery: log.extractedSearchQuery,
            SearchMode: log.searchMode,
            Filters: JSON.stringify(log.filters),
            ResultCount: log.resultCount,
            ResponseTime: log.responseTime,
            UserId: log.userId || 'anonymous',
            SessionId: log.sessionId,
            Language: log.language || 'auto',
            Timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.id;
    } catch (error) {
      console.error('Failed to log to Airtable:', error);
      // Fallback to local storage for resilience
      this.mockLogs.push(newLog);
      return newLog.id!;
    }
  }

  async getSearchAnalytics(dateRange?: { from: string; to: string }): Promise<SearchAnalytics[]> {
    if (this.apiKey === 'mock-key') {
      // Generate mock analytics
      const mockAnalytics: SearchAnalytics = {
        id: 'recAnalytics123',
        date: new Date().toISOString().split('T')[0],
        totalQueries: this.mockLogs.length,
        avgResponseTime: this.mockLogs.reduce((sum, log) => sum + log.responseTime, 0) / (this.mockLogs.length || 1),
        topQueries: this.getTopQueries(),
        searchModeDistribution: this.getSearchModeDistribution(),
        languageDistribution: this.getLanguageDistribution(),
      };
      
      return [mockAnalytics];
    }

    try {
      // Real Airtable query would go here
      const queryParams = new URLSearchParams();
      if (dateRange) {
        queryParams.append('filterByFormula', `AND(Date >= '${dateRange.from}', Date <= '${dateRange.to}')`);
      }

      const response = await fetch(`${this.baseUrl}/v0/${this.baseId}/SearchAnalytics?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.records.map((record: any) => ({
        id: record.id,
        ...record.fields,
      }));
    } catch (error) {
      console.error('Failed to fetch analytics from Airtable:', error);
      return [];
    }
  }

  async getRecentQueries(limit: number = 50): Promise<ConversationalQueryLog[]> {
    if (this.apiKey === 'mock-key') {
      return this.mockLogs
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    }

    try {
      const response = await fetch(`${this.baseUrl}/v0/${this.baseId}/ConversationalQueries?maxRecords=${limit}&sort[0][field]=Timestamp&sort[0][direction]=desc`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.records.map((record: any) => ({
        id: record.id,
        timestamp: record.fields.Timestamp,
        userQuery: record.fields.UserQuery,
        extractedSearchQuery: record.fields.ExtractedSearchQuery,
        searchMode: record.fields.SearchMode,
        filters: JSON.parse(record.fields.Filters || '{}'),
        resultCount: record.fields.ResultCount,
        responseTime: record.fields.ResponseTime,
        userId: record.fields.UserId,
        sessionId: record.fields.SessionId,
        language: record.fields.Language,
      }));
    } catch (error) {
      console.error('Failed to fetch recent queries from Airtable:', error);
      return [];
    }
  }

  private getTopQueries(): Array<{ query: string; count: number }> {
    const queryCount = new Map<string, number>();
    
    this.mockLogs.forEach(log => {
      const query = log.userQuery.toLowerCase();
      queryCount.set(query, (queryCount.get(query) || 0) + 1);
    });

    return Array.from(queryCount.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getSearchModeDistribution(): Record<string, number> {
    const distribution: Record<string, number> = { lexical: 0, hybrid: 0, semantic: 0 };
    
    this.mockLogs.forEach(log => {
      distribution[log.searchMode] = (distribution[log.searchMode] || 0) + 1;
    });

    return distribution;
  }

  private getLanguageDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    this.mockLogs.forEach(log => {
      const lang = log.language || 'auto';
      distribution[lang] = (distribution[lang] || 0) + 1;
    });

    return distribution;
  }

  // Generate a unique session ID for tracking user sessions
  generateSessionId(): string {
    const sessionId = sessionStorage.getItem('searchSessionId');
    if (sessionId) {
      return sessionId;
    }

    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('searchSessionId', newSessionId);
    return newSessionId;
  }

  // Check if Airtable is properly configured
  isConfigured(): boolean {
    return this.apiKey !== 'mock-key' && this.baseId !== 'appMockBase123';
  }
}

export const airtableService = new AirtableService();