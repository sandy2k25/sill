// Handler for scraper-related endpoints
export async function handleRequest(event, context) {
  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  
  // Get scraper settings
  if (path === '/scraper/settings' && method === 'GET') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        settings: {
          useHeadlessBrowser: true,
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          timeout: 30000,
          retryCount: 3,
          cacheExpiry: 86400000, // 24 hours in milliseconds
          defaultResolution: "720p"
        }
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
  
  // Update scraper settings
  if (path === '/scraper/settings' && method === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        settings: {
          ...body.settings
        }
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
  
  // Clear cache
  if (path === '/scraper/clear-cache' && method === 'POST') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Cache cleared successfully'
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
  
  // Default fallback for scraper endpoints
  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Scraper endpoint not found', path }),
    headers: { 'Content-Type': 'application/json' }
  };
}