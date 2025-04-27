// Handler for video-related endpoints
export async function handleRequest(event, context) {
  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  
  // Get videos list
  if ((path === '/videos' || path === '/videos/') && method === 'GET') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        videos: [
          {
            id: 1,
            title: "Sample Video",
            videoId: "sample123",
            url: "https://example.com/video.mp4",
            createdAt: new Date().toISOString(),
            accessCount: 123
          }
        ]
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
  
  // Get a specific video
  if (path.match(/\/videos\/[\w-]+/) && method === 'GET') {
    const videoId = path.split('/').pop();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        id: 1,
        title: "Sample Video",
        videoId: videoId,
        url: "https://example.com/video.mp4",
        createdAt: new Date().toISOString(),
        accessCount: 123
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
  
  // Create a new video (handle POST)
  if ((path === '/videos' || path === '/videos/') && method === 'POST') {
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
        id: 2,
        title: "New Video",
        videoId: body.videoId || "new123",
        url: body.url || "https://example.com/new-video.mp4",
        createdAt: new Date().toISOString(),
        accessCount: 0
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
  
  // Default fallback for video endpoints
  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Video endpoint not found', path }),
    headers: { 'Content-Type': 'application/json' }
  };
}