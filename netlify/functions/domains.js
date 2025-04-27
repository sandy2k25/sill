/**
 * Netlify Serverless Function for handling domain whitelist operations
 * 
 * This function manages the whitelisted domains for the WovIeX application on Netlify.
 */

// Set up CORS headers for all responses
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

// In-memory storage for domains (will reset on function cold starts)
// For Netlify, consider using a database like Fauna or integrating with a CMS
let domains = [
  { id: 1, domain: 'localhost', active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 2, domain: 'netlify.app', active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 3, domain: '127.0.0.1', active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

let nextId = 4;

/**
 * Get all domains
 * @returns {Array} List of domains
 */
function getAllDomains() {
  return domains;
}

/**
 * Check if a domain is whitelisted
 * @param {string} domain - Domain to check
 * @returns {boolean} Whether the domain is whitelisted and active
 */
function isDomainWhitelisted(domain) {
  if (!domain) return false;
  
  // Extract domain from URL if needed
  let hostname = domain;
  try {
    if (domain.startsWith('http')) {
      hostname = new URL(domain).hostname;
    }
  } catch (err) {
    console.error('Error parsing domain:', err);
    return false;
  }
  
  // Check if domain or any parent domain is whitelisted
  const domainParts = hostname.split('.');
  
  for (let i = 0; i < domainParts.length - 1; i++) {
    const testDomain = domainParts.slice(i).join('.');
    const matchingDomain = domains.find(d => 
      d.domain === testDomain && d.active
    );
    
    if (matchingDomain) return true;
  }
  
  return false;
}

/**
 * Create a new domain
 * @param {Object} domainData - Domain data to create
 * @returns {Object} Created domain
 */
function createDomain(domainData) {
  const now = new Date().toISOString();
  
  const newDomain = {
    id: nextId++,
    domain: domainData.domain,
    active: domainData.active !== undefined ? domainData.active : true,
    createdAt: now,
    updatedAt: now
  };
  
  domains.push(newDomain);
  return newDomain;
}

/**
 * Toggle domain active status
 * @param {number} id - Domain ID to toggle
 * @returns {Object|null} Updated domain or null if not found
 */
function toggleDomainStatus(id) {
  const domain = domains.find(d => d.id === id);
  if (!domain) return null;
  
  domain.active = !domain.active;
  domain.updatedAt = new Date().toISOString();
  
  return domain;
}

/**
 * Delete a domain
 * @param {number} id - Domain ID to delete
 * @returns {boolean} Whether the deletion was successful
 */
function deleteDomain(id) {
  const initialLength = domains.length;
  domains = domains.filter(d => d.id !== id);
  
  return domains.length < initialLength;
}

/**
 * Check admin authentication
 * @param {Object} event - Netlify event object
 * @returns {boolean} Whether the user is authenticated as admin
 */
function isAdminAuthenticated(event) {
  // In a real implementation, verify JWT tokens or similar
  // For this example, we'll check for a hard-coded API key
  // In production, use Netlify Identity or a proper auth service
  
  const token = event.headers.authorization?.replace('Bearer ', '') || 
                event.queryStringParameters?.token;
                
  // This is just an example - in production, use Netlify Identity or proper JWT validation
  return token === process.env.ADMIN_API_KEY;
}

/**
 * Netlify function handler
 */
exports.handler = async function(event, context) {
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }
  
  try {
    const path = event.path.replace('/.netlify/functions/domains', '');
    const segments = path.split('/').filter(Boolean);
    const method = event.httpMethod;
    
    // Public endpoint to check if a domain is whitelisted
    if (method === 'GET' && segments[0] === 'api' && segments[1] === 'domains' && segments[2] === 'check') {
      const domain = event.queryStringParameters?.domain;
      
      if (!domain) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Domain parameter is required'
          })
        };
      }
      
      const isWhitelisted = isDomainWhitelisted(domain);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            domain,
            whitelisted: isWhitelisted
          }
        })
      };
    }
    
    // From here, all routes require admin authentication
    if (!isAdminAuthenticated(event)) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Unauthorized'
        })
      };
    }
    
    // GET /api/domains - Get all domains
    if (method === 'GET' && segments[0] === 'api' && segments[1] === 'domains' && !segments[2]) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: getAllDomains()
        })
      };
    }
    
    // POST /api/domains - Create a new domain
    if (method === 'POST' && segments[0] === 'api' && segments[1] === 'domains' && !segments[2]) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.domain) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Domain is required'
          })
        };
      }
      
      const newDomain = createDomain(body);
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          data: newDomain
        })
      };
    }
    
    // PUT /api/domains/:id/toggle - Toggle domain active status
    if (method === 'PUT' && segments[0] === 'api' && segments[1] === 'domains' && segments[3] === 'toggle') {
      const id = parseInt(segments[2], 10);
      
      if (isNaN(id)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid domain ID'
          })
        };
      }
      
      const updatedDomain = toggleDomainStatus(id);
      
      if (!updatedDomain) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Domain not found'
          })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: updatedDomain
        })
      };
    }
    
    // DELETE /api/domains/:id - Delete a domain
    if (method === 'DELETE' && segments[0] === 'api' && segments[1] === 'domains' && segments[2]) {
      const id = parseInt(segments[2], 10);
      
      if (isNaN(id)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid domain ID'
          })
        };
      }
      
      const success = deleteDomain(id);
      
      if (!success) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Domain not found'
          })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Domain deleted successfully'
        })
      };
    }
    
    // Handle unknown endpoints
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Endpoint not found'
      })
    };
  } catch (error) {
    console.error('Error processing request:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};