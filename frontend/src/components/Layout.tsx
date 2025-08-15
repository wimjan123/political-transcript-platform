import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Search, BarChart3, Video, Database, Upload, Menu, X } from 'lucide-react';

const Layout: React.FC = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navigation = [
    { name: 'Search', href: '/search', icon: Search },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Videos', href: '/videos', icon: Video },
    { name: 'Ingest', href: '/ingest', icon: Upload },
    { name: 'Database', href: '/database-status', icon: Database },
  ];

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Logo */}
              <Link to="/" className="flex items-center px-4">
                <div className="flex-shrink-0 flex items-center">
                  <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                    <Search className="h-5 w-5 text-white" />
                  </div>
                  <span className="ml-2 text-xl font-semibold text-gray-900 hidden sm:block">
                    Political Transcript Search
                  </span>
                  <span className="ml-2 text-xl font-semibold text-gray-900 sm:hidden">
                    PTS
                  </span>
                </div>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:ml-6 md:flex md:space-x-8">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors ${
                        isActive(item.href)
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
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
          <div className="md:hidden">
            <div className="pt-2 pb-3 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block pl-3 pr-4 py-2 text-base font-medium border-l-4 transition-colors ${
                      isActive(item.href)
                        ? 'border-primary-500 text-primary-700 bg-primary-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center">
                      <Icon className="h-5 w-5 mr-3" />
                      {item.name}
                    </div>
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
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              © 2024 Political Transcript Search Platform
            </div>
            <div className="flex space-x-6 text-sm text-gray-500">
              <a href="#" className="hover:text-gray-900 transition-colors">
                About
              </a>
              <a href="#" className="hover:text-gray-900 transition-colors">
                API Docs
              </a>
              <a href="#" className="hover:text-gray-900 transition-colors">
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