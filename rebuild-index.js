// Execute the database rebuild using a more direct approach
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function rebuildIndex() {
  return new Promise((resolve, reject) => {
    console.log('Starting database index rebuild process...');
    
    try {
      // Create a temporary JavaScript file that will invoke the TypeScript rebuild
      const tempScriptContent = `
// This is a temporary script to rebuild the document index
// It uses ts-node/register to load TypeScript directly
require('ts-node/register');
const path = require('path');

// Import the DocumentDatabase from the TypeScript module
const { DocumentDatabase } = require('./src/document-database');

async function rebuildDocumentIndex() {
  console.log('Rebuilding document index...');
  const db = new DocumentDatabase();
  await db.rebuildIndex();
  console.log('Document index has been rebuilt successfully.');
  return { success: true };
}

// Execute the function
rebuildDocumentIndex()
  .then(() => {
    console.log('Index rebuild completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error in document index rebuild:', err);
    process.exit(1);
  });
`;

      const tempFilePath = path.join(__dirname, 'temp-rebuild.js');
      fs.writeFileSync(tempFilePath, tempScriptContent);
      
      // Execute the temporary script with Node.js (not ts-node)
      console.log(`Executing rebuild script at: ${tempFilePath}`);
      const output = execFileSync('node', [tempFilePath], { 
        encoding: 'utf8',
        shell: true,
        windowsHide: true,
      });
      
      console.log(output);
      
      // Clean up the temporary file
      fs.unlinkSync(tempFilePath);
      
      resolve({
        success: true,
        message: 'Document index has been rebuilt successfully.',
        details: output
      });
    } catch (error) {
      console.error('Error executing rebuild script:', error.message);
      if (error.stderr) {
        console.error('Standard Error:', error.stderr);
      }
      if (error.stdout) {
        console.error('Standard Output:', error.stdout);
      }
      reject(error);
    }
  });
}

module.exports = { rebuildIndex };
