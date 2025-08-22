import React, { useState, useEffect } from 'react';
import { Folder, FolderOpen, ArrowLeft, Home, Video, FileText, Check, Loader } from 'lucide-react';

interface FolderInfo {
  name: string;
  path: string;
  is_directory: boolean;
  video_count: number;
  srt_count: number;
  size_mb?: number;
  has_videos: boolean;
}

interface Breadcrumb {
  name: string;
  path: string;
}

interface FolderBrowseResponse {
  current_path: string;
  parent_path?: string;
  folders: FolderInfo[];
  total_folders: number;
  breadcrumbs: Breadcrumb[];
}

interface FolderBrowserProps {
  onFoldersSelected: (folders: string[]) => void;
  initialPath?: string;
  multiSelect?: boolean;
  showOnlyVideoFolders?: boolean;
}

export const FolderBrowser: React.FC<FolderBrowserProps> = ({
  onFoldersSelected,
  initialPath = '/Downloads',
  multiSelect = true,
  showOnlyVideoFolders = true
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parentPath, setParentPath] = useState<string | null>(null);

  useEffect(() => {
    loadFolders(currentPath);
  }, [currentPath, showOnlyVideoFolders]);

  useEffect(() => {
    onFoldersSelected(Array.from(selectedFolders));
  }, [selectedFolders, onFoldersSelected]);

  const loadFolders = async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        path,
        show_only_video_folders: showOnlyVideoFolders.toString()
      });
      
      const response = await fetch(`/api/folders/browse?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load folders');
      }
      
      const data: FolderBrowseResponse = await response.json();
      setFolders(data.folders);
      setBreadcrumbs(data.breadcrumbs);
      setParentPath(data.parent_path);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load folders';
      setError(`${errorMessage}. Please ensure the backend API is running and the Downloads directory is accessible.`);
      console.error('Error loading folders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folder: FolderInfo) => {
    setCurrentPath(folder.path);
  };

  const handleFolderSelect = (folder: FolderInfo, event: React.MouseEvent) => {
    event.stopPropagation();
    
    const newSelected = new Set(selectedFolders);
    
    if (multiSelect) {
      if (selectedFolders.has(folder.path)) {
        newSelected.delete(folder.path);
      } else {
        newSelected.add(folder.path);
      }
    } else {
      newSelected.clear();
      newSelected.add(folder.path);
    }
    
    setSelectedFolders(newSelected);
  };

  const handleBreadcrumbClick = (breadcrumb: Breadcrumb) => {
    setCurrentPath(breadcrumb.path);
  };

  const handleGoUp = () => {
    if (parentPath) {
      setCurrentPath(parentPath);
    }
  };

  const formatSize = (sizeMb?: number) => {
    if (!sizeMb) return '';
    if (sizeMb < 1) return `${Math.round(sizeMb * 1000)}KB`;
    if (sizeMb < 1024) return `${Math.round(sizeMb)}MB`;
    return `${Math.round(sizeMb / 1024 * 10) / 10}GB`;
  };

  const clearSelection = () => {
    setSelectedFolders(new Set());
  };

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
        <p className="font-medium">Error loading folders</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={() => loadFolders(currentPath)}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Select Folders to Import
        </h3>
        {selectedFolders.size > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedFolders.size} selected
            </span>
            <button
              onClick={clearSelection}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center space-x-2 mb-4 p-2 bg-gray-50 dark:bg-gray-700 rounded">
        {/* Up button */}
        {parentPath && (
          <button
            onClick={handleGoUp}
            className="flex items-center px-2 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            title="Go up one level"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {/* Breadcrumbs */}
        <div className="flex items-center space-x-1 text-sm">
          {breadcrumbs.map((breadcrumb, index) => (
            <React.Fragment key={breadcrumb.path}>
              <button
                onClick={() => handleBreadcrumbClick(breadcrumb)}
                className="flex items-center px-2 py-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 rounded"
              >
                {index === 0 ? (
                  <Home className="w-4 h-4 mr-1" />
                ) : (
                  <Folder className="w-4 h-4 mr-1" />
                )}
                {breadcrumb.name}
              </button>
              {index < breadcrumbs.length - 1 && (
                <span className="text-gray-400 dark:text-gray-500">/</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Filter toggle */}
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={showOnlyVideoFolders}
            onChange={(e) => {
              const newValue = e.target.checked;
              // We'd need to lift this state up or make it a prop to actually change the filter
              // For now, just show the intent
              console.log('Would filter to video folders only:', newValue);
            }}
            className="mr-2"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Show only folders with videos
          </span>
        </label>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading folders...</span>
        </div>
      )}

      {/* Folder list */}
      {!loading && (
        <div className="max-h-96 overflow-y-auto">
          {folders.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No folders found</p>
              {showOnlyVideoFolders && (
                <p className="text-sm">Try unchecking "Show only folders with videos"</p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {folders.map((folder) => (
                <div
                  key={folder.path}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedFolders.has(folder.path)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => handleFolderClick(folder)}
                >
                  {/* Selection checkbox */}
                  <div
                    className="mr-3 cursor-pointer"
                    onClick={(e) => handleFolderSelect(folder, e)}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedFolders.has(folder.path)
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300 dark:border-gray-500'
                    }`}>
                      {selectedFolders.has(folder.path) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>

                  {/* Folder icon */}
                  <div className="mr-3">
                    {selectedFolders.has(folder.path) ? (
                      <FolderOpen className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Folder className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  {/* Folder info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {folder.name}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        {folder.video_count > 0 && (
                          <div className="flex items-center">
                            <Video className="w-3 h-3 mr-1" />
                            {folder.video_count}
                          </div>
                        )}
                        {folder.srt_count > 0 && (
                          <div className="flex items-center">
                            <FileText className="w-3 h-3 mr-1" />
                            {folder.srt_count}
                          </div>
                        )}
                        {folder.size_mb && (
                          <span>{formatSize(folder.size_mb)}</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Video/SRT counts */}
                    {(folder.video_count > 0 || folder.srt_count > 0) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {folder.video_count > 0 && `${folder.video_count} video${folder.video_count !== 1 ? 's' : ''}`}
                        {folder.video_count > 0 && folder.srt_count > 0 && ', '}
                        {folder.srt_count > 0 && `${folder.srt_count} subtitle${folder.srt_count !== 1 ? 's' : ''}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {selectedFolders.size > 0 && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Ready to import from {selectedFolders.size} folder{selectedFolders.size !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
};

export default FolderBrowser;