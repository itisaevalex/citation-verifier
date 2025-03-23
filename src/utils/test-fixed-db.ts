/**
 * Test for the fixed document database implementation
 */
import * as path from 'path';
import { DocumentDatabase } from './document-database-fix';

async function testFixedDatabase() {
  console.log('===== Testing Fixed Document Database =====\n');
  
  try {
    // Create database instance
    console.log('Creating DocumentDatabase instance...');
    const dbPath = path.join(process.cwd(), 'src', 'document-database', 'documents');
    const db = new DocumentDatabase(dbPath);
    console.log('✅ DocumentDatabase instance created successfully\n');
    
    // Add a test document
    console.log('Adding test document to database...');
    const testDoc = {
      title: 'Test Document for Citation Verification',
      authors: ['Test Author', 'Another Author'],
      content: 'This is a test document with some content for citation verification testing.',
      year: '2025',
      journal: 'Journal of Testing'
    };
    
    const docId = db.addDocument(testDoc);
    console.log(`✅ Document added with ID: ${docId}\n`);
    
    // Get the document
    console.log('Retrieving document by ID...');
    const retrievedDoc = db.getDocument(docId);
    if (retrievedDoc) {
      console.log('✅ Document retrieved successfully:');
      console.log(`  - ID: ${retrievedDoc.id}`);
      console.log(`  - Title: ${retrievedDoc.title}`);
      console.log(`  - Authors: ${retrievedDoc.authors.join(', ')}`);
      console.log(`  - Year: ${retrievedDoc.year}`);
    } else {
      console.error('❌ Failed to retrieve document by ID');
    }
    
    // Get all documents
    console.log('\nRetrieving all documents...');
    const allDocs = db.getAllDocuments();
    console.log(`✅ Found ${allDocs.length} documents in the database`);
    
    // Display first few documents
    const displayCount = Math.min(3, allDocs.length);
    if (displayCount > 0) {
      console.log('\nSample documents:');
      for (let i = 0; i < displayCount; i++) {
        const doc = allDocs[i];
        console.log(`${i+1}. ${doc.title} (${doc.id})`);
      }
    }
    
    console.log('\n✅ Fixed document database test completed successfully');
  } catch (error) {
    console.error('❌ Error during database test:', error instanceof Error ? error.message : String(error));
    console.error('Error details:', error);
  }
}

// Run the test
testFixedDatabase().catch(error => {
  console.error('Unhandled error:', error);
});
