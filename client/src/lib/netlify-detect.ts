// Netlify environment detection helper
// This file is auto-generated during the Netlify build process

// Set Netlify mode in localStorage for detection
export function setupNetlifyMode() {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('NETLIFY_MODE', 'true');
  }
}
