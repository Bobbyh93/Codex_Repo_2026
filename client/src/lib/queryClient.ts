import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getCsrfToken } from "./admin-auth";

// Network error types for better error handling
export type NetworkError = {
  type: 'network' | 'server' | 'client' | 'timeout' | 'auth';
  status?: number;
  message: string;
  retryable: boolean;
};

// Enhanced error classification
function classifyError(error: Error, status?: number): NetworkError {
  // Network connectivity issues
  if (error.message.includes('fetch') || error.message.includes('NetworkError') || !navigator.onLine) {
    return {
      type: 'network',
      message: 'Connection lost. Please check your internet connection.',
      retryable: true
    };
  }

  // Server errors (5xx)
  if (status && status >= 500) {
    return {
      type: 'server',
      status,
      message: 'Server temporarily unavailable. Retrying...',
      retryable: true
    };
  }

  // Client errors (4xx)
  if (status && status >= 400 && status < 500) {
    if (status === 401) {
      return {
        type: 'auth',
        status,
        message: 'Authentication required. Please log in.',
        retryable: false
      };
    }
    if (status === 404) {
      return {
        type: 'client',
        status,
        message: 'Resource not found.',
        retryable: false
      };
    }
    return {
      type: 'client',
      status,
      message: 'Request failed. Please try again.',
      retryable: false
    };
  }

  // Default to retryable error
  return {
    type: 'network',
    message: error.message || 'Something went wrong. Retrying...',
    retryable: true
  };
}

// Exponential backoff delay calculation
function getRetryDelay(attemptIndex: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attemptIndex), maxDelay);
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
}

// Enhanced error handling for responses
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage: string;
    try {
      const text = await res.text();
      // Try to parse as JSON for structured errors
      try {
        const errorData = JSON.parse(text);
        errorMessage = errorData.error || errorData.message || text;
      } catch {
        errorMessage = text || res.statusText;
      }
    } catch {
      errorMessage = res.statusText || `HTTP ${res.status}`;
    }

    const error = new Error(errorMessage);
    (error as any).status = res.status;
    throw error;
  }
}

// Enhanced apiRequest with timeout and error classification
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options: { timeout?: number; retries?: number } = {}
): Promise<Response> {
  const { timeout = 30000, retries = 3 } = options;
  const isFormData = data instanceof FormData;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Build headers
      const headers: HeadersInit = {};
      
      // Add Content-Type for non-FormData
      // FormData needs the browser to set the boundary parameter in Content-Type
      if (data && !isFormData) {
        headers["Content-Type"] = "application/json";
      }
      
      // Add CSRF token for state-changing requests
      // This is especially important for admin routes
      if (method !== "GET" && method !== "HEAD") {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers["X-CSRF-Token"] = csrfToken;
        } else if (url.includes('/api/admin/')) {
          // Log warning for missing CSRF token on admin routes
          console.warn(`Missing CSRF token for admin route: ${method} ${url}`);
        }
      }

      const res = await fetch(url, {
        method,
        headers,
        body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
        credentials: "include",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      await throwIfResNotOk(res);
      return res;
    } catch (error: any) {
      const networkError = classifyError(error, error.status);
      
      // Don't retry if not retryable or last attempt
      if (!networkError.retryable || attempt === retries) {
        console.error(`API request failed (${method} ${url}):`, networkError.message);
        throw error;
      }

      // Wait before retrying
      const delay = getRetryDelay(attempt);
      console.warn(`API request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1}):`, networkError.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Maximum retries exceeded');
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    const url = queryKey.join("/") as string;
    
    try {
      const res = await fetch(url, {
        credentials: "include",
        signal, // Support query cancellation
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error: any) {
      // If query was cancelled, don't throw
      if (error.name === 'AbortError') {
        throw error;
      }

      const networkError = classifyError(error, error.status);
      console.error(`Query failed (${url}):`, networkError.message);
      
      // Enhance error with classification for UI handling
      (error as any).networkError = networkError;
      throw error;
    }
  };

// Retry function for queries
function shouldRetryQuery(failureCount: number, error: any): boolean {
  // Don't retry auth errors or client errors
  if (error?.networkError?.type === 'auth' || error?.networkError?.type === 'client') {
    return false;
  }
  
  // Retry network and server errors up to 3 times
  return failureCount < 3 && error?.networkError?.retryable !== false;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes stale time for caching
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection time
      retry: shouldRetryQuery,
      retryDelay: (attemptIndex) => getRetryDelay(attemptIndex),
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Only retry mutations for network/server errors
        return failureCount < 2 && 
               (error?.networkError?.type === 'network' || error?.networkError?.type === 'server');
      },
      retryDelay: (attemptIndex) => getRetryDelay(attemptIndex),
    },
  },
});

// Utility to invalidate and refetch queries with error handling
export async function safeInvalidateQueries(queryKey: string[]) {
  try {
    await queryClient.invalidateQueries({ queryKey });
  } catch (error) {
    console.warn('Failed to invalidate queries:', error);
    // Continue execution even if invalidation fails
  }
}

// Utility to check if we're offline
export function isOffline(): boolean {
  return !navigator.onLine;
}

// Utility to get user-friendly error message
export function getUserFriendlyErrorMessage(error: any): string {
  if (error?.networkError) {
    return error.networkError.message;
  }
  
  if (isOffline()) {
    return 'You appear to be offline. Please check your internet connection.';
  }
  
  return error?.message || 'Something went wrong. Please try again.';
}
