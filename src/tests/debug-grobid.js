/**
 * GROBID Direct Debug Utility
 * 
 * This script directly tests the GROBID connection and basic PDF processing
 * functionality using axios and FormData, bypassing any application-specific code.
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Configuration
const GROBID_URL = 'http://localhost:8070';
const TEST_PDF_PATH = process.argv[2] || './sample.pdf'; // Provide PDF path as argument or use default

async function checkGrobidStatus() {
  try {
    console.log(`Checking GROBID status at ${GROBID_URL}...`);
    const response = await axios.get(`${GROBID_URL}/api/isalive`, {
      timeout: 5000
    });
    
    if (response.status === 200) {
      console.log('✅ GROBID service is running');
      return true;
    } else {
      console.error(`❌ GROBID returned unexpected status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to connect to GROBID service:');
    if (error.code === 'ECONNREFUSED') {
      console.error('   Connection refused. Is GROBID running on the specified port?');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('   Connection timed out. GROBID might be running but not responding.');
    } else {
      console.error(`   ${error.message}`);
    }
    return false;
  }
}

async function testGrobidProcessing() {
  if (!fs.existsSync(TEST_PDF_PATH)) {
    console.error(`❌ Test PDF file not found at: ${TEST_PDF_PATH}`);
    console.error('   Please provide a valid PDF path as the first argument');
    return false;
  }

  console.log(`Testing PDF processing with file: ${TEST_PDF_PATH}`);
  
  try {
    // Create form data with the PDF file
    const formData = new FormData();
    formData.append('input', fs.createReadStream(TEST_PDF_PATH));
    
    // Add some standard processing options
    formData.append('consolidateCitations', '1');
    formData.append('includeRawCitations', '1');
    
    console.log('Sending request to GROBID...');
    
    // Send the request to GROBID
    const response = await axios.post(
      `${GROBID_URL}/api/processFulltextDocument`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/xml'
        },
        timeout: 60000, // 1 minute timeout
        maxContentLength: 50 * 1024 * 1024 // 50MB max response size
      }
    );
    
    console.log(`✅ GROBID successfully processed the PDF`);
    console.log(`   Response status: ${response.status}`);
    console.log(`   Response size: ${response.data.length} characters`);
    
    // Save the response to a file for inspection
    const outputPath = path.join(path.dirname(TEST_PDF_PATH), `${path.basename(TEST_PDF_PATH, '.pdf')}-grobid-debug.xml`);
    fs.writeFileSync(outputPath, response.data);
    console.log(`   Saved response to: ${outputPath}`);
    
    // Basic validation of the response
    if (response.data.includes('<TEI xmlns="http://www.tei-c.org/ns/1.0">')) {
      console.log('   Response appears to be valid TEI XML');
      
      // Quick check for references
      const refCount = (response.data.match(/<biblStruct/g) || []).length;
      console.log(`   Found approximately ${refCount} references in the document`);
      
      return true;
    } else {
      console.error('❌ Response does not appear to be valid TEI XML');
      return false;
    }
  } catch (error) {
    console.error('❌ Error processing PDF with GROBID:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Headers: ${JSON.stringify(error.response.headers)}`);
      console.error(`   Data: ${error.response.data}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('   No response received from GROBID');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error(`   Error message: ${error.message}`);
    }
    return false;
  }
}

// Run the tests
async function runTests() {
  console.log('=== GROBID Direct Debug Utility ===');
  
  // Check GROBID status
  const isGrobidRunning = await checkGrobidStatus();
  if (!isGrobidRunning) {
    console.error('\n❌ GROBID service is not running or not responding.');
    console.error('   Please ensure GROBID is running with:');
    console.error('   docker run -t --rm -p 8070:8070 grobid/grobid:0.8.1');
    return;
  }
  
  // Test GROBID processing
  console.log('\n--- Testing GROBID PDF Processing ---');
  const processingResult = await testGrobidProcessing();
  
  // Summary
  console.log('\n=== Test Summary ===');
  if (processingResult) {
    console.log('✅ All tests passed. GROBID is functioning correctly.');
  } else {
    console.error('❌ Some tests failed. Please check the logs above for details.');
  }
}

// Run the main function
runTests().catch(error => {
  console.error('Unhandled error in test script:');
  console.error(error);
});
