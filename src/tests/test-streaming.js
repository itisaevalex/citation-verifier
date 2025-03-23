// Test script for citation verification streaming
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');
const { EventSource } = require('eventsource');

// Configuration
const SERVER_URL = 'http://localhost:3000';
const PDF_PATH = process.argv[2] || path.join(__dirname, 'sample-papers', 'sample-paper.pdf');

if (!fs.existsSync(PDF_PATH)) {
  console.error(`Error: PDF file not found at ${PDF_PATH}`);
  console.log('Usage: node test-streaming.js [path/to/pdf]');
  process.exit(1);
}

console.log(`=== Citation Verification Streaming Test ===`);
console.log(`Testing with PDF: ${PDF_PATH}`);

async function runTest() {
  try {
    // Phase 1: Upload PDF and start processing
    console.log('\nPhase 1: Uploading PDF and starting processing...');
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(PDF_PATH));
    
    const response = await fetch(`${SERVER_URL}/api/process-document-local`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('\nInitial response:');
    console.log(JSON.stringify(result, null, 2));
    
    const sessionId = result.sessionId;
    const progressUrl = result.progress || `/api/verification-progress/${sessionId}`;
    
    // Phase 2: Connect to SSE endpoint for real-time updates
    console.log('\nPhase 2: Connecting to SSE endpoint for real-time updates...');
    
    const es = new EventSource(`${SERVER_URL}${progressUrl}`);
    
    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.log('Timeout reached. Closing connection...');
      es.close();
      process.exit(0);
    }, 60000); // 60 seconds timeout for real processing
    
    // Handle connection open
    es.onopen = () => {
      console.log('SSE Connection established!');
    };
    
    // Handle messages
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received update:', JSON.stringify(data, null, 2).substring(0, 500) + (JSON.stringify(data, null, 2).length > 500 ? '...' : ''));
        
        // Format the progress nicely
        console.log('\n--- Progress Update ---');
        console.log(`Status: ${data.status || 'initializing'}`);
        console.log(`Current Reference: ${data.currentReference || 'none'}`);
        console.log(`Progress: ${data.currentIndex || 0}/${data.totalReferences || 0}`);
        
        // Display Gemini-specific progress if available
        if (data.geminiStatus) {
          console.log('\n=== Gemini AI Verification ===');
          console.log(`Step: ${data.currentStep || 'Unknown'}`);
          console.log(`Progress: ${data.stepProgress || 0}/${data.totalSteps || 0}`);
          console.log(`Status: ${data.geminiStatusMessage || data.geminiStatus}`);
          
          // Show verification result if available
          if (data.geminiResult) {
            console.log('\nVerification Result:');
            console.log(`✓ Verified: ${data.geminiResult.isVerified ? 'Yes' : 'No'}`);
            console.log(`✓ Confidence: ${Math.round(data.geminiResult.confidenceScore * 100)}%`);
            console.log(`✓ Explanation: ${data.geminiResult.explanation}`);
          }
        }
        
        // Show processed references summary
        if (data.processedReferences && data.processedReferences.length > 0) {
          console.log('\nProcessed References:');
          // Only show the first 5 references to keep the output manageable
          data.processedReferences.slice(0, 5).forEach(ref => {
            console.log(`- ${ref.id}: ${ref.title ? ref.title.substring(0, 50) : 'No title'}... (${ref.status})`);
          });
          
          if (data.processedReferences.length > 5) {
            console.log(`... and ${data.processedReferences.length - 5} more references`);
          }
        }
        
        // If we've received the final update, close the connection
        if (data.status === 'completed' || data.status === 'error') {
          clearTimeout(timeout);
          console.log('\nVerification process completed!');
          console.log(`Total references processed: ${data.processedReferences ? data.processedReferences.length : 0}`);
          es.close();
          if (data.status === 'error') {
            console.error('Error:', data.error);
          }
          process.exit(0);
        }
      } catch (error) {
        console.log('Received raw update:', event.data);
      }
    };
    
    // Handle errors
    es.onerror = (error) => {
      console.error('SSE Error:', error);
      clearTimeout(timeout);
      es.close();
      process.exit(1);
    };
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTest();
