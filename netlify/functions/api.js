// Main API proxy function for Netlify
export async function handler(event, context) {
  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  
  console.log(`API Request: ${method} ${path}`);
  
  try {
    // Import the appropriate handler based on the path
    let module;
    
    // Videos endpoints
    if (path.startsWith('/videos') || path === '/videos') {
      module = await import('./handlers/videos.js');
    } 
    // Domains endpoints
    else if (path.startsWith('/domains') || path === '/domains') {
      module = await import('./handlers/domains.js');
    }
    // Auth endpoints
    else if (path.startsWith('/auth') || path === '/auth') {
      module = await import('./handlers/auth.js');
    }
    // Default fallback
    else {
      module = await import('./handlers/default.js');
    }
    
    // Call the appropriate handler
    if (module && module.handleRequest) {
      return await module.handleRequest(event, context);
    }
    
    // Fallback if no handler found
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not found', path }),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (error) {
    console.error('Error handling request:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', message: error.message }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
}