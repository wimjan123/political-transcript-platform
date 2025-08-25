import React from 'react';
import { Shield, Search, Database, Settings } from 'lucide-react';
import SearchEngineAdmin from '../components/SearchEngineAdmin';

const AdminPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Shield className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Administration Panel
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage search engines, monitor system health, and configure platform settings
              </p>
            </div>
          </div>
        </div>

        {/* Admin Sections */}
        <div className="space-y-8">
          {/* Search Engine Management */}
          <section>
            <div className="flex items-center mb-4">
              <Search className="h-6 w-6 text-gray-700 dark:text-gray-300 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Search Engine Management
              </h2>
            </div>
            <SearchEngineAdmin />
          </section>

          {/* Future Admin Sections */}
          <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 dark:bg-gray-800/70 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <Database className="h-6 w-6 text-gray-700 dark:text-gray-300 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Database Management
              </h2>
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              <p className="mb-4">Database management tools will be available here.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="font-medium mb-2">Import Management</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Monitor and control data import processes
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="font-medium mb-2">Data Cleanup</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Remove duplicate entries and optimize storage
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="font-medium mb-2">Analytics Refresh</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Regenerate sentiment and readability metrics
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 dark:bg-gray-800/70 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <Settings className="h-6 w-6 text-gray-700 dark:text-gray-300 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                System Configuration
              </h2>
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              <p className="mb-4">System-wide configuration options will be available here.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="font-medium mb-2">API Configuration</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Configure API keys, rate limits, and security settings
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="font-medium mb-2">Feature Flags</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Enable or disable platform features
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;