// Handler for logs-related endpoints
export async function handleRequest(event, context) {
  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  
  // Get logs list
  if ((path === '/logs' || path === '/logs/') && method === 'GET') {
    // Extract query parameters
    const url = new URL(event.rawUrl);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const level = url.searchParams.get('level');
    
    // Generate sample logs
    const logs = [];
    const total = 100;
    
    for (let i = 0; i < Math.min(limit, 50); i++) {
      const logIndex = offset + i;
      if (logIndex >= total) break;
      
      const logLevels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
      const sources = ['Scraper', 'API', 'Auth', 'Telegram'];
      
      const logLevel = level || logLevels[Math.floor(Math.random() * logLevels.length)];
      
      logs.push({
        id: logIndex + 1,
        level: logLevel,
        source: sources[Math.floor(Math.random() * sources.length)],
        message: `Sample log message ${logIndex + 1}`,
        createdAt: new Date(Date.now() - (logIndex * 60000)).toISOString()
      });
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        logs,
        total
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
  
  // Clear logs
  if (path === '/logs/clear' && method === 'POST') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Logs cleared successfully'
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
  
  // Default fallback for logs endpoints
  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Logs endpoint not found', path }),
    headers: { 'Content-Type': 'application/json' }
  };
}