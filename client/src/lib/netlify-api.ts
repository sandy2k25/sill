/**
 * Netlify API utility
 * 
 * This file provides utility functions for making API calls when running on Netlify
 */

// Helper to determine if we're running on Netlify
export const isNetlify = (): boolean => {
  return !!import.meta.env.VITE_NETLIFY_DEPLOY || 
    window.location.hostname.includes('.netlify.app') ||
    localStorage.getItem('NETLIFY_MODE') === 'true';
};

// Base URL for API calls
export const getApiBaseUrl = (): string => {
  if (isNetlify()) {
    // Use Netlify Functions when deployed to Netlify
    return '/.netlify/functions/api';
  }
  
  // Use regular API path for local development
  return '/api';
};

// Helper for making API requests that works in both environments
export const apiRequest = async (
  path: string, 
  options: RequestInit = {}
): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  
  // Make the fetch request
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  // Parse the JSON response
  try {
    const data = await response.json();
    
    // If the response is not ok, throw an error
    if (!response.ok) {
      throw new Error(data.error || 'An unknown error occurred');
    }
    
    return data;
  } catch (error) {
    // If the response is not JSON or there's an error parsing it
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    throw error;
  }
};

// Export default for convenience
export default { isNetlify, getApiBaseUrl, apiRequest };