import * as fs from 'fs';
import * as path from 'path';
import { GrobidClient } from './grobid-client';
import { CitationParser, BibReference, CitationContext } from './citation-parser';

/**
 * Interface representing the full citation data extracted from a document
 */
export interface CitationData {
  documentTitle: string;
  references: BibReference[];
  citationContexts: CitationContext[];
  referenceUsage: ReferenceUsage[];
}

/**
 * Interface representing a reference and all its usage contexts in the document
 */
export interface ReferenceUsage {
  reference: BibReference;
  usageContexts: CitationContext[];
}

/**
 * Class for extracting and processing citations from PDF documents
 */
export class CitationProcessor {
  private grobidClient: GrobidClient;
  
  /**
   * Creates a new CitationProcessor
   * @param grobidUrl URL of the GROBID service
   */
  constructor(grobidUrl: string = 'http://localhost:8070') {
    this.grobidClient = new GrobidClient(grobidUrl);
  }

  /**
   * Check if the GROBID service is available
   * @returns Promise that resolves to true if service is available
   */
  async checkService(): Promise<boolean> {
    return this.grobidClient.isAlive();
  }

  /**
   * Process a PDF document to extract citations
   * @param pdfPath Path to the PDF file
   * @param options Processing options
   * @returns Promise resolving to the extracted citation data
   */
  async processPdf(
    pdfPath: string,
    options: {
      consolidateCitations?: boolean,
      includeRawCitations?: boolean,
      includeCoordinates?: boolean,
      outputXml?: boolean,
      outputPath?: string
    } = {}
  ): Promise<CitationData> {
    console.log(`Processing PDF: ${pdfPath}`);
    
    // Set up processing options
    const grobidOptions = {
      consolidateCitations: options.consolidateCitations ? '1' as const : '0' as const,
      includeRawCitations: options.includeRawCitations ? '1' as const : '0' as const,
      teiCoordinates: options.includeCoordinates ? ['ref', 'biblStruct'] : undefined
    };
    
    // Process the PDF to get TEI XML
    const teiXml = await this.grobidClient.processFullText(pdfPath, grobidOptions);
    
    // Save the XML output if requested
    if (options.outputXml && options.outputPath) {
      const outputFile = path.join(options.outputPath, `${path.basename(pdfPath, '.pdf')}.tei.xml`);
      fs.writeFileSync(outputFile, teiXml);
      console.log(`TEI XML saved to: ${outputFile}`);
    }
    
    // Extract document title
    const titleMatch = teiXml.match(/<title[^>]*>([^<]+)<\/title>/);
    const documentTitle = titleMatch ? titleMatch[1] : path.basename(pdfPath, '.pdf');
    
    return this.processTeiXml(teiXml, documentTitle);
  }

  /**
   * Process a TEI XML string to extract citation data
   * @param teiXml The TEI XML string from GROBID
   * @param documentTitle Optional document title
   * @returns Extracted citation data
   */
  processTeiXml(teiXml: string, documentTitle = ''): CitationData {
    const parser = new CitationParser(teiXml);
    const references = parser.extractReferences();
    const citationContexts = parser.extractCitationContexts();
    
    // Build the citation data structure
    const citationData: CitationData = {
      documentTitle,
      references,
      citationContexts,
      referenceUsage: [] // Initialize with empty array
    };
    
    // Generate the reference usage data
    citationData.referenceUsage = this.matchCitationsToReferences(citationData);
    
    return citationData;
  }

  /**
   * Match citation contexts to their referenced bibliographic entries
   * @param citationData The citation data
   * @returns Array of reference usage data
   */
  matchCitationsToReferences(citationData: CitationData): ReferenceUsage[] {
    const referencesById = new Map<string, BibReference>();
    
    // Create a map of references by ID for quick lookup
    for (const ref of citationData.references) {
      if (ref.id) {
        referencesById.set(ref.id, ref);
      }
    }
    
    // Match each citation context to its references
    const referenceUsage: ReferenceUsage[] = [];
    
    // First create entries for all references, even those without citations
    for (const ref of citationData.references) {
      if (ref.id) {
        referenceUsage.push({
          reference: ref,
          usageContexts: []
        });
      }
    }
    
    // Then add citation contexts to the appropriate reference usages
    for (const context of citationData.citationContexts) {
      // Each citation context may reference multiple bibliography items
      for (const refId of context.referenceIds) {
        // Find the corresponding reference usage entry
        const existingRefUsageIndex = referenceUsage.findIndex(ru => ru.reference.id === refId);
        
        if (existingRefUsageIndex >= 0) {
          // Add this context to its usage list
          referenceUsage[existingRefUsageIndex].usageContexts.push(context);
        }
      }
    }
    
    return referenceUsage;
  }

  /**
   * Output citation data in a structured format
   * @param citationData The citation data
   * @param outputPath Path to save the output
   * @param format Output format (json or csv)
   */
  outputCitationData(
    citationData: CitationData, 
    outputPath: string,
    format: 'json' | 'csv' = 'json'
  ): void {
    const outputFile = path.join(
      outputPath, 
      `${citationData.documentTitle.replace(/[^\w\s]/g, '')}_citations.${format}`
    );
    
    if (format === 'json') {
      fs.writeFileSync(outputFile, JSON.stringify(citationData, null, 2));
    } else {
      // CSV format
      const csvRows: string[] = ['Context ID,Citation Text,Reference Title,Authors,DOI'];
      
      const citationMap = this.matchCitationsToReferences(citationData);
      citationMap.forEach((refs) => {
        for (const ref of refs.usageContexts) {
          const authorNames = refs.reference.authors.map(a => 
            a.rawName || `${a.lastName || ''}, ${a.firstName || ''} ${a.middleName || ''}`
          ).join('; ');
          
          csvRows.push([
            ref.id,
            `"${ref.text.replace(/"/g, '""')}"`,
            `"${refs.reference.title?.replace(/"/g, '""') || ''}"`,
            `"${authorNames.replace(/"/g, '""')}"`,
            refs.reference.doi || ''
          ].join(','));
        }
      });
      
      fs.writeFileSync(outputFile, csvRows.join('\n'));
    }
    
    console.log(`Citation data saved to: ${outputFile}`);
  }
}
