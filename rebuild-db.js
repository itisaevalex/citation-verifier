// This is a direct database rebuild script that can be called from JavaScript

// First, register the TypeScript compiler
require('ts-node/register');

// Import the document database directly from the TypeScript file
const { DocumentDatabase } = require('./src/document-database');

// Function to rebuild the database index
async function rebuildDocumentIndex() {
  console.log('Starting database index rebuild...');
  try {
    const db = new DocumentDatabase();
    await db.rebuildIndex();
    console.log('Document index has been rebuilt successfully.');
    return {
      success: true,
      message: 'Document index has been rebuilt successfully.'
    };
  } catch (error) {
    console.error('Error rebuilding document index:', error);
    throw error;
  }
}

// If this script is run directly
if (require.main === module) {
  rebuildDocumentIndex()
    .then(result => console.log(result))
    .catch(err => {
      console.error('Failed to rebuild index:', err);
      process.exit(1);
    });
}

// Export the function for use in other modules
module.exports = { rebuildDocumentIndex };
