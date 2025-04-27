// Default handler for unmatched endpoints
export async function handleRequest(event, context) {
  const path = event.path.replace('/.netlify/functions/api', '');
  
  return {
    statusCode: 404,
    body: JSON.stringify({
      error: 'API endpoint not found',
      path: path,
      message: 'The requested API endpoint does not exist'
    }),
    headers: { 'Content-Type': 'application/json' }
  };
}