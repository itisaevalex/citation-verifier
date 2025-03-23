import * as fs from 'fs';
import * as path from 'path';
import { CitationProcessor } from '../GrobID/citation-processor';

/**
 * Extracts references with expanded context from a PDF and saves them to a JSON file
 */
async function extractReferencesWithContext(pdfPath: string, outputPath?: string) {
  console.log('=== Extracting References with Enhanced Context ===');
  
  // 1. Create a processor instance
  const processor = new CitationProcessor();
  
  // 2. Check if GROBID service is available
  console.log('Checking GROBID service...');
  try {
    const serviceAvailable = await processor.checkService();
    if (serviceAvailable) {
      console.log('✅ GROBID service is running');
    } else {
      console.error('❌ GROBID service is not available. Please start the GROBID service.');
      return;
    }
  } catch (error) {
    console.error('❌ Error checking GROBID service:', error);
    return;
  }
  
  // 3. Process the PDF
  try {
    console.log(`Processing PDF: ${pdfPath}`);
    
    const citationData = await processor.processPdf(pdfPath, {
      consolidateCitations: true,
      includeRawCitations: true,
      includeCoordinates: true
    });
    
    console.log(`✅ PDF processed successfully. Found ${citationData.references.length} references used in ${citationData.citationContexts.length} citation contexts.`);
    
    // 4. Create enhanced reference output
    let enhancedReferences = citationData.referenceUsage.map((usage: any) => {
      // For each reference, gather all its usage contexts
      return {
        reference: {
          id: usage.reference.id,
          title: usage.reference.title,
          authors: usage.reference.authors.map((a: any) => 
            a.rawName || `${a.lastName || ''}, ${a.firstName || ''} ${a.middleName || ''}`
          ),
          journal: usage.reference.journal,
          year: usage.reference.date?.substring(0, 4) || '', // Extract year from date
          doi: usage.reference.doi,
          rawText: usage.reference.rawText
        },
        citationCount: usage.usageContexts.length,
        contexts: usage.usageContexts.map((context: any) => {
          // Extract a larger context window (entire paragraph if available)
          return {
            text: context.text,
            page: context.position.page,
            surroundingText: context.surroundingText
          };
        })
      };
    });
    
    // Filter out references with no title or empty authors
    enhancedReferences = enhancedReferences.filter((ref: any) => {
      // Keep references with a non-empty title
      const hasTitle = ref.reference.title && ref.reference.title.trim().length > 10;
      // Or references with authors or a DOI
      const hasAuthors = ref.reference.authors && ref.reference.authors.length > 0;
      const hasDoi = ref.reference.doi && ref.reference.doi.trim().length > 0;
      // Or references that are actually cited
      const isCited = ref.citationCount > 0;
      
      // Check if it's a journal name without actual reference data
      const isJournalName = ref.reference.title?.includes('Wireless Communications and Mobile Computing');
      
      // Keep only quality references
      return (hasTitle && !isJournalName) || (hasAuthors && hasDoi) || isCited;
    });
    
    // Deduplicate references based on title similarity
    const uniqueRefs: any[] = [];
    const titleMap = new Map<string, number>();
    
    enhancedReferences.forEach((ref: any) => {
      // Normalize title for comparison (lowercase, remove punctuation)
      const normalizedTitle = (ref.reference.title || '').toLowerCase()
        .replace(/[^\w\s]/g, '')
        .trim();
      
      if (normalizedTitle.length > 10) { // Only consider substantial titles
        if (titleMap.has(normalizedTitle)) {
          // We found a duplicate! Merge their contexts
          const existingIndex = titleMap.get(normalizedTitle)!;
          const existingRef = uniqueRefs[existingIndex];
          
          // Merge contexts from the duplicate into the existing reference
          existingRef.contexts = [...existingRef.contexts, ...ref.contexts];
          existingRef.citationCount = existingRef.contexts.length;
          
          // Take the most complete data between the two
          if (ref.reference.authors.length > existingRef.reference.authors.length) {
            existingRef.reference.authors = ref.reference.authors;
          }
          if (!existingRef.reference.doi && ref.reference.doi) {
            existingRef.reference.doi = ref.reference.doi;
          }
          if (!existingRef.reference.journal && ref.reference.journal) {
            existingRef.reference.journal = ref.reference.journal;
          }
        } else {
          // New unique reference
          titleMap.set(normalizedTitle, uniqueRefs.length);
          uniqueRefs.push(ref);
        }
      } else {
        // Title too short to reliably deduplicate, just include it
        uniqueRefs.push(ref);
      }
    });
    
    // Sort by citation count (most cited first)
    uniqueRefs.sort((a, b) => b.citationCount - a.citationCount);
    
    // Add metadata about the document
    const referenceOutput = {
      documentTitle: citationData.documentTitle,
      processingDate: new Date().toISOString(),
      totalReferences: uniqueRefs.length,
      totalCitations: citationData.citationContexts.length,
      references: uniqueRefs
    };
    
    // 5. Save to JSON file
    const outputFilePath = outputPath || path.join(
      path.dirname(pdfPath), 
      `${path.basename(pdfPath, '.pdf')}-references.json`
    );
    
    fs.writeFileSync(outputFilePath, JSON.stringify(referenceOutput, null, 2));
    console.log(`✅ Enhanced reference data saved to: ${outputFilePath}`);
    
    return { outputFilePath, referenceCount: uniqueRefs.length };
    
  } catch (error) {
    console.error('❌ Error processing PDF:', error);
    throw error;
  }
}

// Run if this script is executed directly
if (require.main === module) {
  // Check if a PDF path was provided
  if (process.argv.length < 3) {
    console.log('Usage: npx ts-node extract-references.ts <pdf-path> [output-json-path]');
    process.exit(1);
  }
  
  const pdfPath = process.argv[2];
  const outputPath = process.argv.length > 3 ? process.argv[3] : undefined;
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF file not found: ${pdfPath}`);
    process.exit(1);
  }
  
  extractReferencesWithContext(pdfPath, outputPath)
    .then(result => {
      if (result) {
        console.log(`Extracted ${result.referenceCount} references to ${result.outputFilePath}`);
      }
    })
    .catch(error => console.error('Extraction failed:', error));
}

export { extractReferencesWithContext };
