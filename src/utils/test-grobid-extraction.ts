#!/usr/bin/env ts-node
import * as path from 'path';
import * as fs from 'fs';
import { GrobidClient } from '../reference-extraction/grobid-client';

/**
 * Test GROBID PDF processing directly
 */
async function testGrobidExtraction() {
  console.log('===== Testing GROBID PDF Extraction =====\n');
  
  // Set up paths
  const basePath = process.cwd();
  const samplesDir = path.join(basePath, 'samples');
  
  // Check if samples directory exists, if not create it
  if (!fs.existsSync(samplesDir)) {
    fs.mkdirSync(samplesDir, { recursive: true });
    console.log(`Created samples directory: ${samplesDir}`);
  }
  
  // Try to find sample PDFs
  console.log('Looking for sample PDFs...');
  const possiblePaths = [
    path.join(samplesDir, 'sample-paper.pdf'),
    path.join(basePath, 'sample-paper.pdf')
  ];
  
  let pdfPaths = [];
  for (const pdfPath of possiblePaths) {
    if (fs.existsSync(pdfPath)) {
      pdfPaths.push(pdfPath);
      console.log(`✅ Found PDF: ${pdfPath}`);
    }
  }
  
  if (pdfPaths.length === 0) {
    console.log('❌ No sample PDFs found. Please add a PDF to the samples directory.');
    return;
  }
  
  // Initialize GROBID client
  console.log('\nInitializing GROBID client...');
  const grobidUrl = process.env.GROBID_URL || 'http://localhost:8070';
  const client = new GrobidClient(grobidUrl);
  
  // Check if GROBID is running
  console.log('Checking if GROBID service is running...');
  const isAlive = await client.isAlive();
  
  if (!isAlive) {
    console.log('❌ GROBID service is not running. Please start the GROBID service.');
    return;
  }
  
  console.log('✅ GROBID service is running.');
  
  // Test PDF processing with each found PDF
  for (const pdfPath of pdfPaths) {
    console.log(`\nProcessing PDF: ${pdfPath}`);
    try {
      // First try to extract only references (less intensive operation)
      console.log('Extracting references only...');
      const referencesData = await client.processReferences(pdfPath);
      
      // Save the references XML to a file for inspection
      const refsOutputPath = pdfPath.replace('.pdf', '-refs.xml');
      fs.writeFileSync(refsOutputPath, referencesData);
      console.log(`✅ Successfully extracted references and saved to: ${refsOutputPath}`);
      
      // Count references in the XML
      const refMatches = referencesData.match(/<biblStruct[^>]*>/g);
      const refCount = refMatches ? refMatches.length : 0;
      console.log(`Found ${refCount} bibliographic references`);
      
      // Try to process the full text - this might fail on larger documents
      console.log('\nExtracting full text and references...');
      try {
        const teiXml = await client.processFullText(pdfPath);
        
        // Save the TEI XML to a file for inspection
        const fullOutputPath = pdfPath.replace('.pdf', '-tei.xml');
        fs.writeFileSync(fullOutputPath, teiXml);
        console.log(`✅ Successfully processed full PDF and saved TEI XML to: ${fullOutputPath}`);
        
        // Count citation contexts in the XML
        const citationMatches = teiXml.match(/<ref type="bibr"[^>]*>/g);
        const citationCount = citationMatches ? citationMatches.length : 0;
        console.log(`Found ${citationCount} citation contexts`);
      } catch (fullTextError) {
        console.error('❌ Error processing full text (this is common for large PDFs)');
        console.error('Error details:', fullTextError instanceof Error ? fullTextError.message : String(fullTextError));
        console.log('The references extraction was still successful, which may be sufficient for citation verification.');
      }
    } catch (error) {
      console.error(`❌ Error processing PDF: ${pdfPath}`);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
      
      // If this is an Axios error with a response, log more details
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        if (axiosError.response) {
          console.error('Response status:', axiosError.response.status);
          console.error('Response data:', axiosError.response.data);
          
          // Provide troubleshooting advice based on the error
          if (axiosError.response.status === 500) {
            console.error('\nTroubleshooting advice for 500 error:');
            console.error('1. Verify the PDF is not corrupted or password-protected');
            console.error('2. Ensure the GROBID service has enough memory allocated');
            console.error('3. Try with a different PDF file to isolate the issue');
          }
        }
      }
    }
  }
  
  console.log('\n===== GROBID Extraction Test Complete =====');
}

// Run the test
testGrobidExtraction().catch(error => {
  console.error('Unhandled error:', error);
});
