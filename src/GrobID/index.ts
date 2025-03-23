import { GrobidClient } from './grobid-client';
import { CitationParser, BibReference, CitationContext } from './citation-parser';
import { CitationProcessor, CitationData } from './citation-processor';

// Export all components
export {
  GrobidClient,
  CitationParser,
  CitationProcessor,
  BibReference,
  CitationContext,
  CitationData
};

// Main function to be executed when run directly
async function main() {
  // Check command line arguments
  if (process.argv.length < 3) {
    console.log('Usage: npm start -- <pdf-path> [output-path]');
    process.exit(1);
  }
  
  const pdfPath = process.argv[2];
  const outputPath = process.argv[3] || './output';
  
  // Create a citation processor instance
  const processor = new CitationProcessor();
  
  try {
    // Check if GROBID service is available
    const serviceAvailable = await processor.checkService();
    if (!serviceAvailable) {
      console.error('GROBID service is not available. Please ensure the service is running.');
      process.exit(1);
    }
    
    // Process the PDF
    const citationData = await processor.processPdf(pdfPath, {
      consolidateCitations: true,
      includeRawCitations: true,
      includeCoordinates: true,
      outputXml: true,
      outputPath
    });
    
    // Output the data
    processor.outputCitationData(citationData, outputPath, 'json');
    processor.outputCitationData(citationData, outputPath, 'csv');
    
    console.log(`
Processing completed successfully!
- Document: ${citationData.documentTitle}
- References extracted: ${citationData.references.length}
- Citation contexts found: ${citationData.citationContexts.length}
- Output saved to: ${outputPath}
    `);
  } catch (error) {
    console.error('Error processing PDF:', error);
    process.exit(1);
  }
}

// Run the main function if this script is executed directly
if (require.main === module) {
  main();
}