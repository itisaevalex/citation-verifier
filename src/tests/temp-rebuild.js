
// This is a temporary script to rebuild the document index
// It uses ts-node/register to load TypeScript directly
require('ts-node/register');
const path = require('path');

// Import the DocumentDatabase from the TypeScript module
const { DocumentDatabase } = require('../document-database');

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
