// Simple SSE test script
const { EventSource } = require('eventsource');

// Configuration
const SERVER_URL = 'http://localhost:3000';
const SESSION_ID = process.argv[2] || 'test-session';

console.log(`=== SSE Connection Test ===`);
console.log(`Testing with session ID: ${SESSION_ID}`);

async function runTest() {
  try {
    // Create SSE connection
    console.log(`Connecting to SSE endpoint: ${SERVER_URL}/api/verification-progress/${SESSION_ID}`);
    
    const es = new EventSource(`${SERVER_URL}/api/verification-progress/${SESSION_ID}`);
    
    // Handle connection open
    es.onopen = () => {
      console.log('SSE Connection established!');
    };
    
    // Handle messages
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received update:', data);
      } catch (error) {
        console.log('Received raw update:', event.data);
      }
    };
    
    // Handle errors
    es.onerror = (error) => {
      console.error('SSE Error:', error);
      es.close();
    };
    
    // Keep the connection open for a few seconds, then close
    setTimeout(() => {
      console.log('Test complete. Closing connection...');
      es.close();
      // For testing in Node.js, we need to explicitly exit
      process.exit(0);
    }, 5000);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTest();
