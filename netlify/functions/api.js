// Netlify Function to handle API requests
export async function handler(event, context) {
  // Extract the requested path from the event
  const path = event.path.replace('/.netlify/functions/api', '');
  
  // Basic router for different API endpoints
  if (path === '/videos' || path === '/videos/') {
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
            accessCount: 0
          }
        ]
      }),
      headers: {
        "Content-Type": "application/json"
      }
    };
  }
  
  if (path === '/domains' || path === '/domains/') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        domains: [
          {
            id: 1,
            domain: "example.com",
            active: true,
            createdAt: new Date().toISOString()
          }
        ]
      }),
      headers: {
        "Content-Type": "application/json"
      }
    };
  }
  
  // Default response for any other API endpoint
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "This is a static Netlify function response. For full functionality, please use the actual backend server.",
      path: path,
      method: event.httpMethod
    }),
    headers: {
      "Content-Type": "application/json"
    }
  };
}