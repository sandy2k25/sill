/**
 * Netlify-specific configuration for the client
 * This file helps determine if we're running in a Netlify environment
 * and configures the API client accordingly
 */

// Check if we're in a Netlify environment
// This can be set during build time by Netlify
export const isNetlifyEnvironment = () => {
  return (
    // Check for Netlify-specific environment variables
    typeof window !== 'undefined' && 
    (window.location.hostname.includes('netlify.app') || 
     // You can add additional checks for your custom domain if needed
     // e.g., window.location.hostname === 'yourdomain.com'
     process.env.NETLIFY === 'true' ||
     import.meta.env.VITE_NETLIFY === 'true')
  );
};

// Base URL for API - this will be different in Netlify vs local development
export const getApiBaseUrl = () => {
  if (isNetlifyEnvironment()) {
    return '/.netlify/functions/api';
  }
  return '/api'; // Default API endpoint for local development
};