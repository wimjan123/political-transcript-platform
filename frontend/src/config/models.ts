import type { ModelOption, AIProvider } from '../types';

export const AVAILABLE_MODELS: ModelOption[] = [
  // OpenAI Models
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextLength: 128000,
    description: 'Latest GPT-4 Omni model with improved capabilities'
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextLength: 128000,
    description: 'Faster, cost-effective version of GPT-4o'
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    contextLength: 128000,
    description: 'Enhanced GPT-4 with improved performance'
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'openai',
    contextLength: 8192,
    description: 'OpenAI\'s most capable model'
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    contextLength: 4096,
    description: 'Fast and cost-effective for most tasks'
  },

  // OpenRouter Models
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    contextLength: 200000,
    description: 'Anthropic\'s latest and most capable model'
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'openrouter',
    contextLength: 200000,
    description: 'Fast and efficient Claude model'
  },
  {
    id: 'meta-llama/llama-3.1-405b-instruct',
    name: 'Llama 3.1 405B',
    provider: 'openrouter',
    contextLength: 131072,
    description: 'Meta\'s largest and most capable open-source model'
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B',
    provider: 'openrouter',
    contextLength: 131072,
    description: 'High-performance open-source model'
  },
  {
    id: 'google/gemini-pro-1.5',
    name: 'Gemini Pro 1.5',
    provider: 'openrouter',
    contextLength: 2097152,
    description: 'Google\'s advanced model with huge context window'
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (via OpenRouter)',
    provider: 'openrouter',
    contextLength: 128000,
    description: 'GPT-4o accessed through OpenRouter'
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini (via OpenRouter)',
    provider: 'openrouter',
    contextLength: 128000,
    description: 'GPT-4o Mini accessed through OpenRouter'
  },
  {
    id: 'mistralai/mistral-large',
    name: 'Mistral Large',
    provider: 'openrouter',
    contextLength: 32768,
    description: 'Mistral\'s most capable model'
  },
  {
    id: 'cohere/command-r-plus',
    name: 'Command R+',
    provider: 'openrouter',
    contextLength: 128000,
    description: 'Cohere\'s flagship model for complex tasks'
  },

  // Custom model option for OpenRouter
  {
    id: 'custom',
    name: 'Custom Model (Manual Entry)',
    provider: 'openrouter',
    description: 'Enter any OpenRouter model ID manually'
  }
];

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4o-mini',
  openrouter: 'anthropic/claude-3.5-sonnet'
};

export const getModelsByProvider = (provider: AIProvider): ModelOption[] => {
  return AVAILABLE_MODELS.filter(model => model.provider === provider);
};

export const getModelById = (id: string): ModelOption | undefined => {
  return AVAILABLE_MODELS.find(model => model.id === id);
};

export const PROVIDER_INFO: Record<AIProvider, {
  name: string;
  baseUrl: string;
  description: string;
  website: string;
}> = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    description: 'Direct access to OpenAI models',
    website: 'https://platform.openai.com'
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api',
    description: 'Access to multiple LLM providers through one API',
    website: 'https://openrouter.ai'
  }
};