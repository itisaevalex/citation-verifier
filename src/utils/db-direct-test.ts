/**
 * Direct import test for DocumentDatabase
 */
import * as path from 'path';
// Try different import methods
import { DocumentDatabase } from '../document-database/index';
// import { DocumentDatabase } from '../document-database';
// const { DocumentDatabase } = require('../document-database/index');

console.log('===== Testing Document Database Direct Import =====');

// Print the imported type
console.log('DocumentDatabase type:', typeof DocumentDatabase);

// Log the class itself
console.log('DocumentDatabase class:', DocumentDatabase);

if (typeof DocumentDatabase === 'function') {
  try {
    // Create an instance
    const dbPath = path.join(process.cwd(), 'src', 'document-database', 'documents');
    console.log('Creating instance with path:', dbPath);
    const db = new DocumentDatabase(dbPath);
    console.log('✅ DocumentDatabase instance created successfully');
    console.log('Instance type:', typeof db);
  } catch (error) {
    console.error('❌ Error creating instance:', error instanceof Error ? error.message : String(error));
    console.error('Error details:', error);
  }
} else {
  console.error('❌ DocumentDatabase is not a constructor function:', DocumentDatabase);
}
