/**
 * Rebuild Index Script
 * 
 * This script rebuilds the document database index.
 * It can be called directly with: npx ts-node src/rebuild-index.ts
 */

import { DocumentDatabase } from './document-database';

async function main() {
  try {
    console.log('Rebuilding document index...');
    const db = new DocumentDatabase();
    await db.rebuildIndex();
    console.log('Document index has been rebuilt successfully.');
    return { success: true, message: 'Document index has been rebuilt successfully.' };
  } catch (error) {
    console.error('Error rebuilding document index:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main()
    .then(() => console.log('Index rebuild completed'))
    .catch(err => {
      console.error('Error in rebuild process:', err);
      process.exit(1);
    });
}

export default main;
