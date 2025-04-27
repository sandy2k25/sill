/**
 * Cloudflare Worker for WovIeX API
 * This adapts the Express routes to Cloudflare Workers
 */

// Import jsonwebtoken equivalent (for Cloudflare Workers environment)
import { verify, sign } from './jwt-worker.js';

// In-memory storage (for dev/demo only - use D1 or KV for production)
let storage = {
  users: [{ id: 1, username: 'admin', role: 'admin' }],
  videos: [],
  domains: [
    { id: 1, domain: 'example.com', active: true },
    { id: 2, domain: 'test.com', active: true },
    { id: 3, domain: 'woviex.com', active: true }
  ],
  logs: []
};

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// Handle OPTIONS requests for CORS
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

// Parse request details
function parseRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const query = Object.fromEntries(url.searchParams);
  return { url, path, method, query };
}

// Extract JWT token from request header
function getToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// Verify authentication
async function isAuthenticated(request, env) {
  const token = getToken(request);
  if (!token) {
    return false;
  }
  
  try {
    const decoded = await verify(token, env.JWT_SECRET);
    return !!decoded;
  } catch (error) {
    return false;
  }
}

// Routes for the API
async function handleApiRequest(request, env, ctx) {
  const { path, method, query } = parseRequest(request);
  
  // Response headers
  const headers = {
    'Content-Type': 'application/json',
    ...corsHeaders
  };

  // Parse request body for POST/PUT requests
  let body = null;
  if (method === 'POST' || method === 'PUT') {
    try {
      body = await request.json();
    } catch (e) {
      body = null;
    }
  }

  // Public API Routes
  
  // API Status endpoint
  if (path === '/api/status' || path === '/api') {
    return new Response(JSON.stringify({
      status: 'online',
      message: 'WovIeX API is running on Cloudflare Workers',
      timestamp: new Date().toISOString(),
      environment: 'cloudflare'
    }), { headers });
  }
  
  // Authentication endpoints
  if (path.startsWith('/api/auth')) {
    // Login
    if (path === '/api/auth/login' && method === 'POST') {
      const { username, password } = body || {};
      
      // Check credentials
      if (username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD) {
        // Generate JWT token
        const token = await sign(
          { username, role: 'admin' },
          env.JWT_SECRET,
          { expiresIn: '7d' }
        );
        
        return new Response(JSON.stringify({
          success: true,
          token,
          user: { username, role: 'admin' }
        }), { headers });
      } else {
        return new Response(JSON.stringify({
          success: false,
          message: 'Invalid credentials'
        }), { status: 401, headers });
      }
    }
    
    // Verify token
    if (path === '/api/auth/verify' && method === 'GET') {
      const isAuth = await isAuthenticated(request, env);
      if (isAuth) {
        return new Response(JSON.stringify({
          authenticated: true
        }), { headers });
      }
      
      return new Response(JSON.stringify({
        authenticated: false
      }), { status: 401, headers });
    }
  }
  
  // Videos endpoints - public access
  if (path.startsWith('/api/videos')) {
    // Get video by ID
    if (method === 'GET' && path.match(/^\/api\/videos\/[^\/]+$/)) {
      const videoId = path.split('/').pop();
      const video = storage.videos.find(v => v.videoId === videoId);
      
      if (video) {
        return new Response(JSON.stringify({ video }), { headers });
      }
      
      return new Response(JSON.stringify({
        error: 'Video not found'
      }), { status: 404, headers });
    }
    
    // Get recent videos
    if (method === 'GET' && path === '/api/videos') {
      const limit = parseInt(query.limit) || 10;
      const videos = storage.videos.slice(0, limit);
      return new Response(JSON.stringify({ videos }), { headers });
    }
  }
  
  // Protected routes - require authentication
  const authenticated = await isAuthenticated(request, env);
  if (!authenticated) {
    return new Response(JSON.stringify({
      error: 'Unauthorized'
    }), { status: 401, headers });
  }
  
  // Admin Videos endpoints
  if (path.startsWith('/api/admin/videos')) {
    // Add video
    if (method === 'POST' && path === '/api/admin/videos' && body) {
      const newId = storage.videos.length + 1;
      const newVideo = {
        id: newId,
        ...body,
        createdAt: new Date().toISOString(),
        accessCount: 0
      };
      
      storage.videos.push(newVideo);
      
      return new Response(JSON.stringify({
        success: true,
        video: newVideo
      }), { headers });
    }
    
    // Update video
    if (method === 'PUT' && path.match(/^\/api\/admin\/videos\/\d+$/)) {
      const videoId = parseInt(path.split('/').pop());
      const index = storage.videos.findIndex(v => v.id === videoId);
      
      if (index !== -1) {
        storage.videos[index] = {
          ...storage.videos[index],
          ...body,
          updatedAt: new Date().toISOString()
        };
        
        return new Response(JSON.stringify({
          success: true,
          video: storage.videos[index]
        }), { headers });
      }
      
      return new Response(JSON.stringify({
        error: 'Video not found'
      }), { status: 404, headers });
    }
  }
  
  // Domains endpoints
  if (path.startsWith('/api/domains')) {
    // List domains
    if (method === 'GET' && path === '/api/domains') {
      return new Response(JSON.stringify({
        domains: storage.domains
      }), { headers });
    }
    
    // Add domain
    if (method === 'POST' && path === '/api/domains' && body) {
      const newId = storage.domains.length + 1;
      const newDomain = {
        id: newId,
        domain: body.domain,
        active: body.active ?? true,
        createdAt: new Date().toISOString()
      };
      
      storage.domains.push(newDomain);
      
      return new Response(JSON.stringify({
        success: true,
        domain: newDomain
      }), { headers });
    }
    
    // Toggle domain status
    if (method === 'PUT' && path.match(/^\/api\/domains\/\d+\/toggle$/)) {
      const domainId = parseInt(path.split('/')[3]);
      const index = storage.domains.findIndex(d => d.id === domainId);
      
      if (index !== -1) {
        storage.domains[index].active = !storage.domains[index].active;
        
        return new Response(JSON.stringify({
          success: true,
          domain: storage.domains[index]
        }), { headers });
      }
      
      return new Response(JSON.stringify({
        error: 'Domain not found'
      }), { status: 404, headers });
    }
    
    // Delete domain
    if (method === 'DELETE' && path.match(/^\/api\/domains\/\d+$/)) {
      const domainId = parseInt(path.split('/').pop());
      const index = storage.domains.findIndex(d => d.id === domainId);
      
      if (index !== -1) {
        const deleted = storage.domains.splice(index, 1)[0];
        
        return new Response(JSON.stringify({
          success: true,
          domain: deleted
        }), { headers });
      }
      
      return new Response(JSON.stringify({
        error: 'Domain not found'
      }), { status: 404, headers });
    }
  }
  
  // Logs endpoints
  if (path.startsWith('/api/logs')) {
    // Get logs
    if (method === 'GET' && path === '/api/logs') {
      const limit = parseInt(query.limit) || 50;
      const offset = parseInt(query.offset) || 0;
      const level = query.level || null;
      
      let filteredLogs = storage.logs;
      if (level) {
        filteredLogs = filteredLogs.filter(log => log.level === level);
      }
      
      const total = filteredLogs.length;
      const logs = filteredLogs.slice(offset, offset + limit);
      
      return new Response(JSON.stringify({
        logs,
        total
      }), { headers });
    }
    
    // Clear logs
    if (method === 'DELETE' && path === '/api/logs') {
      storage.logs = [];
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Logs cleared'
      }), { headers });
    }
  }
  
  // Scraper settings endpoints
  if (path.startsWith('/api/scraper')) {
    // Get settings
    if (method === 'GET' && path === '/api/scraper/settings') {
      // Return default scraper settings
      return new Response(JSON.stringify({
        settings: {
          useHeadless: true,
          timeout: 30000,
          retries: 3,
          cacheTime: 24 * 60 * 60 * 1000 // 24 hours
        }
      }), { headers });
    }
    
    // Update settings
    if (method === 'PUT' && path === '/api/scraper/settings' && body) {
      // In reality, you would update the settings in your database
      return new Response(JSON.stringify({
        success: true,
        settings: body
      }), { headers });
    }
  }
  
  // Default response for unhandled routes
  return new Response(JSON.stringify({
    error: 'Not found',
    path: path
  }), { status: 404, headers });
}

// Main event handler
export default {
  async fetch(request, env, ctx) {
    const { method } = parseRequest(request);
    
    // Handle CORS preflight requests
    if (method === 'OPTIONS') {
      return handleOptions();
    }
    
    // Handle API requests
    try {
      return await handleApiRequest(request, env, ctx);
    } catch (error) {
      console.error('Worker error:', error);
      
      // Error handling
      return new Response(JSON.stringify({
        error: error.message || 'Server error',
        stack: env.NODE_ENV === 'development' ? error.stack : undefined
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};