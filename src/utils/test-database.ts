#!/usr/bin/env ts-node
import * as path from 'path';
import * as fs from 'fs';
// Import the DocumentDatabase class directly
import { DocumentDatabase } from '../document-database/index';

/**
 * Simple test script to verify document database functionality
 */
async function testDatabase() {
  console.log('===== Testing Document Database =====\n');
  
  // Get the database directory
  const basePath = process.cwd();
  const dbPath = path.join(basePath, 'src', 'document-database', 'documents');
  
  console.log(`Database path: ${dbPath}`);
  console.log('Creating DocumentDatabase instance...');
  
  try {
    // Create the database instance
    const db = new DocumentDatabase(dbPath);
    console.log('✅ DocumentDatabase instance created successfully');
    
    // Add a test document
    const testDoc = {
      title: 'Test Document',
      authors: ['Test Author'],
      content: 'This is a test document for verification',
      year: '2025',
      journal: 'Test Journal'
    };
    
    console.log('\nAdding test document to database...');
    const docId = db.addDocument(testDoc);
    console.log(`✅ Document added with ID: ${docId}`);
    
    // Retrieve the document
    console.log('\nRetrieving document...');
    const retrievedDoc = db.getDocument(docId);
    if (retrievedDoc) {
      console.log('✅ Document retrieved successfully:');
      console.log(`  - Title: ${retrievedDoc.title}`);
      console.log(`  - ID: ${retrievedDoc.id}`);
      console.log(`  - Authors: ${retrievedDoc.authors.join(', ')}`);
    } else {
      console.error('❌ Failed to retrieve document');
    }
    
    // List all documents
    console.log('\nListing all documents:');
    const allDocs = db.getAllDocuments();
    console.log(`Found ${allDocs.length} documents in the database:`);
    
    allDocs.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.title} (${doc.id})`);
    });
    
    console.log('\n✅ Database test completed successfully');
  } catch (error) {
    console.error('❌ Error during database test:', error instanceof Error ? error.message : String(error));
    console.error('Error details:', error);
  }
}

// Run the test
testDatabase().catch(error => {
  console.error('Unhandled error:', error);
});
