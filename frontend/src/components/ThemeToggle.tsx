import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import useTheme from '../hooks/useTheme';

const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const options: { key: 'light' | 'dark' | 'system'; label: string; icon: React.ReactNode }[] = [
    { key: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { key: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { key: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden dark:bg-gray-800 dark:border-gray-700">
      {options.map((opt, idx) => (
        <button
          key={opt.key}
          onClick={() => setTheme(opt.key)}
          className={
            `flex items-center gap-1 px-3 py-2 text-sm transition-colors ` +
            (theme === opt.key
              ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
              : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700')
          }
          title={`${opt.label} theme`}
          aria-label={`${opt.label} theme`}
        >
          {opt.icon}
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ThemeToggle;

