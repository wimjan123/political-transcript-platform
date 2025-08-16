import React from 'react';
import { Globe, Check } from 'lucide-react';

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  iso639: string;
}

interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  className?: string;
  showLabel?: boolean;
}

// Common languages for political content
export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'auto', name: 'Auto-detect', nativeName: 'Auto-detect', iso639: '' },
  { code: 'en', name: 'English', nativeName: 'English', iso639: 'eng' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', iso639: 'spa' },
  { code: 'fr', name: 'French', nativeName: 'Français', iso639: 'fra' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', iso639: 'deu' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', iso639: 'ita' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', iso639: 'por' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', iso639: 'rus' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', iso639: 'zho' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', iso639: 'jpn' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', iso639: 'ara' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', iso639: 'hin' },
];

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguage,
  onLanguageChange,
  className = '',
  showLabel = true,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedLang = SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage) || SUPPORTED_LANGUAGES[0];

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Search Language
        </label>
      )}
      
      <button
        type="button"
        className="relative w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center">
          <Globe className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
          <span className="block truncate">
            {selectedLang.nativeName}
            {selectedLang.code !== 'auto' && (
              <span className="text-gray-500 ml-1">({selectedLang.name})</span>
            )}
          </span>
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3z" clipRule="evenodd" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {SUPPORTED_LANGUAGES.map((language) => (
            <button
              key={language.code}
              type="button"
              className={`${
                selectedLanguage === language.code
                  ? 'text-blue-900 bg-blue-100'
                  : 'text-gray-900 hover:bg-gray-50'
              } cursor-pointer select-none relative py-2 pl-3 pr-9 w-full text-left`}
              onClick={() => {
                onLanguageChange(language.code);
                setIsOpen(false);
              }}
            >
              <div className="flex items-center">
                <span className={`${selectedLanguage === language.code ? 'font-semibold' : 'font-normal'} block truncate`}>
                  {language.nativeName}
                  {language.code !== 'auto' && (
                    <span className="text-gray-500 ml-1">({language.name})</span>
                  )}
                </span>
              </div>

              {selectedLanguage === language.code && (
                <span className="text-blue-600 absolute inset-y-0 right-0 flex items-center pr-4">
                  <Check className="h-5 w-5" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;