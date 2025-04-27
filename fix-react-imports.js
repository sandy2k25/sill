#!/usr/bin/env node
/**
 * fix-react-imports.js
 * 
 * This script normalizes React imports across the codebase to avoid conflicts
 * during the build process. It temporarily modifies files for the build and
 * can restore them afterward.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const CLIENT_SRC_DIR = path.join(__dirname, 'client', 'src');
const BACKUP_DIR = path.join(__dirname, '.backup');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Counter for modified files
let modifiedCount = 0;
let errorCount = 0;
let skippedCount = 0;

/**
 * Recursively walk through directories and process files
 */
function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    
    if (stats.isDirectory()) {
      walkDir(filepath, callback);
    } else if (stats.isFile()) {
      callback(filepath);
    }
  }
}

/**
 * Process a file to normalize React imports
 */
function processFile(filepath) {
  // Only process TypeScript and JavaScript files
  if (!filepath.match(/\.(tsx?|jsx?)$/)) {
    return;
  }
  
  try {
    // Read the file
    const content = fs.readFileSync(filepath, 'utf8');
    const relativeFilepath = path.relative(__dirname, filepath);
    
    // Skip files that don't use React
    if (!content.includes('React') && !content.includes('react')) {
      skippedCount++;
      return;
    }
    
    // Create a backup
    const backupPath = path.join(BACKUP_DIR, path.basename(filepath));
    fs.writeFileSync(backupPath, content);
    
    // Regex patterns for imports to replace
    const patterns = [
      // Replace "import React from 'react'" with "import * as React from 'react'"
      {
        regex: /import\s+React\s+from\s+['"]react['"]/g,
        replacement: "import * as React from 'react'"
      },
      // Replace "import * as React from 'react'" with "/* React import managed by build system */"
      {
        regex: /import\s+\*\s+as\s+React\s+from\s+['"]react['"]/g,
        replacement: "/* React import managed by build system */"
      },
      // Replace "import {...} from 'react'" with "/* React import managed by build system */"
      {
        regex: /import\s+{[^}]+}\s+from\s+['"]react['"]/g,
        replacement: "/* React imports managed by build system */"
      }
    ];
    
    // Apply all replacements
    let newContent = content;
    let modified = false;
    
    for (const pattern of patterns) {
      const originalContent = newContent;
      newContent = newContent.replace(pattern.regex, pattern.replacement);
      if (newContent !== originalContent) {
        modified = true;
      }
    }
    
    // Only write if file was modified
    if (modified) {
      fs.writeFileSync(filepath, newContent);
      console.log(`${colors.green}✓ Fixed: ${colors.reset}${relativeFilepath}`);
      modifiedCount++;
    } else {
      console.log(`${colors.yellow}⚠ No changes: ${colors.reset}${relativeFilepath}`);
      skippedCount++;
    }
  } catch (error) {
    console.error(`${colors.red}❌ Error processing ${filepath}: ${error.message}${colors.reset}`);
    errorCount++;
  }
}

/**
 * Restore all backup files
 */
function restoreBackups() {
  const backupFiles = fs.readdirSync(BACKUP_DIR);
  let restoredCount = 0;
  
  for (const file of backupFiles) {
    const backupPath = path.join(BACKUP_DIR, file);
    const originalPath = path.join(CLIENT_SRC_DIR, file);
    
    if (fs.existsSync(originalPath)) {
      try {
        const content = fs.readFileSync(backupPath, 'utf8');
        fs.writeFileSync(originalPath, content);
        restoredCount++;
      } catch (error) {
        console.error(`${colors.red}❌ Error restoring ${file}: ${error.message}${colors.reset}`);
      }
    }
  }
  
  console.log(`${colors.green}✓ Restored ${restoredCount} files from backup${colors.reset}`);
}

/**
 * Main function to execute the script
 */
function main() {
  const command = process.argv[2];
  
  if (command === 'restore') {
    // Restore backups
    console.log(`${colors.cyan}Restoring files from backup...${colors.reset}`);
    restoreBackups();
  } else {
    // Fix imports
    console.log(`${colors.cyan}Normalizing React imports...${colors.reset}`);
    console.log(`${colors.yellow}This will modify files temporarily. Run with 'restore' to revert changes.${colors.reset}`);
    walkDir(CLIENT_SRC_DIR, processFile);
    
    console.log(`\n${colors.green}Summary:${colors.reset}`);
    console.log(`${colors.green}✓ Modified: ${modifiedCount} files${colors.reset}`);
    console.log(`${colors.yellow}⚠ Skipped: ${skippedCount} files${colors.reset}`);
    console.log(`${colors.red}❌ Errors: ${errorCount} files${colors.reset}`);
  }
}

// Execute the script
main();