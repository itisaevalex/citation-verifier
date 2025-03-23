const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== Citation Verifier Basic Test ===\n');

// Step 1: Check if TypeScript is compiled
console.log('Step 1: Checking TypeScript build...');
try {
  if (!fs.existsSync(path.join(__dirname, 'dist'))) {
    console.log('Building TypeScript project...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ TypeScript compiled successfully');
  } else {
    console.log('✅ TypeScript build directory exists');
  }
} catch (error) {
  console.error('❌ Failed to build TypeScript:', error.message);
  process.exit(1);
}

// Step 2: Check if GROBID is running
console.log('\nStep 2: Checking GROBID connection...');
try {
  // Import the compiled code
  let CitationProcessor;
  try {
    CitationProcessor = require('../../dist/reference-extraction/citation-processor').CitationProcessor;
  } catch (error) {
    console.error('❌ Could not import CitationProcessor from compiled code:', error.message);
    process.exit(1);
  }
  
  const processor = new CitationProcessor();
  
  // Check GROBID connection
  processor.checkService()
    .then(isAlive => {
      if (isAlive) {
        console.log('✅ Successfully connected to GROBID service');
        console.log('\n✅ Basic test passed! The citation-verifier application is ready to use.');
        console.log('\nTo process a PDF file, run:');
        console.log('npm start -- /path/to/your/academic-paper.pdf');
      } else {
        console.error('❌ GROBID service is not responding');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Error checking GROBID service:', error.message);
      process.exit(1);
    });
} catch (error) {
  console.error('❌ Error in test:', error.message);
  process.exit(1);
}
