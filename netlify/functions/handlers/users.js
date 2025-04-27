// Handler for user-related endpoints
export async function handleRequest(event, context) {
  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  
  // Check if authorized
  const getUser = () => {
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.replace('Bearer ', '');
    // In a real implementation, this would verify the token
    if (token === 'sample-jwt-token') {
      return {
        id: 1,
        username: 'admin',
        role: 'admin',
        createdAt: new Date().toISOString()
      };
    }
    
    return null;
  };
  
  // Middleware to check authorization
  const requireAuth = (handler) => {
    const user = getUser();
    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    return handler(user);
  };
  
  // Get current user
  if (path === '/users/me' && method === 'GET') {
    return requireAuth((user) => {
      return {
        statusCode: 200,
        body: JSON.stringify(user),
        headers: { 'Content-Type': 'application/json' }
      };
    });
  }
  
  // Get users list (admin only)
  if ((path === '/users' || path === '/users/') && method === 'GET') {
    return requireAuth((user) => {
      if (user.role !== 'admin') {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Forbidden' }),
          headers: { 'Content-Type': 'application/json' }
        };
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          users: [
            {
              id: 1,
              username: 'admin',
              role: 'admin',
              createdAt: new Date().toISOString()
            },
            {
              id: 2,
              username: 'user',
              role: 'user',
              createdAt: new Date(Date.now() - 86400000).toISOString()
            }
          ]
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    });
  }
  
  // Create a new user (admin only)
  if ((path === '/users' || path === '/users/') && method === 'POST') {
    return requireAuth((user) => {
      if (user.role !== 'admin') {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Forbidden' }),
          headers: { 'Content-Type': 'application/json' }
        };
      }
      
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
        statusCode: 201,
        body: JSON.stringify({
          id: 3,
          username: body.username || 'newuser',
          role: body.role || 'user',
          createdAt: new Date().toISOString()
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    });
  }
  
  // Default fallback for user endpoints
  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'User endpoint not found', path }),
    headers: { 'Content-Type': 'application/json' }
  };
}