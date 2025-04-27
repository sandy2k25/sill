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

// Inject into global scope for easy access
if (typeof window !== 'undefined') {
  window.__NETLIFY_ENV__ = {
    isNetlify: isNetlify(),
    apiBaseUrl: API_BASE_URL
  };
  
  // Set a flag in localStorage for persistence across page loads
  if (isNetlify()) {
    localStorage.setItem('NETLIFY_MODE', 'true');
  }
}

export default { API_BASE_URL, isNetlify };