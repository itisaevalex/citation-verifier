import * as fs from 'fs';
import * as path from 'path';
import { CitationProcessor } from './citation-processor';

/**
 * Simple test script to verify GROBID integration
 */
async function testGrobidIntegration(pdfPath: string) {
  console.log('=== GROBID Integration Test ===');
  
  // 1. Create a processor instance
  const processor = new CitationProcessor();
  
  // 2. Check if GROBID service is available
  console.log('Checking GROBID service...');
  try {
    const serviceAvailable = await processor.checkService();
    if (serviceAvailable) {
      console.log('✅ GROBID service is available');
    } else {
      console.error('❌ GROBID service is not available');
      return;
    }
  } catch (error) {
    console.error('❌ Error checking GROBID service:', error);
    return;
  }
  
  // 3. Process the PDF
  try {
    console.log(`Processing PDF: ${pdfPath}`);
    const outputDir = path.join(__dirname, 'output');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const citationData = await processor.processPdf(pdfPath, {
      consolidateCitations: true,
      includeRawCitations: true,
      includeCoordinates: true,
      outputXml: true,
      outputPath: outputDir
    });
    
    console.log('✅ PDF processed successfully');
    console.log(`   - Document title: ${citationData.documentTitle}`);
    console.log(`   - References found: ${citationData.references.length}`);
    console.log(`   - Citation contexts found: ${citationData.citationContexts.length}`);
    
    // 4. Match citations to references
    const citationMap = processor.matchCitationsToReferences(citationData);
    console.log(`   - Matched references with usage contexts: ${citationMap.length}`);
    
    // 5. Output results
    processor.outputCitationData(citationData, outputDir, 'json');
    processor.outputCitationData(citationData, outputDir, 'csv');
    console.log(`✅ Results saved to: ${outputDir}`);
    
    // 6. Show sample data
    if (citationData.references.length > 0) {
      console.log('\nSample Reference:');
      const sampleRef = citationData.references[0];
      console.log(`   - ID: ${sampleRef.id}`);
      console.log(`   - Title: ${sampleRef.title || 'N/A'}`);
      console.log(`   - Authors: ${sampleRef.authors.map(a => a.rawName || `${a.lastName}, ${a.firstName}`).join('; ')}`);
      console.log(`   - DOI: ${sampleRef.doi || 'N/A'}`);
    }
    
    if (citationData.citationContexts.length > 0) {
      console.log('\nSample Citation Context:');
      const sampleContext = citationData.citationContexts[0];
      console.log(`   - ID: ${sampleContext.id}`);
      console.log(`   - Text: ${sampleContext.text}`);
      console.log(`   - Reference IDs: ${sampleContext.referenceIds.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Error processing PDF:', error);
  }
}

// Execute the test if this script is run directly
if (require.main === module) {
  // Check if a PDF path was provided
  if (process.argv.length < 3) {
    console.log('Usage: ts-node test-script.ts <pdf-path>');
    process.exit(1);
  }
  
  const pdfPath = process.argv[2];
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF file not found: ${pdfPath}`);
    process.exit(1);
  }
  
  testGrobidIntegration(pdfPath)
    .then(() => console.log('Test completed'))
    .catch(error => console.error('Test failed:', error));
}