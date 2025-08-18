import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Home, ArrowLeft } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 dark:bg-gray-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <Search className="mx-auto h-12 w-12 text-gray-400" />
          <h1 className="mt-6 text-6xl font-extrabold text-gray-900 dark:text-gray-100">404</h1>
          <h2 className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">Page not found</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Sorry, we couldn't find the page you're looking for.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <Link
            to="/"
            className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
          >
            <Home className="h-4 w-4 mr-2" />
            Go back home
          </Link>
          
          <Link
            to="/search"
            className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors dark:border-gray-700 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            <Search className="h-4 w-4 mr-2" />
            Search transcripts
          </Link>
          
          <button
            onClick={() => window.history.back()}
            className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors dark:border-gray-700 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go back
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            If you believe this is an error, please{' '}
            <a href="#" className="text-primary-600 hover:text-primary-500 font-medium">
              contact support
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
