import React, { useState, useEffect } from 'react';
import { Calendar, Filter, X, Users, Hash } from 'lucide-react';

interface DashboardFilters {
  dateFrom: string;
  dateTo: string;
  speakers: string[];
  topics: string[];
}

interface GlobalFiltersProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  isLoading?: boolean;
  availableSpeakers?: string[];
  availableTopics?: string[];
}

const GlobalFilters: React.FC<GlobalFiltersProps> = ({
  filters,
  onFiltersChange,
  isLoading = false,
  availableSpeakers = [],
  availableTopics = []
}) => {
  const [localFilters, setLocalFilters] = useState<DashboardFilters>(filters);
  const [showSpeakerDropdown, setShowSpeakerDropdown] = useState(false);
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);
  const [speakerSearch, setSpeakerSearch] = useState('');
  const [topicSearch, setTopicSearch] = useState('');

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleDateChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    const newFilters = { ...localFilters, [field]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleSpeakerToggle = (speaker: string) => {
    const newSpeakers = localFilters.speakers.includes(speaker)
      ? localFilters.speakers.filter(s => s !== speaker)
      : [...localFilters.speakers, speaker];
    
    const newFilters = { ...localFilters, speakers: newSpeakers };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleTopicToggle = (topic: string) => {
    const newTopics = localFilters.topics.includes(topic)
      ? localFilters.topics.filter(t => t !== topic)
      : [...localFilters.topics, topic];
    
    const newFilters = { ...localFilters, topics: newTopics };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    const emptyFilters = {
      dateFrom: '',
      dateTo: '',
      speakers: [],
      topics: []
    };
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
  };

  const hasActiveFilters = () => {
    return localFilters.dateFrom || 
           localFilters.dateTo || 
           localFilters.speakers.length > 0 || 
           localFilters.topics.length > 0;
  };

  const filteredSpeakers = availableSpeakers.filter(speaker =>
    speaker.toLowerCase().includes(speakerSearch.toLowerCase())
  );

  const filteredTopics = availableTopics.filter(topic =>
    topic.toLowerCase().includes(topicSearch.toLowerCase())
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900 flex items-center">
          <Filter className="h-5 w-5 mr-2" />
          Dashboard Filters
        </h2>
        {hasActiveFilters() && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-1" />
            Clear All
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Date Range */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            <Calendar className="h-4 w-4 inline mr-1" />
            From Date
          </label>
          <input
            type="date"
            value={localFilters.dateFrom}
            onChange={(e) => handleDateChange('dateFrom', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            <Calendar className="h-4 w-4 inline mr-1" />
            To Date
          </label>
          <input
            type="date"
            value={localFilters.dateTo}
            onChange={(e) => handleDateChange('dateTo', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
        </div>

        {/* Speakers Filter */}
        <div className="space-y-2 relative">
          <label className="block text-sm font-medium text-gray-700">
            <Users className="h-4 w-4 inline mr-1" />
            Speakers ({localFilters.speakers.length})
          </label>
          <button
            onClick={() => setShowSpeakerDropdown(!showSpeakerDropdown)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-left bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          >
            {localFilters.speakers.length === 0 
              ? 'Select speakers...' 
              : `${localFilters.speakers.length} selected`
            }
          </button>
          
          {showSpeakerDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
              <div className="p-2 border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Search speakers..."
                  value={speakerSearch}
                  onChange={(e) => setSpeakerSearch(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredSpeakers.map((speaker) => (
                  <label key={speaker} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localFilters.speakers.includes(speaker)}
                      onChange={() => handleSpeakerToggle(speaker)}
                      className="mr-2"
                    />
                    <span className="text-sm truncate">{speaker}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Topics Filter */}
        <div className="space-y-2 relative">
          <label className="block text-sm font-medium text-gray-700">
            <Hash className="h-4 w-4 inline mr-1" />
            Topics ({localFilters.topics.length})
          </label>
          <button
            onClick={() => setShowTopicDropdown(!showTopicDropdown)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-left bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          >
            {localFilters.topics.length === 0 
              ? 'Select topics...' 
              : `${localFilters.topics.length} selected`
            }
          </button>
          
          {showTopicDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
              <div className="p-2 border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Search topics..."
                  value={topicSearch}
                  onChange={(e) => setTopicSearch(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredTopics.map((topic) => (
                  <label key={topic} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localFilters.topics.includes(topic)}
                      onChange={() => handleTopicToggle(topic)}
                      className="mr-2"
                    />
                    <span className="text-sm truncate">{topic}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters() && (
        <div className="mt-4 flex flex-wrap gap-2">
          {localFilters.dateFrom && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              From: {localFilters.dateFrom}
              <button
                onClick={() => handleDateChange('dateFrom', '')}
                className="ml-1 hover:text-blue-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {localFilters.dateTo && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              To: {localFilters.dateTo}
              <button
                onClick={() => handleDateChange('dateTo', '')}
                className="ml-1 hover:text-blue-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {localFilters.speakers.map((speaker) => (
            <span key={speaker} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {speaker}
              <button
                onClick={() => handleSpeakerToggle(speaker)}
                className="ml-1 hover:text-green-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {localFilters.topics.map((topic) => (
            <span key={topic} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              {topic}
              <button
                onClick={() => handleTopicToggle(topic)}
                className="ml-1 hover:text-purple-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default GlobalFilters;