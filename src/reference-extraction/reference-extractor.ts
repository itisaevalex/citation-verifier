import * as fs from 'fs';
import * as path from 'path';
import { CitationProcessor, CitationData, ReferenceUsage } from './citation-processor';

/**
 * Interface for enhanced reference output
 */
export interface EnhancedReference {
  reference: {
    id: string;
    title: string;
    authors: string[];
    journal?: string;
    year: string;
    doi?: string;
    rawText?: string;
  };
  citationCount: number;
  contexts: Array<{
    text: string;
    page: number;
    surroundingText: string;
  }>;
  // Direct access properties for easier use in citation verifier
  title: string;
  authors: string[];
  year?: string;
  doi?: string;
  citationContext?: string; // The most relevant context from all contexts
}

/**
 * Class for extracting references from PDF documents
 */
export class ReferenceExtractor {
  private citationProcessor: CitationProcessor;
  
  /**
   * Creates a new ReferenceExtractor
   * @param grobidUrl URL of the GROBID service
   */
  constructor(grobidUrl: string = 'http://localhost:8070') {
    this.citationProcessor = new CitationProcessor(grobidUrl);
  }
  
  /**
   * Check if the GROBID service is available
   * @returns Promise that resolves to true if service is available
   */
  async checkService(): Promise<boolean> {
    return this.citationProcessor.checkService();
  }
  
  /**
   * Extract references with enhanced context from a PDF
   * @param pdfPath Path to the PDF file
   * @param options Processing options
   * @returns Promise resolving to the enhanced references
   */
  async extractReferencesWithContext(
    pdfPath: string,
    options: {
      consolidateCitations?: boolean;
      includeRawCitations?: boolean;
      includeCoordinates?: boolean;
    } = {}
  ): Promise<EnhancedReference[]> {
    console.log(`Processing PDF: ${pdfPath}`);
    
    // Process the PDF with GROBID
    const citationData = await this.citationProcessor.processPdf(pdfPath, {
      consolidateCitations: options.consolidateCitations ?? true,
      includeRawCitations: options.includeRawCitations ?? true,
      includeCoordinates: options.includeCoordinates ?? true
    });
    
    console.log(`✅ PDF processed successfully. Found ${citationData.references.length} references used in ${citationData.citationContexts.length} citation contexts.`);
    
    // Create enhanced reference output
    return this.createEnhancedReferences(citationData);
  }
  
  /**
   * Create enhanced references from citation data
   * @param citationData The citation data from GROBID
   * @returns Enhanced references
   */
  private createEnhancedReferences(citationData: CitationData): EnhancedReference[] {
    // Map references to enhanced format
    let enhancedReferences = citationData.referenceUsage.map((usage: ReferenceUsage) => {
      // For each reference, gather all its usage contexts
      return {
        reference: {
          id: usage.reference.id,
          title: usage.reference.title || '',
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
        }),
        title: usage.reference.title || '',
        authors: usage.reference.authors.map((a: any) => 
          a.rawName || `${a.lastName || ''}, ${a.firstName || ''} ${a.middleName || ''}`
        ),
        year: usage.reference.date?.substring(0, 4),
        doi: usage.reference.doi,
        citationContext: usage.usageContexts.length > 0 ? usage.usageContexts[0].surroundingText : undefined
      };
    });
    
    // Filter out references with no title or empty authors
    enhancedReferences = enhancedReferences.filter((ref: EnhancedReference) => {
      // Keep references with a non-empty title
      const hasTitle = ref.reference.title && ref.reference.title.trim().length > 10;
      // Or references with authors or a DOI
      const hasAuthors = ref.reference.authors && ref.reference.authors.length > 0;
      const hasDoi = ref.reference.doi && ref.reference.doi.trim().length > 0;
      
      return hasTitle || (hasAuthors && hasDoi);
    });
    
    // Deduplicate references by title
    const deduplicatedReferences = this.deduplicateReferences(enhancedReferences);
    
    return deduplicatedReferences;
  }
  
  /**
   * Deduplicate references by title
   * @param references References to deduplicate
   * @returns Deduplicated references
   */
  private deduplicateReferences(references: EnhancedReference[]): EnhancedReference[] {
    const uniqueRefs: EnhancedReference[] = [];
    const titleMap = new Map<string, number>();
    
    references.forEach((ref: EnhancedReference) => {
      // Normalize title for comparison (lowercase, remove punctuation)
      const normalizedTitle = (ref.reference.title || '').toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (normalizedTitle && normalizedTitle.length > 10) {
        if (titleMap.has(normalizedTitle)) {
          // If we already have this reference, merge the contexts
          const existingIndex = titleMap.get(normalizedTitle)!;
          const existingRef = uniqueRefs[existingIndex];
          
          // Merge citation count
          existingRef.citationCount += ref.citationCount;
          
          // Merge contexts
          existingRef.contexts.push(...ref.contexts);
          
          // If the existing reference is missing a DOI but this one has it, use this one's DOI
          if (!existingRef.reference.doi && ref.reference.doi) {
            existingRef.reference.doi = ref.reference.doi;
          }
          if (!existingRef.doi && ref.doi) {
            existingRef.doi = ref.doi;
          }
          if (!existingRef.citationContext && ref.citationContext) {
            existingRef.citationContext = ref.citationContext;
          }
        } else {
          // New unique reference
          titleMap.set(normalizedTitle, uniqueRefs.length);
          uniqueRefs.push(ref);
        }
      } else {
        // If title is empty or too short, just add it
        uniqueRefs.push(ref);
      }
    });
    
    return uniqueRefs;
  }
  
  /**
   * Save enhanced references to a JSON file
   * @param references Enhanced references to save
   * @param outputPath Path to save the output, defaults to the same directory as the PDF
   * @param pdfPath Path to the PDF file
   * @returns Path to the saved file
   */
  saveReferences(
    references: EnhancedReference[],
    pdfPath: string,
    outputPath?: string
  ): string {
    // If no output path provided, use the same directory as the PDF
    const finalOutputPath = outputPath || path.dirname(pdfPath);
    
    // Create output filename based on PDF name
    const pdfBaseName = path.basename(pdfPath, '.pdf');
    const outputFile = path.join(finalOutputPath, `${pdfBaseName}-references.json`);
    
    // Write the output
    fs.writeFileSync(outputFile, JSON.stringify(references, null, 2));
    console.log(`✅ Enhanced reference data saved to: ${outputFile}`);
    
    return outputFile;
  }
}
