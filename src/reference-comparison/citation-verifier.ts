import { Document, DocumentLoader } from './document-loader';
import { EnhancedReference } from '../reference-extraction/reference-extractor';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config, MissingReferenceHandling } from '../config';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

/**
 * Interface for verification result
 */
export interface VerificationResult {
  citationContext: string;
  referenceTitle: string;
  isVerified: boolean;
  confidenceScore: number; // 0-1
  matchLocation?: string;
  explanation: string;
  referenceFound: boolean; // Whether the reference document was found in the database
}

/**
 * Interface for the overall verification report
 */
export interface VerificationReport {
  documentTitle: string;
  totalCitationsChecked: number;
  verifiedCitations: number;
  unverifiedCitations: number;
  inconclusiveCitations: number;
  missingReferences: number; // Count of references not found in the database
  results: VerificationResult[];
}

/**
 * Options for citation verification
 */
export interface VerificationOptions {
  missingRefHandling?: MissingReferenceHandling;
  confidenceThreshold?: number;
  saveIntermediateResults?: boolean;
  verbose?: boolean;
}

/**
 * Interface for tracking verification progress
 */
export interface VerificationProgress {
  currentReference: string;
  currentIndex: number;
  totalReferences: number;
  processedReferences: Reference[];
  status: 'processing' | 'completed' | 'error';
  error?: string;
}

/**
 * Interface for a processed reference with verification status
 */
export interface Reference {
  id: string;
  title: string;
  status: 'valid' | 'invalid' | 'uncertain';
  link: string;
}

/**
 * Class for verifying citation accuracy using Google's Generative AI
 */
export class CitationVerifier {
  private documentLoader: DocumentLoader;
  private genAI: GoogleGenerativeAI;
  private options: VerificationOptions;
  private progressCallback?: (progress: VerificationProgress) => void;
  
  /**
   * Creates a new CitationVerifier
   * @param documentDatabaseDir Directory where the documents are stored
   * @param options Verification options
   * @param progressCallback Optional callback for reporting progress
   */
  constructor(
    documentDatabaseDir: string = config.documentDbPath,
    options: VerificationOptions = {},
    progressCallback?: (progress: VerificationProgress) => void
  ) {
    this.documentLoader = new DocumentLoader(documentDatabaseDir);
    this.genAI = new GoogleGenerativeAI(config.googleApiKey);
    this.progressCallback = progressCallback;
    
    // Set default options
    this.options = {
      missingRefHandling: options.missingRefHandling || config.missingRefHandling,
      confidenceThreshold: options.confidenceThreshold || 0.7,
      saveIntermediateResults: options.saveIntermediateResults || false,
      verbose: options.verbose || false
    };
    
    // Validate API key
    if (!config.googleApiKey) {
      console.warn('WARNING: No Google/Gemini API key found. Citation verification will be limited.');
      console.warn('Please set GOOGLE_API_KEY or GEMINI_API_KEY in your .env file.');
    }
  }

  /**
   * Set a progress callback after initialization
   * @param callback The progress callback function
   */
  setProgressCallback(callback: (progress: VerificationProgress) => void) {
    this.progressCallback = callback;
  }
  
  /**
   * Verify all citations in a document against the document database
   * @param references Enhanced references with citation contexts
   * @param documentTitle Title of the document being verified
   * @returns Verification report
   */
  async verifyAllCitations(
    references: EnhancedReference[],
    documentTitle: string
  ): Promise<VerificationReport> {
    console.log(`Verifying citations for document: ${documentTitle}`);
    console.log(`Found ${references.length} references to verify`);
    
    const results: VerificationResult[] = [];
    let verifiedCount = 0;
    let unverifiedCount = 0;
    let inconclusiveCount = 0;
    let missingRefCount = 0;
    
    // Create array to track processed references for progress updates
    const processedRefs: Reference[] = [];
    
    for (let i = 0; i < references.length; i++) {
      const reference = references[i];
      console.log(`Processing reference: ${reference.title}`);
      
      // Report progress before processing this reference
      if (this.progressCallback) {
        this.progressCallback({
          currentReference: reference.title,
          currentIndex: i,
          totalReferences: references.length,
          processedReferences: processedRefs,
          status: 'processing'
        });
      }
      
      // Find matching documents for this reference
      const matchingDocs = await this.documentLoader.findMatchingDocuments(reference.title);
      
      if (matchingDocs.length === 0) {
        console.log(`No matching documents found for: ${reference.title}`);
        missingRefCount++;
        
        // Handle missing reference according to user preference
        const refResult = await this.handleMissingReference(reference);
        results.push(refResult);
        
        // Update counters based on the result
        if (refResult.isVerified) {
          verifiedCount++;
        } else if (refResult.confidenceScore < 0) {
          inconclusiveCount++;
        } else {
          unverifiedCount++;
        }
      } else {
        console.log(`Found ${matchingDocs.length} matching documents for: ${reference.title}`);
        
        // Verify the citation against the matching documents
        const result = await this.verifyCitation(reference, matchingDocs[0]);
        results.push(result);
        
        // Update counters
        if (result.isVerified) {
          verifiedCount++;
        } else if (result.confidenceScore < 0) {
          inconclusiveCount++;
        } else {
          unverifiedCount++;
        }
      }
      
      // Add the processed reference with its verification status
      processedRefs.push({
        id: reference.reference?.id || String(i),
        title: reference.title,
        status: results[results.length - 1].isVerified ? 'valid' : 
               (results[results.length - 1].confidenceScore < 0 ? 'uncertain' : 'invalid'),
        link: reference.doi ? `https://doi.org/${reference.doi}` : '#'
      });
      
      // Report progress after processing this reference
      if (this.progressCallback) {
        this.progressCallback({
          currentReference: reference.title,
          currentIndex: i + 1,
          totalReferences: references.length,
          processedReferences: [...processedRefs],
          status: 'processing'
        });
      }
    }
    
    // Create and return the verification report
    const report: VerificationReport = {
      documentTitle,
      totalCitationsChecked: references.length,
      verifiedCitations: verifiedCount,
      unverifiedCitations: unverifiedCount,
      inconclusiveCitations: inconclusiveCount,
      missingReferences: missingRefCount,
      results
    };
    
    // Report final progress
    if (this.progressCallback) {
      this.progressCallback({
        currentReference: 'Completed',
        currentIndex: references.length,
        totalReferences: references.length,
        processedReferences: processedRefs,
        status: 'completed'
      });
    }
    
    // Print summary
    console.log(`\nCitation verification complete`);
    console.log(`Verified: ${verifiedCount}, Unverified: ${unverifiedCount}, Inconclusive: ${inconclusiveCount}`);
    console.log(`Missing references: ${missingRefCount} (${this.options.missingRefHandling} handling)`);
    
    return report;
  }

  /**
   * Handle a missing reference according to the configured strategy
   * @param reference The reference that was not found in the database
   * @returns A verification result
   */
  private async handleMissingReference(reference: EnhancedReference): Promise<VerificationResult> {
    const baseResult: VerificationResult = {
      citationContext: reference.citationContext || 'No context available',
      referenceTitle: reference.title,
      isVerified: false,
      confidenceScore: 0,
      explanation: 'Referenced document not found in database...',
      referenceFound: false
    };
    
    switch (this.options.missingRefHandling) {
      case 'skip':
        // Mark as inconclusive without any further processing
        baseResult.confidenceScore = -1; // Use negative value to indicate inconclusive
        baseResult.explanation = 'Reference document not found in database. Verification skipped.';
        break;
        
      case 'fetch':
        // Attempt to fetch the document from external sources (future feature)
        console.log(`Attempting to fetch reference document: ${reference.title}`);
        baseResult.explanation = 'Reference document not found in database. Auto-fetch not implemented yet.';
        break;
        
      case 'prompt':
        // Ask the user what to do with this missing reference
        const action = await this.promptUserForMissingRef(reference);
        
        if (action === 'add') {
          baseResult.explanation = 'User opted to add this document later. Marked as inconclusive.';
          baseResult.confidenceScore = -1;
        } else if (action === 'verify') {
          baseResult.explanation = 'User marked this citation as manually verified.';
          baseResult.isVerified = true;
          baseResult.confidenceScore = 1;
        } else {
          baseResult.explanation = 'User opted to skip this reference. Marked as unverified.';
        }
        break;
        
      case 'log':
      default:
        // Just log and continue (default behavior)
        baseResult.explanation = 'Reference document not found in database. Verification not possible.';
    }
    
    return baseResult;
  }
  
  /**
   * Prompt the user for how to handle a missing reference
   * @param reference The missing reference
   * @returns User's chosen action
   */
  private async promptUserForMissingRef(reference: EnhancedReference): Promise<'skip' | 'add' | 'verify'> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log('\n===== MISSING REFERENCE =====');
    console.log(`Title: ${reference.title}`);
    console.log(`Authors: ${reference.authors?.join(', ') || 'Unknown'}`);
    console.log(`Year: ${reference.year || 'Unknown'}`);
    console.log(`Citation context: "${reference.citationContext || 'No context available'}"`);
    
    return new Promise<'skip' | 'add' | 'verify'>((resolve) => {
      rl.question('\nHow would you like to handle this missing reference?\n1. Skip (mark as unverified)\n2. Add to fetch list (mark as inconclusive)\n3. Mark as manually verified\nEnter choice (1-3): ', (answer) => {
        rl.close();
        
        if (answer === '2') {
          this.addToFetchList(reference);
          resolve('add');
        } else if (answer === '3') {
          resolve('verify');
        } else {
          resolve('skip');
        }
      });
    });
  }
  
  /**
   * Add a reference to the fetch list for later processing
   * @param reference The reference to add to the fetch list
   */
  private addToFetchList(reference: EnhancedReference): void {
    const fetchListPath = path.join(this.documentLoader.getDocumentDirectory(), 'fetch-list.json');
    
    let fetchList: EnhancedReference[] = [];
    
    // Load existing fetch list if it exists
    if (fs.existsSync(fetchListPath)) {
      try {
        fetchList = JSON.parse(fs.readFileSync(fetchListPath, 'utf-8'));
      } catch (error) {
        console.error('Error loading fetch list:', error);
      }
    }
    
    // Add the new reference if it's not already in the list
    const isDuplicate = fetchList.some(ref => ref.title === reference.title);
    
    if (!isDuplicate) {
      fetchList.push(reference);
      fs.writeFileSync(fetchListPath, JSON.stringify(fetchList, null, 2));
      console.log('Reference added to fetch list. You can process this list later to add documents to the database.');
    } else {
      console.log('Reference already in fetch list.');
    }
  }
  
  /**
   * Verify a citation against a document
   * @param reference The reference with citation context to verify
   * @param document The document to check against
   * @returns Verification result
   */
  private async verifyCitation(
    reference: EnhancedReference,
    document: Document
  ): Promise<VerificationResult> {
    const result: VerificationResult = {
      citationContext: reference.citationContext || 'No context available',
      referenceTitle: reference.title,
      isVerified: false,
      confidenceScore: 0,
      explanation: '',
      referenceFound: true
    };
    
    try {
      // Prepare the prompt for Gemini
      const prompt = this.buildGeminiPrompt(reference.citationContext || '', document);
      
      // Get the generative model - use gemini-1.5-pro for best results with citation verification
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      
      console.log('Calling Gemini API to verify citation...');
      
      // Generate content with the prompt
      const response = await model.generateContent(prompt);
      const text = response.response.text();
      
      // Try to parse the response as JSON
      try {
        // First try to extract JSON if it's wrapped in markdown code blocks
        const jsonMatch = text.match(/```(?:json)?([\s\S]*?)```/) || 
                         text.match(/{[\s\S]*?}/);
        
        const jsonString = jsonMatch ? 
          jsonMatch[0].replace(/```json|```/g, '').trim() : 
          text.trim();
        
        const parsedResponse = JSON.parse(jsonString);
        
        result.isVerified = parsedResponse.isVerified === true;
        result.confidenceScore = typeof parsedResponse.confidenceScore === 'number' ? 
          Math.max(0, Math.min(1, parsedResponse.confidenceScore)) : 0.5;
        result.matchLocation = parsedResponse.matchLocation;
        result.explanation = parsedResponse.explanation || "No explanation provided";
      } catch (parseError) {
        console.warn('Failed to parse Gemini response as JSON:', parseError);
        
        // If we can't parse as JSON, do some simple heuristic analysis on the text
        const isVerified = /verified|correct|accurate|true|yes/i.test(text) &&
                        !/not verified|incorrect|inaccurate|false|no/i.test(text);
        
        result.isVerified = isVerified;
        result.confidenceScore = isVerified ? 0.7 : 0.3;
        result.explanation = `Could not parse structured response. Raw model output: ${text.substring(0, 200)}...`;
      }
    } catch (error) {
      console.error('Error verifying citation:', error);
      result.isVerified = false;
      result.confidenceScore = 0;
      result.explanation = `Error during verification: ${error instanceof Error ? error.message : String(error)}`;
    }
    
    return result;
  }
  
  /**
   * Build a prompt for Gemini to verify a citation
   * @param citationContext The citation context to verify
   * @param document The document to check against
   * @returns Prompt for Gemini
   */
  private buildGeminiPrompt(citationContext: string, document: Document): string {
    // Extract the most relevant document (first one for now)
    const doc = document;
    
    // Truncate document content to avoid token limits
    const maxContentLength = 100000;
    const truncatedContent = doc.content.length > maxContentLength ? 
      `${doc.content.substring(0, maxContentLength)}... [content truncated for length]` : 
      doc.content;
    
    // Build the prompt for Gemini
    return `
You are a scholarly citation verifier that evaluates whether a citation accurately represents the source material.

SOURCE DOCUMENT:
Title: ${doc.title}
Authors: ${doc.authors.join(', ')}
${doc.doi ? `DOI: ${doc.doi}` : ''}
${doc.year ? `Year: ${doc.year}` : ''}
${doc.journal ? `Journal: ${doc.journal}` : ''}

DOCUMENT CONTENT:
${truncatedContent}

CITATION CONTEXT TO VERIFY:
${citationContext}

TASK:
1. Determine if the citation context accurately represents what is stated in the source document.
2. Provide the specific section or quote from the source document that confirms or contradicts the citation.
3. Assess whether the citation is:
   - Accurately representing the source material
   - Misrepresenting the source material
   - Taking information out of context
   - Making claims not present in the source

IMPORTANT: Provide your verification result in the following JSON format:
{
  "isVerified": boolean,
  "confidenceScore": number between 0 and 1,
  "matchLocation": "specific text from the source document that matches",
  "explanation": "detailed explanation of your reasoning"
}
`;
  }
}
