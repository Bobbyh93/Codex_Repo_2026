/**
 * Utility functions for admin authentication using session-based auth
 * Uses httpOnly cookies instead of localStorage for security
 */

// Store CSRF token in memory (not localStorage for security)
let csrfToken: string | null = null;

// Export function to get CSRF token for use in other modules
export function getCsrfToken(): string | null {
  return csrfToken;
}

// Export function to set CSRF token (for updating from responses)
export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function useAdminAuth() {
  
  const getAdminHeaders = (): HeadersInit => {
    // Build headers with CSRF token for state-changing requests
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    // Add CSRF token if available
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    
    return headers;
  };
  
  const getRequestOptions = (method: string = 'GET', body?: any): RequestInit => {
    const options: RequestInit = {
      method,
      credentials: 'include', // Always include cookies
      headers: getAdminHeaders()
    };
    
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }
    
    return options;
  };

  const isAuthenticated = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/session', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      if (data.csrfToken) {
        setCsrfToken(data.csrfToken);
      }
      return data.authenticated === true;
    } catch (error) {
      console.error('Session check failed:', error);
      return false;
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; user?: any; error?: string }> => {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Important for cookies
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }
      
      // Store CSRF token from login response
      if (data.csrfToken) {
        setCsrfToken(data.csrfToken);
      }

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error during login' };
    }
  };

  const logout = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/logout', 
        getRequestOptions('POST')
      );
      
      if (response.ok) {
        // Clear CSRF token on logout
        setCsrfToken(null);
      }
      
      return response.ok;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  };

  const getSession = async (): Promise<any> => {
    try {
      const response = await fetch('/api/admin/session', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      
      // Update CSRF token from session check
      if (data.csrfToken) {
        setCsrfToken(data.csrfToken);
      }
      
      return data.authenticated ? data.user : null;
    } catch (error) {
      console.error('Get session error:', error);
      return null;
    }
  };
  
  const makeAdminRequest = async (url: string, options?: RequestInit): Promise<Response> => {
    const defaultOptions = getRequestOptions(options?.method || 'GET', options?.body);
    return fetch(url, {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options?.headers
      },
      credentials: 'include' // Ensure this is always set
    });
  };

  return { 
    getAdminHeaders, 
    isAuthenticated, 
    login, 
    logout, 
    getSession,
    makeAdminRequest,
    getRequestOptions
  };
}
