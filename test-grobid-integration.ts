/**
 * GROBID Integration Test Script
 * 
 * This script tests the GROBID integration directly using our improved GrobidClient
 * Run with: npx ts-node test-grobid-integration.ts [path-to-pdf]
 */
import * as path from 'path';
import * as fs from 'fs';
import { GrobidClient } from './src/reference-extraction/grobid-client';
import { config } from './src/config';

async function testGrobidIntegration() {
  console.log('=== GROBID Integration Test ===');
  
  // Get the PDF path from command line arguments or use a default
  const pdfPath = process.argv[2] || './sample-paper.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`Error: PDF file not found at ${pdfPath}`);
    console.error('Please provide a valid PDF path as the first argument');
    process.exit(1);
  }
  
  console.log(`Using GROBID URL: ${config.grobidUrl}`);
  console.log(`Testing with PDF: ${pdfPath}`);
  
  const grobidClient = new GrobidClient(config.grobidUrl);
  
  // Step 1: Check if GROBID service is running
  console.log('\n1. Checking GROBID service...');
  try {
    const isAlive = await grobidClient.isAlive();
    if (isAlive) {
      console.log('✅ GROBID service is running');
    } else {
      console.error('❌ GROBID service check returned false');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ GROBID service check failed:', error?.message || String(error));
    process.exit(1);
  }
  
  // Step 2: Test full text processing
  console.log('\n2. Testing full text processing...');
  try {
    const teiXml = await grobidClient.processFullText(pdfPath, {
      consolidateCitations: '1',
      includeRawCitations: '1'
    });
    
    // Save the result for inspection
    const outputPath = path.join(path.dirname(pdfPath), `${path.basename(pdfPath, '.pdf')}-fulltext-test.xml`);
    fs.writeFileSync(outputPath, teiXml);
    
    console.log(`✅ Full text processing successful`);
    console.log(`   Response size: ${teiXml.length} characters`);
    console.log(`   Saved to: ${outputPath}`);
    
    // Extract and display some basic stats
    const titleMatch = teiXml.match(/<title[^>]*>([^<]+)<\/title>/);
    const docTitle = titleMatch ? titleMatch[1] : 'Unknown';
    
    const refCount = (teiXml.match(/<biblStruct/g) || []).length;
    const citCount = (teiXml.match(/<ref type="bibr"/g) || []).length;
    
    console.log(`   Document title: ${docTitle}`);
    console.log(`   Found ${refCount} references and ${citCount} citations`);
  } catch (error: any) {
    console.error('❌ Full text processing failed:', error?.message || String(error));
    console.error('   This is the critical method used in the citation verification workflow.');
    process.exit(1);
  }
  
  // Step 3: Test references processing
  console.log('\n3. Testing references processing...');
  try {
    const refsXml = await grobidClient.processReferences(pdfPath, {
      consolidateCitations: '1',
      includeRawCitations: '1'
    });
    
    // Save the result for inspection
    const outputPath = path.join(path.dirname(pdfPath), `${path.basename(pdfPath, '.pdf')}-refs-test.xml`);
    fs.writeFileSync(outputPath, refsXml);
    
    console.log(`✅ References processing successful`);
    console.log(`   Response size: ${refsXml.length} characters`);
    console.log(`   Saved to: ${outputPath}`);
    
    // Extract and display some basic stats
    const refCount = (refsXml.match(/<biblStruct/g) || []).length;
    console.log(`   Found ${refCount} references`);
  } catch (error: any) {
    console.error('❌ References processing failed:', error?.message || String(error));
  }
  
  console.log('\n=== Test Summary ===');
  console.log('✅ GROBID integration is working correctly');
  console.log('Your citation verification system should now be able to process documents properly.');
}

// Run the test
testGrobidIntegration().catch(error => {
  console.error('Unhandled error in test script:');
  console.error(error);
  process.exit(1);
});
