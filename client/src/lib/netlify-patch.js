/**
 * Netlify environment patch
 * 
 * This file modifies the client code to work properly in a Netlify Functions environment
 */

// Modify API base path for Netlify
export const API_BASE_URL = typeof window !== 'undefined' && 
  (window.location.hostname.includes('.netlify.app') || 
   localStorage.getItem('NETLIFY_MODE') === 'true')
  ? '/.netlify/functions/api'
  : '/api';

// Helper to check if we're running in Netlify
export const isNetlify = () => {
  if (typeof window === 'undefined') return false;
  
  return window.location.hostname.includes('.netlify.app') ||
         localStorage.getItem('NETLIFY_MODE') === 'true' ||
         process.env.VITE_NETLIFY_DEPLOY === 'true';
};

// Create a fetch wrapper that adds Netlify-specific handling
export const netlifyFetch = async (endpoint, options = {}) => {
  // Handle root API
  const url = endpoint.startsWith('/') 
    ? `${API_BASE_URL}${endpoint}`
    : `${API_BASE_URL}/${endpoint}`;
  
  // Add default headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // Make the request
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  // Check for successful response
  if (!response.ok) {
    const error = new Error(`API error: ${response.status}`);
    error.status = response.status;
    try {
      error.data = await response.json();
    } catch (e) {
      error.data = { message: 'Failed to parse error response' };
    }
    throw error;
  }
  
  // Parse successful response
  const data = await response.json();
  return data;
};

// Inject into global scope for easy access
if (typeof window !== 'undefined') {
  window.__NETLIFY_ENV__ = {
    isNetlify: isNetlify(),
    apiBaseUrl: API_BASE_URL,
    fetch: netlifyFetch
  };
  
  // Set a flag in localStorage for persistence across page loads
  if (isNetlify()) {
    localStorage.setItem('NETLIFY_MODE', 'true');
  }
  
  console.log(`Running in ${isNetlify() ? 'Netlify' : 'Development'} environment`);
  console.log(`API Base URL: ${API_BASE_URL}`);
}

export default { API_BASE_URL, isNetlify, netlifyFetch };