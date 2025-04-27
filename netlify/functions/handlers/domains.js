// Handler for domain-related endpoints
export async function handleRequest(event, context) {
  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  
  // Get domains list
  if ((path === '/domains' || path === '/domains/') && method === 'GET') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        domains: [
          {
            id: 1,
            domain: "example.com",
            active: true,
            createdAt: new Date().toISOString()
          },
          {
            id: 2,
            domain: "test.com",
            active: false,
            createdAt: new Date().toISOString()
          }
        ]
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
  
  // Default fallback for domain endpoints
  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Domain endpoint not found', path }),
    headers: { 'Content-Type': 'application/json' }
  };
}