import React, { useState, useEffect } from 'react';
import { Settings, Folder, Check, X, AlertCircle, Save, RefreshCw } from 'lucide-react';

interface VideoLibrarySettings {
  video_directory: string;
  transcoded_directory?: string;
  supported_formats: string[];
  auto_transcode: boolean;
}

interface Directory {
  path: string;
  accessible: boolean;
  item_count: number;
  status: string;
}

interface SettingsData {
  video_library: VideoLibrarySettings;
  available_directories: string[];
}

const VideoSettings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedDirectory, setSelectedDirectory] = useState<string>('');

  useEffect(() => {
    loadSettings();
    loadDirectories();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      const data = await response.json();
      setSettings(data);
      setSelectedDirectory(data.video_library.video_directory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    }
  };

  const loadDirectories = async () => {
    try {
      const response = await fetch('/api/settings/directories');
      if (!response.ok) {
        throw new Error('Failed to load directories');
      }
      const data = await response.json();
      setDirectories(data.directories);
    } catch (err) {
      console.error('Error loading directories:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!selectedDirectory) {
      setError('Please select a directory');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/settings/video-library', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_directory: selectedDirectory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save settings');
      }

      const updatedSettings = await response.json();
      setSettings(prev => prev ? { ...prev, video_library: updatedSettings } : null);
      setSuccess('Settings saved successfully! The new directory will be used for imports.');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading settings...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
            <Settings className="w-8 h-8 mr-3" />
            Video Library Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure your video library directory and import settings
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <X className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-600 mr-2" />
              <p className="text-green-800">{success}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Current Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Current Configuration
            </h2>
            
            {settings && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Video Directory
                  </label>
                  <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg font-mono text-sm">
                    {settings.video_library.video_directory}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Transcoded Directory
                  </label>
                  <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg font-mono text-sm">
                    {settings.video_library.transcoded_directory || 'Not set'}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Supported Formats
                  </label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {settings.video_library.supported_formats.map((format) => (
                      <span
                        key={format}
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
                      >
                        {format}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Directory Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Select Video Directory
            </h2>

            <div className="space-y-3 mb-6">
              {settings?.available_directories.map((directory) => (
                <div
                  key={directory}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedDirectory === directory
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                  onClick={() => setSelectedDirectory(directory)}
                >
                  <input
                    type="radio"
                    name="directory"
                    value={directory}
                    checked={selectedDirectory === directory}
                    onChange={(e) => setSelectedDirectory(e.target.value)}
                    className="mr-3"
                  />
                  <Folder className="w-5 h-5 text-gray-400 mr-2" />
                  <div className="flex-1">
                    <p className="font-mono text-sm text-gray-900 dark:text-gray-100">
                      {directory.split(' ')[0]}
                    </p>
                    {directory.includes('(') && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {directory.split('(')[1].replace(')', '')}
                      </p>
                    )}
                  </div>
                  {selectedDirectory === directory && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              ))}
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={saveSettings}
                disabled={saving || !selectedDirectory || selectedDirectory === settings?.video_library.video_directory}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>

        {/* Available Directories Detail */}
        {directories.length > 0 && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Directory Information
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Path
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Accessible
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                  {directories.map((dir) => (
                    <tr key={dir.path}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-gray-900 dark:text-gray-100">
                          {dir.path}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {dir.status}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {dir.item_count}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {dir.accessible ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <X className="w-5 h-5 text-red-600" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Important Note */}
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
            <div className="text-yellow-800">
              <p className="font-medium">Important Notes:</p>
              <ul className="mt-2 text-sm list-disc list-inside space-y-1">
                <li>Directory changes take effect immediately for new imports</li>
                <li>The <code className="bg-yellow-100 px-1 rounded">/Downloads</code> directory is mounted from your BunkrDownloader folder</li>
                <li>For persistent changes across container restarts, update the <code className="bg-yellow-100 px-1 rounded">VIDEO_LIBRARY_DIR</code> environment variable</li>
                <li>Make sure the selected directory is accessible and contains your video files</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoSettings;