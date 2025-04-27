// Handler for authentication-related endpoints
export async function handleRequest(event, context) {
  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  
  // Login endpoint
  if (path === '/auth/login' && method === 'POST') {
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
    
    // Very basic auth check - in a real app, this would verify credentials
    if (body.username === 'admin' && body.password === 'password') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          token: 'sample-jwt-token',
          user: {
            id: 1,
            username: 'admin',
            role: 'admin'
          }
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    } else {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid credentials' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
  }
  
  // Default fallback for auth endpoints
  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Auth endpoint not found', path }),
    headers: { 'Content-Type': 'application/json' }
  };
}