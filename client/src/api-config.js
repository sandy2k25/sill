/**
 * API Configuration for Cloudflare Workers deployment
 * 
 * This file handles API communication with the Cloudflare Workers backend.
 * It includes functions for making authenticated requests and handling common operations.
 */

/**
 * Get the API base URL from environment or use a default for local development
 */
export const API_BASE_URL = 
  window.ENV && window.ENV.API_URL 
    ? window.ENV.API_URL 
    : '/api'; // When running locally, rely on proxy

/**
 * Store the auth token in localStorage
 */
export function saveToken(token) {
  localStorage.setItem('woviex_token', token);
}

/**
 * Get the auth token from localStorage
 */
export function getToken() {
  return localStorage.getItem('woviex_token');
}

/**
 * Remove the auth token from localStorage (logout)
 */
export function removeToken() {
  localStorage.removeItem('woviex_token');
}

/**
 * Check if the user is authenticated
 */
export function isAuthenticated() {
  return !!getToken();
}

/**
 * Base fetch function for API requests
 * 
 * @param {string} endpoint - API endpoint to fetch from
 * @param {object} options - Fetch options 
 * @returns {Promise<any>} Response data
 */
export async function fetchApi(endpoint, options = {}) {
  // Construct full URL
  const url = endpoint.startsWith('/')
    ? `${API_BASE_URL}${endpoint}`
    : `${API_BASE_URL}/${endpoint}`;
  
  // Set headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Add authentication token if it exists
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Make the request
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // Handle errors
  if (!response.ok) {
    const error = new Error(`API request failed with status ${response.status}`);
    try {
      error.data = await response.json();
    } catch (e) {
      error.data = null;
    }
    throw error;
  }
  
  // Parse and return the response
  return response.json();
}

/**
 * Login with username and password
 * 
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise<{token: string, user: object}>}
 */
export async function login(username, password) {
  const response = await fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  
  if (response.success && response.token) {
    saveToken(response.token);
  }
  
  return response;
}

/**
 * Logout - remove token
 */
export function logout() {
  removeToken();
}

/**
 * Verify authentication token
 * 
 * @returns {Promise<{authenticated: boolean}>}
 */
export async function verifyAuth() {
  if (!getToken()) {
    return { authenticated: false };
  }
  
  try {
    return await fetchApi('/auth/verify');
  } catch (error) {
    removeToken(); // Clear invalid token
    return { authenticated: false };
  }
}

/**
 * Get recent videos
 * 
 * @param {number} limit - Number of videos to fetch
 * @returns {Promise<Array>} List of videos
 */
export async function getVideos(limit = 10) {
  const response = await fetchApi(`/videos?limit=${limit}`);
  return response.videos || [];
}

/**
 * Get specific video by ID
 * 
 * @param {string} videoId - ID of the video to fetch
 * @returns {Promise<object>} Video data
 */
export async function getVideo(videoId) {
  const response = await fetchApi(`/videos/${videoId}`);
  return response.video;
}

/**
 * Get all domains
 * 
 * @returns {Promise<Array>} List of domains
 */
export async function getDomains() {
  const response = await fetchApi('/domains');
  return response.domains || [];
}

/**
 * Add a new domain
 * 
 * @param {string} domain - Domain name to add
 * @returns {Promise<object>} Created domain
 */
export async function addDomain(domain) {
  const response = await fetchApi('/domains', {
    method: 'POST',
    body: JSON.stringify({ domain, active: true }),
  });
  return response;
}

/**
 * Toggle domain status
 * 
 * @param {number} id - Domain ID
 * @returns {Promise<object>} Updated domain
 */
export async function toggleDomain(id) {
  const response = await fetchApi(`/domains/${id}/toggle`, {
    method: 'PUT',
  });
  return response;
}

/**
 * Delete a domain
 * 
 * @param {number} id - Domain ID
 * @returns {Promise<object>} Result of deletion
 */
export async function deleteDomain(id) {
  const response = await fetchApi(`/domains/${id}`, {
    method: 'DELETE',
  });
  return response;
}

/**
 * Get system logs
 * 
 * @param {number} limit - Number of logs to fetch
 * @param {number} offset - Offset for pagination
 * @param {string} level - Optional log level filter
 * @returns {Promise<{logs: Array, total: number}>} Logs and total count
 */
export async function getLogs(limit = 50, offset = 0, level = null) {
  let url = `/logs?limit=${limit}&offset=${offset}`;
  if (level) {
    url += `&level=${level}`;
  }
  
  const response = await fetchApi(url);
  return response;
}

/**
 * Clear all logs
 * 
 * @returns {Promise<object>} Result of operation
 */
export async function clearLogs() {
  const response = await fetchApi('/logs', {
    method: 'DELETE',
  });
  return response;
}

/**
 * Get scraper settings
 * 
 * @returns {Promise<object>} Scraper settings
 */
export async function getScraperSettings() {
  const response = await fetchApi('/scraper/settings');
  return response.settings;
}

/**
 * Update scraper settings
 * 
 * @param {object} settings - New settings
 * @returns {Promise<object>} Updated settings
 */
export async function updateScraperSettings(settings) {
  const response = await fetchApi('/scraper/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
  return response;
}