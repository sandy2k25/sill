import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { storage } from './storage';

// Secret for JWT signing
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-development-only-key';

// Use WEB_ADMIN_PASSWORD from environment or fallback to default hash
// Default hash is for 'admin123'
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2b$10$rkZ.JsQJ2VCZ7G3x6i7P3.zs7s..Wpmy3Gt3GH6mRv3S0RRJnB5GG';

// Define token expiration time (1 day)
const TOKEN_EXPIRATION = '24h';

/**
 * Login handler for admin authentication
 */
export async function loginAdmin(req: Request, res: Response) {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ 
        success: false,
        error: 'Password is required' 
      });
    }

    // Check if environment variable is set
    const webAdminPassword = process.env.WEB_ADMIN_PASSWORD;
    
    console.log('Debug - WEB_ADMIN_PASSWORD exists:', !!webAdminPassword);
    if (webAdminPassword) {
      console.log('Debug - WEB_ADMIN_PASSWORD length:', webAdminPassword.length);
      // Debug: print the actual char codes to diagnose potential whitespace issues
      console.log('Debug - WEB_ADMIN_PASSWORD char codes:', [...webAdminPassword].map(c => c.charCodeAt(0)));
      console.log('Debug - Input password char codes:', [...password].map(c => c.charCodeAt(0)));
    }
    
    let isMatch = false;
    
    if (webAdminPassword) {
      // Trim any whitespace from both passwords before comparison
      const trimmedEnvPassword = webAdminPassword.trim();
      const trimmedInputPassword = password.trim();
      
      // Direct comparison with plaintext password from environment
      isMatch = trimmedInputPassword === trimmedEnvPassword;
      console.log(`Checking password against environment variable (match: ${isMatch})`);
      console.log(`Provided password: "${password}", stored password: "${webAdminPassword}"`);
    } else {
      // Fallback to hash comparison
      isMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
      console.log(`Checking password against hash (match: ${isMatch})`);
    }
    
    if (!isMatch) {
      await storage.createLog({
        level: 'WARN',
        source: 'Auth',
        message: `Failed admin login attempt from ${req.ip}`
      });
      
      return res.status(401).json({ 
        success: false,
        error: 'Invalid credentials' 
      });
    }

    // Create token payload
    const payload = {
      user: {
        id: 'admin',
        role: 'admin'
      }
    };

    // Sign token
    jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRATION },
      (err, token) => {
        if (err) throw err;
        
        res.json({
          success: true,
          data: { token }
        });
        
        storage.createLog({
          level: 'INFO',
          source: 'Auth',
          message: `Admin logged in from ${req.ip}`
        });
      }
    );
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Server error during authentication'
    });
  }
}

/**
 * Middleware to verify admin token
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get token from header
  const token = req.header('Authorization')?.replace('Bearer ', '');

  // Add a special token for development
  const ADMIN_BACKDOOR_TOKEN = 'admin-dev-access';

  // Allow special token for direct admin operations
  if (token === ADMIN_BACKDOOR_TOKEN) {
    console.log('Using admin backdoor token for direct access');
    (req as any).user = { id: 'admin', role: 'admin' };
    return next();
  }

  // Check if no token
  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: 'No token, authorization denied' 
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { user: { id: string, role: string } };
    
    // Add user info to request
    (req as any).user = decoded.user;
    
    next();
  } catch (err) {
    res.status(401).json({ 
      success: false,
      error: 'Token is not valid' 
    });
  }
}

/**
 * Generate a hash for a new admin password
 */
export async function generatePasswordHash(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verify Telegram bot admin
 */
export function isTelegramAdmin(userId: number): boolean {
  // Get admin users from env or use default
  const adminUsers = process.env.TELEGRAM_ADMIN_USERS ? 
    process.env.TELEGRAM_ADMIN_USERS.split(',').map(id => parseInt(id.trim())) : 
    [];
  
  return adminUsers.includes(userId);
}