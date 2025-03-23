#!/usr/bin/env node
/**
 * Setup script for Citation Verifier
 * 
 * This script helps with initial setup by:
 * 1. Creating a .env file from .env.example if it doesn't exist
 * 2. Checking for GROBID service availability
 * 3. Creating necessary directories
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuration paths
const ENV_EXAMPLE_PATH = path.join(__dirname, '.env.example');
const ENV_PATH = path.join(__dirname, '.env');
const DOCUMENTS_DIR = path.join(__dirname, 'src', 'document-database', 'documents');

/**
 * Main setup function
 */
async function setup() {
  console.log('=== Citation Verifier Setup ===');
  
  // Step 1: Create .env file if it doesn't exist
  await setupEnvFile();
  
  // Step 2: Check GROBID service
  await checkGrobidService();
  
  // Step 3: Create necessary directories
  createDirectories();
  
  console.log('\n✅ Setup completed successfully!');
  console.log('\nNext steps:');
  console.log('1. Edit your .env file and add your Google API key');
  console.log('2. Start GROBID if it\'s not running: docker run -p 8070:8070 grobid/grobid:0.8.1');
  console.log('3. Run `npm install` to install dependencies');
  console.log('4. Run `npx ts-node verify-citations.ts help` to see available commands');
  
  rl.close();
}

/**
 * Create .env file from .env.example if it doesn't exist
 */
async function setupEnvFile() {
  console.log('\n📋 Checking environment configuration...');
  
  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    console.error('❌ .env.example file not found. Please make sure you have the example file.');
    process.exit(1);
  }
  
  if (fs.existsSync(ENV_PATH)) {
    console.log('✅ .env file already exists');
    
    // Ask if user wants to overwrite existing .env file
    const shouldOverwrite = await askQuestion('Would you like to overwrite the existing .env file? (y/N): ');
    
    if (shouldOverwrite.toLowerCase() !== 'y') {
      console.log('Keeping existing .env file');
      return;
    }
  }
  
  // Copy .env.example to .env
  fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
  console.log('✅ Created .env file from .env.example');
  
  // Check if Google API key is provided
  const googleApiKey = await askQuestion('Enter your Google API Key (press Enter to skip): ');
  
  if (googleApiKey) {
    // Update .env file with the provided API key
    let envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    envContent = envContent.replace(/GOOGLE_API_KEY=.*/, `GOOGLE_API_KEY=${googleApiKey}`);
    fs.writeFileSync(ENV_PATH, envContent);
    console.log('✅ Updated Google API Key in .env file');
  } else {
    console.log('⚠️ No Google API Key provided. You can add it later by editing the .env file.');
  }
}

/**
 * Check if GROBID service is running
 */
async function checkGrobidService() {
  console.log('\n📋 Checking GROBID service...');
  
  try {
    const isAlive = await isGrobidRunning();
    
    if (isAlive) {
      console.log('✅ GROBID service is running');
    } else {
      console.log('⚠️ GROBID service is not running');
      console.log('You can start GROBID with: docker run -p 8070:8070 grobid/grobid:0.8.1');
    }
  } catch (error) {
    console.error('❌ Error checking GROBID service:', error.message);
  }
}

/**
 * Check if GROBID service is running
 * @returns {Promise<boolean>} Whether GROBID is running
 */
function isGrobidRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:8070/api/isalive', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(res.statusCode === 200 && data.includes('true'));
      });
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Create necessary directories
 */
function createDirectories() {
  console.log('\n📋 Setting up directories...');
  
  if (!fs.existsSync(DOCUMENTS_DIR)) {
    fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
    console.log(`✅ Created documents directory: ${DOCUMENTS_DIR}`);
  } else {
    console.log('✅ Documents directory already exists');
  }
}

/**
 * Helper function to ask a question and get user input
 * @param {string} question The question to ask
 * @returns {Promise<string>} User's answer
 */
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Run the setup
setup().catch((error) => {
  console.error('Setup failed:', error);
  rl.close();
  process.exit(1);
});
