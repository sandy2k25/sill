#!/usr/bin/env node

/**
 * Cloudflare Workers deployment script
 * 
 * This script handles deployment of the WovIeX application to Cloudflare Workers.
 * It builds the frontend, prepares the worker code, and deploys both.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const config = {
  workerDir: path.join(__dirname, '../worker'),
  clientDir: path.join(__dirname, '../client'),
  dist: path.join(__dirname, '../dist'),
  
  // Cloudflare deployment names
  workerName: 'woviex-api',
  pagesName: 'woviex'
};

/**
 * Run a command and log the output
 */
function run(command, cwd = process.cwd()) {
  console.log(`\n> ${command}\n`);
  try {
    return execSync(command, { cwd, stdio: 'inherit' });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    throw error;
  }
}

/**
 * Build the frontend
 */
function buildFrontend() {
  console.log('Building frontend...');
  run('npm run build', config.clientDir);
}

/**
 * Prepare and deploy the worker
 */
function deployWorker() {
  console.log('Deploying worker...');
  
  // Make sure wrangler is installed
  try {
    run('wrangler --version');
  } catch (error) {
    console.log('Installing wrangler...');
    run('npm install -g wrangler');
  }
  
  // Check login status
  try {
    run('wrangler whoami');
  } catch (error) {
    console.log('Please login to Cloudflare:');
    run('wrangler login');
  }
  
  // Deploy the worker
  run('wrangler publish', config.workerDir);
}

/**
 * Deploy the frontend to Cloudflare Pages
 */
function deployPages() {
  console.log('Deploying frontend to Cloudflare Pages...');
  
  // Create a temporary directory for deployment if it doesn't exist
  if (!fs.existsSync(config.dist)) {
    fs.mkdirSync(config.dist);
  }
  
  // Copy the frontend build to dist
  run(`cp -r ${path.join(config.clientDir, 'dist')}/* ${config.dist}`);
  
  // Deploy to Cloudflare Pages
  run(`wrangler pages publish ${config.dist} --project-name=${config.pagesName}`);
}

/**
 * Main deployment function
 */
function deploy() {
  console.log('Starting Cloudflare deployment...');
  
  try {
    buildFrontend();
    deployWorker();
    deployPages();
    
    console.log('\n✅ Deployment successful!');
    console.log(`\nAPI deployed to: https://${config.workerName}.workers.dev`);
    console.log(`Frontend deployed to: https://${config.pagesName}.pages.dev`);
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run the deployment
deploy();