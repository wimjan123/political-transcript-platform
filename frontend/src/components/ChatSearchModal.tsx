import React from 'react';
import { X } from 'lucide-react';
import ConversationalSearch from './ConversationalSearch';

interface ChatSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChatSearchModal: React.FC<ChatSearchModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] overflow-hidden dark:bg-gray-800">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 transition-colors bg-white rounded-full p-1 shadow-sm dark:bg-gray-700 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
          
          {/* Chat component */}
          <ConversationalSearch className="h-full" />
        </div>
      </div>
    </div>
  );
};

export default ChatSearchModal;
