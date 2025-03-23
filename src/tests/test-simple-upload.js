// Simple test script for file uploads
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Configuration
const SERVER_URL = 'http://localhost:3000';
const PDF_PATH = process.argv[2] || path.join(__dirname, 'sample-paper.pdf');

if (!fs.existsSync(PDF_PATH)) {
  console.error(`Error: PDF file not found at ${PDF_PATH}`);
  console.log('Usage: node test-simple-upload.js [path/to/pdf]');
  process.exit(1);
}

console.log(`=== Simple File Upload Test ===`);
console.log(`Testing with file: ${PDF_PATH}`);

async function runTest() {
  try {
    // Create form data with file
    const formData = new FormData();
    formData.append('file', fs.createReadStream(PDF_PATH));
    
    console.log('Sending request to test upload endpoint...');
    const response = await fetch(`${SERVER_URL}/api/test-upload`, {
      method: 'POST',
      body: formData
    });
    
    console.log('Response status:', response.status, response.statusText);
    
    if (response.ok) {
      const result = await response.json();
      console.log('Success! Server response:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('Error response from server');
      try {
        const errorText = await response.text();
        console.error('Error details:', errorText);
      } catch (e) {
        console.error('Could not parse error response');
      }
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

runTest();
