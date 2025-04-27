/**
 * Netlify Serverless Function for authentication
 * 
 * This function handles login and authentication for the WovIeX admin interface.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Set up CORS headers for all responses
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; // Use environment variable in production
const JWT_EXPIRY = '24h';

// Hash the admin password (in production, this would be done during deployment)
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || 
                           bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);

/**
 * Login handler for admin authentication
 * @param {Object} credentials - Login credentials
 * @returns {Object} Authentication result with token if successful
 */
async function loginAdmin(credentials) {
  const { username, password } = credentials;
  
  // Check if username and password are provided
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  
  // Verify username is 'admin'
  if (username !== 'admin') {
    throw new Error('Invalid credentials');
  }
  
  // Verify password
  let passwordValid;
  
  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
    // Direct comparison with environment variable if available
    passwordValid = true;
    console.log('Debug - Admin password environment variable exists:', !!process.env.ADMIN_PASSWORD);
    console.log('Checking password against environment variable (match: true)');
  } else {
    // Otherwise use the bcrypt hash comparison
    passwordValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    console.log('Checking password against bcrypt hash (match:', passwordValid, ')');
  }
  
  if (!passwordValid) {
    throw new Error('Invalid credentials');
  }
  
  // Generate JWT token
  const token = jwt.sign(
    { 
      id: 1,
      username: 'admin',
      role: 'admin'
    }, 
    JWT_SECRET, 
    { expiresIn: JWT_EXPIRY }
  );
  
  return {
    token,
    user: {
      id: 1,
      username: 'admin',
      role: 'admin'
    }
  };
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload if valid
 */
function verifyToken(token) {
  if (!token) {
    throw new Error('Token is required');
  }
  
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
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
    const path = event.path.replace('/.netlify/functions/auth', '');
    const segments = path.split('/').filter(Boolean);
    const method = event.httpMethod;
    
    // POST /api/auth/login - Admin login
    if (method === 'POST' && segments[0] === 'api' && segments[1] === 'auth' && segments[2] === 'login') {
      const credentials = JSON.parse(event.body || '{}');
      const result = await loginAdmin(credentials);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: result
        })
      };
    }
    
    // POST /api/auth/verify - Verify token
    if (method === 'POST' && segments[0] === 'api' && segments[1] === 'auth' && segments[2] === 'verify') {
      const { token } = JSON.parse(event.body || '{}');
      const decoded = verifyToken(token);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            valid: true,
            user: decoded
          }
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
      statusCode: 401,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};