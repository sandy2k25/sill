/**
 * Main API proxy function for Netlify
 * This handler routes all API requests to their appropriate handlers
 */
export async function handler(event, context) {
  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  
  console.log(`API Request: ${method} ${path}`);
  
  // Setup CORS headers for all responses
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };
  
  // Handle preflight requests
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }
  
  try {
    // Import the appropriate handler based on the path
    let module;
    
    // Map endpoints to handlers
    if (path.startsWith('/videos') || path === '/videos') {
      module = await import('./handlers/videos.js');
    } 
    else if (path.startsWith('/domains') || path === '/domains') {
      module = await import('./handlers/domains.js');
    }
    else if (path.startsWith('/auth') || path === '/auth' || path.startsWith('/login')) {
      module = await import('./handlers/auth.js');
    }
    else if (path.startsWith('/logs') || path === '/logs') {
      module = await import('./handlers/logs.js');
    }
    else if (path.startsWith('/users') || path === '/users') {
      module = await import('./handlers/users.js');
    }
    else if (path.startsWith('/scraper') || path === '/scraper' || path.startsWith('/settings')) {
      module = await import('./handlers/scraper.js');
    }
    else if (path === '/status' || path === '/') {
      // Basic status endpoint
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'online',
          message: 'WovIeX API is running on Netlify Functions',
          timestamp: new Date().toISOString(),
          environment: 'netlify'
        }),
        headers
      };
    }
    // Default fallback
    else {
      module = await import('./handlers/default.js');
    }
    
    // Call the appropriate handler
    if (module && module.handleRequest) {
      const response = await module.handleRequest(event, context);
      
      // Ensure CORS headers are added to the response
      return {
        ...response,
        headers: { ...headers, ...response.headers }
      };
    }
    
    // Fallback if no handler found
    return {
      statusCode: 404,
      body: JSON.stringify({ 
        error: 'Not found', 
        path,
        message: 'The requested endpoint was not found on this server' 
      }),
      headers
    };
  } catch (error) {
    console.error('Error handling request:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
      headers
    };
  }
}