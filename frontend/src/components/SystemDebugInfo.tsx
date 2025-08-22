import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

interface SystemInfo {
  downloads_dir_exists: boolean;
  downloads_dir_readable: boolean;
  downloads_dir_contents_count: number;
  current_working_directory: string;
  environment_variables: Record<string, string>;
}

export const SystemDebugInfo: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadSystemInfo();
  }, []);

  const loadSystemInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First, test basic API connectivity
      const pingResponse = await fetch('/api/debug/ping');
      if (!pingResponse.ok) {
        throw new Error(`API not responding: ${pingResponse.status} ${pingResponse.statusText}`);
      }
      
      // Then get system info
      const infoResponse = await fetch('/api/debug/system-info');
      if (!infoResponse.ok) {
        throw new Error(`Failed to get system info: ${infoResponse.status} ${infoResponse.statusText}`);
      }
      
      const data = await infoResponse.json();
      setSystemInfo(data);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load system info';
      setError(errorMessage);
      console.error('Error loading system info:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <Info className="w-5 h-5 text-blue-600 mr-2" />
          <p className="text-blue-800">Loading system information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <XCircle className="w-5 h-5 text-red-600 mr-2" />
            <p className="text-red-800 font-medium">API Connection Error</p>
          </div>
          <button
            onClick={loadSystemInfo}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
        <p className="text-red-700 text-sm mt-2">{error}</p>
        <div className="mt-3 text-sm text-red-700">
          <p className="font-medium">Troubleshooting steps:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Ensure the backend API is running on port 8000</li>
            <li>Check that the Docker containers are up: <code className="bg-red-100 px-1 rounded">docker-compose ps</code></li>
            <li>Verify the Downloads directory is mounted correctly</li>
            <li>Check browser developer tools for network errors</li>
          </ul>
        </div>
      </div>
    );
  }

  if (!systemInfo) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
          <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
          System Status
        </h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className={`flex items-center p-3 rounded-lg ${
          systemInfo.downloads_dir_exists 
            ? 'bg-green-50 text-green-800' 
            : 'bg-red-50 text-red-800'
        }`}>
          {systemInfo.downloads_dir_exists ? (
            <CheckCircle className="w-4 h-4 mr-2" />
          ) : (
            <XCircle className="w-4 h-4 mr-2" />
          )}
          <div>
            <p className="font-medium text-sm">Downloads Directory</p>
            <p className="text-xs">{systemInfo.downloads_dir_exists ? 'Exists' : 'Not Found'}</p>
          </div>
        </div>

        <div className={`flex items-center p-3 rounded-lg ${
          systemInfo.downloads_dir_readable 
            ? 'bg-green-50 text-green-800' 
            : 'bg-red-50 text-red-800'
        }`}>
          {systemInfo.downloads_dir_readable ? (
            <CheckCircle className="w-4 h-4 mr-2" />
          ) : (
            <XCircle className="w-4 h-4 mr-2" />
          )}
          <div>
            <p className="font-medium text-sm">Directory Access</p>
            <p className="text-xs">{systemInfo.downloads_dir_readable ? 'Readable' : 'Access Denied'}</p>
          </div>
        </div>

        <div className="flex items-center p-3 rounded-lg bg-blue-50 text-blue-800">
          <Info className="w-4 h-4 mr-2" />
          <div>
            <p className="font-medium text-sm">Contents</p>
            <p className="text-xs">{systemInfo.downloads_dir_contents_count} items</p>
          </div>
        </div>
      </div>

      {/* Detailed Information */}
      {showDetails && (
        <div className="border-t pt-4 space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Working Directory</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-700 p-2 rounded">
              {systemInfo.current_working_directory}
            </p>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Environment Variables</h4>
            <div className="space-y-2">
              {Object.entries(systemInfo.environment_variables).map(([key, value]) => (
                <div key={key} className="flex flex-col sm:flex-row sm:items-center">
                  <span className="font-mono text-sm text-gray-700 dark:text-gray-300 sm:w-48">
                    {key}:
                  </span>
                  <span className="font-mono text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-1 rounded break-all">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={loadSystemInfo}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemDebugInfo;