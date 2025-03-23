const fs = require('fs');
const path = require('path');
const { EventSource } = require('eventsource');
const { execSync } = require('child_process');

// Configuration
const pdfFile = process.argv[2] || 'sample-paper.pdf';
const serverUrl = 'http://localhost:3000';
const apiEndpoint = '/api/verify';
const timeout = 120000; // 2 minutes timeout

console.log('=== Citation Verification with Gemini Test ===');
console.log(`Testing with PDF: ${pdfFile}`);

// Make sure the PDF file exists
if (!fs.existsSync(pdfFile)) {
  console.error(`Error: File ${pdfFile} not found.`);
  process.exit(1);
}

// Function to upload the PDF and start the verification process
async function uploadPdfAndVerify() {
  console.log('\nPhase 1: Uploading PDF and starting verification...');
  
  try {
    // Build cURL command to upload the PDF and start verification
    const command = `curl -X POST ${serverUrl}${apiEndpoint} -H "Content-Type: multipart/form-data" -F "file=@${pdfFile}" -F "verifyWithGemini=true"`;
    
    console.log(`Executing: ${command}`);
    
    // Execute the command and get response
    const response = execSync(command, { encoding: 'utf-8' });
    
    console.log(`\nInitial response:\n${response}`);
    
    try {
      // Parse the JSON response
      const data = JSON.parse(response);
      
      // Check if we got a session ID and progress URL
      if (!data.sessionId || !data.progress) {
        console.error('Error: Invalid response format, missing sessionId or progress URL');
        process.exit(1);
      }
      
      // Connect to SSE for real-time updates
      connectToSSE(data.progress, data.sessionId);
      
    } catch (jsonError) {
      console.error('Error uploading file:', jsonError);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Error executing curl command:', error.message);
    process.exit(1);
  }
}

// Function to connect to Server-Sent Events endpoint
function connectToSSE(progressUrl, sessionId) {
  console.log('\nPhase 2: Connecting to SSE endpoint for real-time updates...');
  
  // Ensure progressUrl starts with a slash
  if (!progressUrl.startsWith('/')) {
    progressUrl = '/' + progressUrl;
  }
  
  // Create the full URL for EventSource
  const fullUrl = new URL(progressUrl, serverUrl).toString();
  console.log(`Connecting to: ${fullUrl}`);
  
  // Create EventSource with the full URL
  const es = new EventSource(fullUrl);
  
  // Set a timeout in case verification takes too long
  const timeoutId = setTimeout(() => {
    console.log('Timeout reached, closing connection...');
    es.close();
    process.exit(1);
  }, timeout);
  
  // Listen for open events
  es.addEventListener('open', () => {
    console.log('Connection to SSE established.');
  });
  
  // Listen for error events
  es.addEventListener('error', (error) => {
    console.error('SSE Connection error:', error);
    
    // Don't exit immediately, wait to see if it reconnects
    setTimeout(() => {
      if (es.readyState === EventSource.CLOSED) {
        console.error('Connection failed and did not recover.');
        clearTimeout(timeoutId);
        process.exit(1);
      }
    }, 5000);
  });
  
  // Listen for message events (default event type)
  es.addEventListener('message', (event) => {
    try {
      // Try to parse the data as JSON
      const data = JSON.parse(event.data);
      console.log('Progress update received:', JSON.stringify(data, null, 2));
      
      // Check for Gemini verification specific updates
      if (data.geminiStatus) {
        console.log(`\nGemini verification step: ${data.geminiStatus.toUpperCase()}`);
        console.log(`Details: ${data.currentStep}`);
        
        if (data.geminiResult) {
          console.log(`Result: ${data.geminiResult.isVerified ? 'VERIFIED' : 'NOT VERIFIED'} (${Math.round(data.geminiResult.confidenceScore * 100)}%)`);
        }
      }
      
      // Check if process is completed
      if (data.status === 'completed') {
        console.log('\nVerification process completed successfully!');
        es.close();
        clearTimeout(timeoutId);
        process.exit(0);
      } else if (data.status === 'error') {
        console.error('\nVerification process completed with errors.');
        es.close();
        clearTimeout(timeoutId);
        process.exit(1);
      }
    } catch (error) {
      console.log('Raw update received:', event.data);
    }
  });
}

// Start the process
uploadPdfAndVerify();
