import fs from 'fs';
import path from 'path';
import { CitationParser } from '../GrobID/citation-parser';
import { CitationProcessor } from '../GrobID/citation-processor';

// Function to run the test
async function testCitationParser() {
  console.log('=== Testing Citation Parser ===\n');
  
  try {
    // Step 1: First check if GROBID is running
    console.log('Step 1: Checking GROBID service...');
    const processor = new CitationProcessor();
    const isAlive = await processor.checkService();
    
    if (!isAlive) {
      console.error('❌ GROBID service is not running. Please start GROBID first.');
      process.exit(1);
    }
    
    console.log('✅ GROBID service is running');
    
    // Step 2: Process a sample PDF if specified as argument
    const pdfPath = process.argv[2];
    if (!pdfPath) {
      console.log('\n❌ No PDF file specified. Please provide a PDF path as an argument.');
      console.log('Usage: npx ts-node test-citation-parser.ts /path/to/paper.pdf');
      process.exit(1);
    }
    
    if (!fs.existsSync(pdfPath)) {
      console.error(`❌ File not found: ${pdfPath}`);
      process.exit(1);
    }
    
    console.log(`\nStep 2: Processing PDF file: ${pdfPath}`);
    
    // Process the PDF and get the citation data
    const citationData = await processor.processPdf(pdfPath, {
      consolidateCitations: true,
      includeRawCitations: true
    });
    
    // Step 3: Analyze the results
    console.log('\nStep 3: Analyzing extracted citation data\n');
    
    console.log(`Extracted ${citationData.citationContexts.length} citation contexts:\n`);
    citationData.citationContexts.slice(0, 5).forEach((citation, index) => {
      console.log(`[${index + 1}] Citation: "${citation.text}"`);
      console.log(`   References: ${citation.referenceIds.join(', ')}`);
      console.log(`   Page: ${citation.position.page}`);
      // Show a snippet of surrounding text (first 75 characters)
      const surroundingPreview = citation.surroundingText.length > 75 
        ? citation.surroundingText.substring(0, 75) + '...' 
        : citation.surroundingText;
      console.log(`   Context: "${surroundingPreview}"`);
      console.log();
    });
    
    if (citationData.citationContexts.length > 5) {
      console.log(`   ... and ${citationData.citationContexts.length - 5} more citations\n`);
    }
    
    console.log(`Extracted ${citationData.references.length} bibliographic references:\n`);
    citationData.references.slice(0, 5).forEach((ref, index) => {
      console.log(`[${index + 1}] Reference ID: ${ref.id}`);
      console.log(`   Title: ${ref.title}`);
      console.log(`   Authors: ${ref.authors.map(a => a.lastName).join(', ')}`);
      console.log(`   Journal: ${ref.journal}`);
      console.log();
    });
    
    if (citationData.references.length > 5) {
      console.log(`   ... and ${citationData.references.length - 5} more references\n`);
    }
    
    // Show reference usage examples
    console.log(`Reference usage examples:\n`);
    citationData.referenceUsage.slice(0, 3).forEach((usage, index) => {
      console.log(`[${index + 1}] Reference: "${usage.reference.title}"`);
      console.log(`   Used ${usage.usageContexts.length} time(s) in the document:`);
      usage.usageContexts.slice(0, 2).forEach((context, i) => {
        // Show a snippet of the context
        const contextPreview = context.surroundingText.length > 100 
          ? context.surroundingText.substring(0, 100) + '...' 
          : context.surroundingText;
        console.log(`   ${i+1}. Page ${context.position.page}: "${contextPreview}"`);
      });
      if (usage.usageContexts.length > 2) {
        console.log(`   ... and ${usage.usageContexts.length - 2} more usage contexts`);
      }
      console.log();
    });
    
    console.log('\n✅ Citation parser test completed successfully!');
    
    // Optionally save the citation data to a JSON file for inspection
    const outputJsonPath = path.join(__dirname, 'citation-data-output.json');
    fs.writeFileSync(outputJsonPath, JSON.stringify(citationData, null, 2));
    console.log(`\nCitation data saved to: ${outputJsonPath}`);
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

// Run the test
testCitationParser();
