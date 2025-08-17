import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Search, BarChart3, Video, Database, Upload, Menu, X, ListMusic, Settings, Bot, ChevronDown, Shield, FileText } from 'lucide-react';
import { playlist, usePlaylistCount } from '../services/playlist';

const Layout: React.FC = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = React.useState(false);
  const adminDropdownRef = React.useRef<HTMLDivElement>(null);

  const navigation = [
    { name: 'Search', href: '/search', icon: Search },
    { name: 'Summaries', href: '/summaries', icon: FileText },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Videos', href: '/videos', icon: Video },
    { name: 'Ingest', href: '/ingest', icon: Upload },
    { name: 'Playlist', href: '/playlist', icon: ListMusic },
  ];

  const adminItems = [
    { name: 'AI Settings', href: '/ai-settings', icon: Bot },
    { name: 'Database', href: '/database-status', icon: Database },
    { name: 'Meilisearch', href: '/meilisearch-admin', icon: Settings },
  ];

  const playlistCount = usePlaylistCount();

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const isAdminActive = () => {
    return adminItems.some(item => isActive(item.href));
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
        setIsAdminDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md shadow-lg border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Logo */}
              <Link to="/" className="flex items-center px-4 group">
                <div className="flex-shrink-0 flex items-center">
                  <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center group-hover:shadow-lg transition-all duration-300">
                    <Search className="h-5 w-5 text-white" />
                  </div>
                  <span className="ml-3 text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent hidden sm:block">
                    Political Transcript Search
                  </span>
                  <span className="ml-3 text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent sm:hidden">
                    PTS
                  </span>
                </div>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:ml-6 md:flex md:space-x-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive(item.href)
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 hover:shadow-sm'
                      }`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.name}
                      {item.name === 'Playlist' && playlistCount > 0 && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
                          {playlistCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
                
                {/* Admin Dropdown */}
                <div className="relative" ref={adminDropdownRef}>
                  <button
                    onClick={() => setIsAdminDropdownOpen(!isAdminDropdownOpen)}
                    className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isAdminActive()
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 hover:shadow-sm'
                    }`}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Admin
                    <ChevronDown className={`h-4 w-4 ml-1 transition-transform duration-200 ${
                      isAdminDropdownOpen ? 'rotate-180' : ''
                    }`} />
                  </button>
                  
                  {/* Dropdown Menu */}
                  {isAdminDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200/50 py-1 z-50">
                      {adminItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            onClick={() => setIsAdminDropdownOpen(false)}
                            className={`flex items-center px-4 py-2 text-sm transition-colors duration-200 ${
                              isActive(item.href)
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <Icon className="h-4 w-4 mr-3" />
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-all duration-200"
              >
                <span className="sr-only">Open main menu</span>
                {isMobileMenuOpen ? (
                  <X className="block h-6 w-6" />
                ) : (
                  <Menu className="block h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-gray-200/50">
            <div className="pt-2 pb-3 space-y-1 px-3">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center px-3 py-3 rounded-lg text-base font-medium transition-all duration-200 ${
                      isActive(item.href)
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 hover:shadow-sm'
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    {item.name}
                    {item.name === 'Playlist' && playlistCount > 0 && (
                      <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        isActive(item.href) ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {playlistCount}
                      </span>
                    )}
                  </Link>
                );
              })}
              
              {/* Admin Section Header */}
              <div className="pt-2 pb-1">
                <div className="flex items-center px-3 py-2">
                  <Shield className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Admin</span>
                </div>
              </div>
              
              {/* Admin Items */}
              {adminItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive(item.href)
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 hover:shadow-sm'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-3" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-gray-900 to-gray-800 border-t border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <div className="text-sm text-gray-400">
              © 2024 Political Transcript Search Platform
            </div>
            <div className="flex space-x-6 text-sm text-gray-400">
              <a href="#" className="hover:text-white transition-colors duration-200">
                About
              </a>
              <a href="#" className="hover:text-white transition-colors duration-200">
                API Docs
              </a>
              <a href="#" className="hover:text-white transition-colors duration-200">
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
