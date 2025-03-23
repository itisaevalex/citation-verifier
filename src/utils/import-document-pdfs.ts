#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as path from 'path';

// Import the Document interface from the document-database module
import { Document } from '../document-database';

// Import the new DocumentProcessor from the document-extraction module
import { DocumentProcessor, DocumentData } from '../document-extraction';

/**
 * Script that processes PDFs in the document database folder and adds them to the database
 */
async function importDocumentPdfs() {
  console.log('===== Document PDF Import Tool =====\n');
  
  // Configure paths
  const basePath = process.cwd();
  const pdfDirectory = path.join(basePath, 'src', 'document-database', 'pdf-documents');
  const documentsDir = path.join(basePath, 'src', 'document-database', 'documents');
  const indexPath = path.join(basePath, 'src', 'document-database', 'index.json');
  
  // Check if PDF directory exists
  if (!fs.existsSync(pdfDirectory)) {
    console.error(`Error: PDF directory not found: ${pdfDirectory}`);
    console.log('Please create the directory and add PDF files to it.');
    return;
  }
  
  // List PDF files
  const files = fs.readdirSync(pdfDirectory)
    .filter(file => file.toLowerCase().endsWith('.pdf'))
    .map(file => path.join(pdfDirectory, file));
  
  if (files.length === 0) {
    console.log('No PDF files found in the directory.');
    return;
  }
  
  console.log(`Found ${files.length} PDF files to process.\n`);
  
  // Create a DocumentProcessor instance
  const documentProcessor = new DocumentProcessor({ grobidUrl: 'http://localhost:8070' });
  
  // Check if GROBID service is running
  console.log('Checking if GROBID service is running...');
  const grobidAvailable = await documentProcessor.checkGrobidStatus();
  
  if (grobidAvailable) {
    console.log('✅ GROBID service is running.');
  } else {
    console.warn('⚠️ GROBID service check failed. If you know the service is running on a different port or URL, you can continue.');
    const continueWithoutGrobid = process.argv.includes('--force');
    
    if (!continueWithoutGrobid) {
      console.error('❌ If GROBID is running but not detected, try adding the --force flag');
      console.error('Example: npx ts-node import-document-pdfs.ts --force');
      process.exit(1);
    } else {
      console.log('⚠️ Continuing with import despite GROBID connection check failure...');
    }
  }
  
  // Ensure the documents directory exists
  if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir, { recursive: true });
    console.log(`Created documents directory: ${documentsDir}`);
  }
  
  // Also make sure the index.json file exists
  let documentIndex: { [key: string]: string } = {};
  if (fs.existsSync(indexPath)) {
    try {
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      documentIndex = JSON.parse(indexContent);
      console.log(`Loaded existing document index with ${Object.keys(documentIndex).length} documents.`);
    } catch (error) {
      console.warn('Warning: Could not parse index.json, creating a new index file.');
      documentIndex = {};
    }
  }
  
  // Process each PDF file
  let successCount = 0;
  let errorCount = 0;
  
  for (const [index, pdfPath] of files.entries()) {
    const filename = path.basename(pdfPath);
    console.log(`Processing PDF ${index + 1} of ${files.length}: ${filename}`);
    
    try {
      // Process PDF with our new DocumentProcessor
      console.log('  Extracting text and metadata using GROBID...');
      const docData = await documentProcessor.processPdf(pdfPath);
      
      // Use the document title or filename as a fallback
      const documentTitle = docData.title || filename.replace('.pdf', '');
      
      // Format authors as strings for storage
      const authorStrings = formatAuthors(docData.authors);
      
      // Generate a document ID based on the title
      const docId = convertToValidFilename(documentTitle);
      const docPath = path.join(documentsDir, `${docId}.json`);
      
      // Create document object with required fields according to the Document interface
      const documentData: Document = {
        id: docId,
        title: documentTitle,
        authors: authorStrings,
        content: docData.fullText,
        filePath: pdfPath
      };
      
      // Add optional fields if available
      if (docData.publicationYear) {
        documentData.year = docData.publicationYear;
      }
      
      if (docData.journal) {
        documentData.journal = docData.journal;
      }
      
      if (docData.doi) {
        documentData.doi = docData.doi;
      }
      
      // Save the document to a JSON file
      fs.writeFileSync(docPath, JSON.stringify(documentData, null, 2));
      
      // Add the document to the index
      documentIndex[docId] = docPath;
      
      console.log(`  ✅ Successfully saved document as: ${docPath}`);
      console.log(`  Title: ${documentData.title}`);
      console.log(`  Authors: ${documentData.authors.join('; ')}`);
      console.log(`  Year: ${documentData.year || 'Unknown'}`);
      console.log(`  Content length: ${documentData.content.length} characters`);
      console.log('');
      
      successCount++;
    } catch (error: unknown) {
      // Properly handle the unknown type of the caught error
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Error processing ${filename}:`, errorMessage);
      console.log('  Continuing with next file...\n');
      errorCount++;
    }
  }
  
  // Write the updated index back to disk
  fs.writeFileSync(indexPath, JSON.stringify(documentIndex, null, 2));
  console.log(`Updated document index with ${Object.keys(documentIndex).length} total documents.`);
  
  console.log('===== Import Complete =====');
  console.log(`Successfully imported ${successCount} documents to the database.`);
  if (errorCount > 0) {
    console.log(`Failed to import ${errorCount} documents.`);
  }
  console.log(`You can now use these documents for citation verification.`);
}

/**
 * Helper function to format author names
 */
function formatAuthors(authors: Array<any>): string[] {
  if (!authors || !Array.isArray(authors)) {
    return [];
  }
  
  return authors.map(author => {
    if (!author) return '';
    
    if (author.rawName) {
      return author.rawName;
    }
    
    const parts = [
      author.lastName || '',
      author.firstName ? (author.firstName + (author.middleName ? ` ${author.middleName}` : '')) : ''
    ].filter(Boolean);
    
    return parts.join(', ');
  });
}

/**
 * Helper function to convert a title to a valid filename
 */
function convertToValidFilename(title: string): string {
  // Replace any non-alphanumeric character with underscore
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')        // Replace multiple underscores with a single one
    .replace(/^_|_$/g, '')      // Remove leading/trailing underscores
    .substring(0, 100);         // Limit length to 100 characters
}

// Run the import process
importDocumentPdfs().catch(error => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('Fatal error:', errorMessage);
  process.exit(1);
});
