/**
 * JWT implementation for Cloudflare Workers
 * This is a simplified JWT implementation that works in Workers environment
 * In a production app, you might want to use a more robust library via WebAssembly
 */

// Base64 URL encoding/decoding functions
function base64UrlEncode(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) {
    str += new Array(5-pad).join('=');
  }
  return atob(str);
}

// Text encoder/decoder
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Helper to convert string to ArrayBuffer
function stringToBuffer(str) {
  return encoder.encode(str);
}

// Helper to convert ArrayBuffer to string
function bufferToString(buffer) {
  return decoder.decode(buffer);
}

// Create HMAC signature
async function createSignature(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    stringToBuffer(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    stringToBuffer(data)
  );
  
  return new Uint8Array(signature);
}

// Verify HMAC signature
async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    stringToBuffer(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  return await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    stringToBuffer(data)
  );
}

// Sign JWT
export async function sign(payload, secret, options = {}) {
  // Create header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  // Add expiration if specified
  if (options.expiresIn) {
    const now = Math.floor(Date.now() / 1000);
    let expiresIn = options.expiresIn;
    
    if (typeof expiresIn === 'string') {
      const match = expiresIn.match(/^(\d+)([smhd])$/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        
        switch (unit) {
          case 's': expiresIn = value; break;
          case 'm': expiresIn = value * 60; break;
          case 'h': expiresIn = value * 60 * 60; break;
          case 'd': expiresIn = value * 60 * 60 * 24; break;
          default: expiresIn = 3600; // Default 1 hour
        }
      } else {
        expiresIn = 3600; // Default 1 hour
      }
    }
    
    payload.exp = now + expiresIn;
    payload.iat = now;
  }
  
  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  
  // Create data to sign
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  
  // Create signature
  const signature = await createSignature(dataToSign, secret);
  const encodedSignature = base64UrlEncode(bufferToString(signature));
  
  // Return JWT
  return `${dataToSign}.${encodedSignature}`;
}

// Verify JWT
export async function verify(token, secret) {
  // Split token
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }
  
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  
  // Verify signature
  const dataToVerify = `${encodedHeader}.${encodedPayload}`;
  const signature = stringToBuffer(base64UrlDecode(encodedSignature));
  
  const isValid = await verifySignature(dataToVerify, signature, secret);
  if (!isValid) {
    throw new Error('Invalid signature');
  }
  
  // Decode payload
  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  
  // Check expiration
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }
  
  return payload;
}

// Decode JWT without verification (for debugging)
export function decode(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    const [encodedHeader, encodedPayload] = parts;
    
    const header = JSON.parse(base64UrlDecode(encodedHeader));
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    
    return { header, payload };
  } catch (error) {
    throw new Error(`Failed to decode token: ${error.message}`);
  }
}