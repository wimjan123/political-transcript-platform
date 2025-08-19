import { QueryClient } from '@tanstack/react-query';

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered stale after 5 minutes
      staleTime: 5 * 60 * 1000,
      // Cache data for 10 minutes
      gcTime: 10 * 60 * 1000, 
      // Retry failed requests 1 time (reduced from default 3 for faster UX)
      retry: 1,
      // Disable automatic refetch on window focus for better UX
      refetchOnWindowFocus: false,
      // Keep previous data while fetching new data (for smooth transitions)
      placeholderData: (previousData: any) => previousData,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});