import { CitationData, CitationProcessor } from './citation-processor';
import { BibReference, CitationContext } from './citation-parser';
import axios from 'axios';

interface GeminiConfig {
  apiKey: string;
  apiEndpoint?: string;
}

interface CitationAnalysis {
  citationType: 'direct_quote' | 'paraphrase' | 'general_reference';
  accuracy: number; // 0-100%
  description: string;
  citationContext: CitationContext;
  matchedReference: BibReference | null;
}

class GeminiCitationVerifier {
  private apiKey: string;
  private apiEndpoint: string;

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.apiEndpoint = config.apiEndpoint || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
  }

  /**
   * Analyze a citation context to determine its type and accuracy
   */
  async analyzeCitation(
    citationContext: CitationContext,
    matchedReferences: BibReference[],
    surroundingParagraph?: string
  ): Promise<CitationAnalysis> {
    // Prepare the prompt for Gemini API
    const prompt = this.buildAnalysisPrompt(citationContext, matchedReferences, surroundingParagraph);
    
    try {
      // Call Gemini API
      const response = await axios.post(
        `${this.apiEndpoint}?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024
          }
        }
      );
      
      // Process the response
      return this.parseGeminiResponse(response.data, citationContext, matchedReferences[0] || null);
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw error;
    }
  }

  /**
   * Process a full document's citation data
   */
  async verifyDocument(citationData: CitationData): Promise<CitationAnalysis[]> {
    const results: CitationAnalysis[] = [];
    
    // Create reference map for quick lookup
    const referencesById = new Map<string, BibReference>();
    citationData.references.forEach(ref => referencesById.set(ref.id, ref));
    
    // Process each citation context
    for (const context of citationData.citationContexts) {
      // Find matching references
      const matchedRefs = context.referenceIds
        .map(id => referencesById.get(id))
        .filter(ref => ref !== undefined) as BibReference[];
      
      // Skip if no matching references
      if (matchedRefs.length === 0) {
        console.warn(`Citation context ${context.id} has no matching references`);
        continue;
      }
      
      // Analyze the citation
      try {
        const analysis = await this.analyzeCitation(context, matchedRefs);
        results.push(analysis);
      } catch (error) {
        console.error(`Error analyzing citation context ${context.id}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Build a prompt for Gemini to analyze citation context
   */
  private buildAnalysisPrompt(
    citationContext: CitationContext, 
    matchedReferences: BibReference[],
    surroundingParagraph?: string
  ): string {
    const mainRef = matchedReferences[0];
    
    return `
You are a scientific citation verification assistant. Analyze the following citation context and determine if it is a direct quote, paraphrase, or general reference.

CITATION CONTEXT:
"${citationContext.text}"

${surroundingParagraph ? `SURROUNDING PARAGRAPH:\n"${surroundingParagraph}"\n` : ''}

REFERENCED WORK:
- Title: ${mainRef?.title || 'Unknown'}
- Authors: ${mainRef?.authors.map(a => `${a.lastName || ''}, ${a.firstName || ''}`).join('; ') || 'Unknown'}
- Publication Date: ${mainRef?.date || 'Unknown'}
- DOI: ${mainRef?.doi || 'N/A'}

Please determine:
1. Is this a direct quote (exact text from the source), a paraphrase (reworded content from the source), or a general reference (mentioning the source without specific content)?
2. How accurately does the citation represent the source? Give a percentage 0-100%.
3. Provide a brief explanation for your determination.

Format your response exactly as follows:
CITATION_TYPE: [direct_quote|paraphrase|general_reference]
ACCURACY: [0-100]
EXPLANATION: [Your explanation]
`;
  }

  /**
   * Parse the Gemini API response
   */
  private parseGeminiResponse(
    response: any,
    citationContext: CitationContext,
    matchedReference: BibReference | null
  ): CitationAnalysis {
    // Default values
    let citationType: 'direct_quote' | 'paraphrase' | 'general_reference' = 'general_reference';
    let accuracy = 0;
    let description = 'Unable to determine';
    
    // Extract the text from the Gemini response
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Parse the response
    const typeMatch = text.match(/CITATION_TYPE:\s*(direct_quote|paraphrase|general_reference)/i);
    if (typeMatch) {
      citationType = typeMatch[1] as 'direct_quote' | 'paraphrase' | 'general_reference';
    }
    
    const accuracyMatch = text.match(/ACCURACY:\s*(\d+)/i);
    if (accuracyMatch) {
      accuracy = Math.min(100, Math.max(0, parseInt(accuracyMatch[1], 10)));
    }
    
    const explanationMatch = text.match(/EXPLANATION:\s*([\s\S]+)$/i);
    if (explanationMatch) {
      description = explanationMatch[1].trim();
    }
    
    return {
      citationType,
      accuracy,
      description,
      citationContext,
      matchedReference
    };
  }
}

/**
 * Example usage
 */
async function main() {
  if (process.argv.length < 4) {
    console.log('Usage: ts-node gemini-integration.ts <pdf-path> <gemini-api-key>');
    process.exit(1);
  }
  
  const pdfPath = process.argv[2];
  const apiKey = process.argv[3];
  
  // Initialize the citation processor
  const processor = new CitationProcessor();
  
  try {
    // Check GROBID service
    const serviceAvailable = await processor.checkService();
    if (!serviceAvailable) {
      console.error('GROBID service is not available. Please ensure it is running.');
      process.exit(1);
    }
    
    console.log('Processing PDF with GROBID...');
    // Extract citation data using GROBID
    const citationData = await processor.processPdf(pdfPath, {
      consolidateCitations: true,
      includeRawCitations: true,
      includeCoordinates: true
    });
    
    console.log(`Extracted ${citationData.references.length} references and ${citationData.citationContexts.length} citation contexts`);
    
    // Initialize Gemini verifier
    const verifier = new GeminiCitationVerifier({ apiKey });
    
    console.log('Analyzing citations with Gemini...');
    // Analyze citations
    const results = await verifier.verifyDocument(citationData);
    
    // Output results
    console.log('\n=== Citation Verification Results ===\n');
    for (const result of results) {
      console.log(`Citation ID: ${result.citationContext.id}`);
      console.log(`Text: "${result.citationContext.text}"`);
      console.log(`Type: ${result.citationType}`);
      console.log(`Accuracy: ${result.accuracy}%`);
      console.log(`Notes: ${result.description}`);
      console.log('---');
    }
    
    // Summary statistics
    const directQuotes = results.filter(r => r.citationType === 'direct_quote').length;
    const paraphrases = results.filter(r => r.citationType === 'paraphrase').length;
    const generalRefs = results.filter(r => r.citationType === 'general_reference').length;
    
    console.log('\n=== Summary ===');
    console.log(`Total citations analyzed: ${results.length}`);
    console.log(`Direct quotes: ${directQuotes}`);
    console.log(`Paraphrases: ${paraphrases}`);
    console.log(`General references: ${generalRefs}`);
    console.log(`Average accuracy: ${results.reduce((sum, r) => sum + r.accuracy, 0) / results.length}%`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { GeminiCitationVerifier, CitationAnalysis };
