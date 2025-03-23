const https = require('https');
const http = require('http');

// Simple function to make an HTTP request
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data
        });
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.end();
  });
}

// Check if GROBID is alive
async function checkGrobid() {
  try {
    console.log('Checking GROBID service...');
    const response = await makeRequest('http://localhost:8070/api/isalive');
    console.log(`Status code: ${response.statusCode}`);
    console.log(`Response: ${response.data}`);
    
    if (response.statusCode === 200) {
      console.log('✅ GROBID service is available and ready');
      return true;
    } else {
      console.log('❌ GROBID service is not responding correctly');
      return false;
    }
  } catch (error) {
    console.error('❌ Error connecting to GROBID service:', error.message);
    return false;
  }
}

// Run the check
checkGrobid()
  .then(isAlive => {
    if (!isAlive) {
      process.exit(1);
    }
  });
