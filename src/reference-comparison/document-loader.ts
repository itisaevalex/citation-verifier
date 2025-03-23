import * as fs from 'fs';
import * as path from 'path';
import { EnhancedReference } from '../reference-extraction/reference-extractor';

/**
 * Interface for a document in the document database
 */
export interface Document {
  id: string;
  title: string;
  authors: string[];
  doi?: string;
  filePath: string;
  content: string;
  year?: string;
  journal?: string;
}

/**
 * Class for loading documents from the document database
 */
export class DocumentLoader {
  private documentsDir: string;
  private indexPath: string;
  private indexCache: any = null;
  
  /**
   * Creates a new DocumentLoader
   * @param documentsDir Directory where the documents are stored
   */
  constructor(documentsDir: string = path.join(process.cwd(), 'src', 'document-database')) {
    this.documentsDir = documentsDir;
    this.indexPath = path.join(this.documentsDir, 'index.json');
    
    // Ensure the documents directory exists
    if (!fs.existsSync(this.documentsDir)) {
      fs.mkdirSync(this.documentsDir, { recursive: true });
    }
  }
  
  /**
   * Find documents in the database matching the given reference
   * @param reference The reference to find documents for
   * @returns Array of matching documents
   */
  findDocuments(reference: EnhancedReference['reference']): Document[] {
    const results: Document[] = [];
    
    try {
      // Try to find by DOI first (most accurate)
      if (reference.doi) {
        const doiBasedDoc = this.findDocumentByDoi(reference.doi);
        if (doiBasedDoc) {
          results.push(doiBasedDoc);
          return results; // DOI is unique, so we can return early
        }
      }
      
      // If no DOI match, try to find by exact title
      if (reference.title) {
        // First try exact title match
        const exactTitleDoc = this.findDocumentByExactTitle(reference.title);
        if (exactTitleDoc) {
          results.push(exactTitleDoc);
          return results; // Exact title match should be sufficient
        }
        
        // Then try title-based fuzzy matching
        const titleBasedDocs = this.findDocumentsByTitle(reference.title);
        if (titleBasedDocs.length > 0) {
          results.push(...titleBasedDocs);
          return results;
        }
      }
      
      // If still no matches, try by authors and year
      if (results.length === 0 && reference.authors && reference.authors.length > 0 && reference.year) {
        const authorYearBasedDocs = this.findDocumentsByAuthorsAndYear(reference.authors, reference.year);
        if (authorYearBasedDocs.length > 0) {
          results.push(...authorYearBasedDocs);
        }
      }
    } catch (error) {
      console.error('Error finding documents:', error);
    }
    
    return results;
  }
  
  /**
   * Find matching documents based on a title
   * @param title Title to search for
   * @returns Array of matching documents
   */
  async findMatchingDocuments(title: string): Promise<Document[]> {
    // First try exact title match
    const exactTitleDoc = this.findDocumentByExactTitle(title);
    if (exactTitleDoc) {
      return [exactTitleDoc];
    }
    
    // Then try title-based search
    const exactMatches = this.findDocumentsByTitle(title);
    
    if (exactMatches.length > 0) {
      return exactMatches;
    }
    
    // Then try fuzzy title match
    return this.findDocumentsByFuzzyMatch(title);
  }

  /**
   * Get the directory where documents are stored
   * @returns Path to the document directory
   */
  getDocumentDirectory(): string {
    return this.documentsDir;
  }
  
  /**
   * Get index data from cache or load it from disk
   * @returns The document index or null if not found
   */
  private getIndex(): any {
    // Return cached index if available
    if (this.indexCache) {
      return this.indexCache;
    }
    
    try {
      if (fs.existsSync(this.indexPath)) {
        const indexData = JSON.parse(fs.readFileSync(this.indexPath, 'utf-8'));
        this.indexCache = indexData;
        return indexData;
      }
    } catch (error) {
      console.error('Error reading index file:', error);
    }
    
    return null;
  }
  
  /**
   * Find a document by its exact title using the byTitle index
   * @param title The exact title to search for
   * @returns The document or null if not found
   */
  private findDocumentByExactTitle(title: string): Document | null {
    const index = this.getIndex();
    
    if (index && index.byTitle) {
      // First try exact match
      if (index.byTitle[title]) {
        return this.loadDocument(index.byTitle[title]);
      }
      
      // Try case-insensitive match
      const titleLower = title.trim().toLowerCase();
      for (const [indexedTitle, docPath] of Object.entries(index.byTitle)) {
        if (indexedTitle.toLowerCase() === titleLower) {
          return this.loadDocument(docPath as string);
        }
      }
    }
    
    return null;
  }
  
  /**
   * Find a document by its DOI
   * @param doi The DOI to search for
   * @returns The matching document or null if not found
   */
  private findDocumentByDoi(doi: string): Document | null {
    // Normalize DOI
    const normalizedDoi = doi.toLowerCase().trim();
    
    try {
      // Check the document index
      const index = this.getIndex();
      
      if (index && index.byDoi && index.byDoi[normalizedDoi]) {
        const docPath = index.byDoi[normalizedDoi];
        return this.loadDocument(docPath);
      }
      
      // If not in index, scan all documents
      const documentsDir = path.join(this.documentsDir, 'documents');
      if (fs.existsSync(documentsDir)) {
        const files = fs.readdirSync(documentsDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const docPath = path.join(documentsDir, file);
            const doc = this.loadDocument(docPath);
            
            if (doc && doc.doi && doc.doi.toLowerCase().trim() === normalizedDoi) {
              return doc;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error finding document by DOI:', error);
    }
    
    return null;
  }
  
  /**
   * Find documents by title
   * @param title The title to search for
   * @returns Array of matching documents
   */
  private findDocumentsByTitle(title: string): Document[] {
    const results: Document[] = [];
    const normalizedTitle = title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    
    try {
      // Check the document index
      const index = this.getIndex();
      
      if (index && index.byTitleWords) {
        // Look for potential matches based on title words
        const titleWords = normalizedTitle.split(' ').filter(w => w.length > 3);
        const potentialMatches = new Set<string>();
        
        for (const word of titleWords) {
          if (index.byTitleWords[word]) {
            index.byTitleWords[word].forEach((docPath: string) => potentialMatches.add(docPath));
          }
        }
        
        // Check if any potential matches have similar titles
        for (const docPath of potentialMatches) {
          const doc = this.loadDocument(docPath);
          if (doc && this.isTitleSimilar(doc.title, title)) {
            results.push(doc);
          }
        }
      }
      
      // If not in index or no matches, scan all documents
      if (results.length === 0) {
        const documentsDir = path.join(this.documentsDir, 'documents');
        if (fs.existsSync(documentsDir)) {
          const files = fs.readdirSync(documentsDir);
          
          for (const file of files) {
            if (file.endsWith('.json')) {
              const docPath = path.join(documentsDir, file);
              const doc = this.loadDocument(docPath);
              
              if (doc && this.isTitleSimilar(doc.title, title)) {
                results.push(doc);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error finding documents by title:', error);
    }
    
    return results;
  }
  
  /**
   * Find documents by authors and year
   * @param authors The authors to search for
   * @param year The publication year
   * @returns Array of matching documents
   */
  private findDocumentsByAuthorsAndYear(authors: string[], year: string): Document[] {
    const results: Document[] = [];
    
    try {
      // Check the document index
      const index = this.getIndex();
      
      if (index && index.byYear && index.byYear[year]) {
        // Get all documents from that year
        const docsFromYear = index.byYear[year];
        
        for (const docPath of docsFromYear) {
          const doc = this.loadDocument(docPath);
          if (doc && this.hasCommonAuthors(doc.authors, authors)) {
            results.push(doc);
          }
        }
      }
      
      // If not in index or no matches, scan all documents
      if (results.length === 0) {
        const documentsDir = path.join(this.documentsDir, 'documents');
        if (fs.existsSync(documentsDir)) {
          const files = fs.readdirSync(documentsDir);
          
          for (const file of files) {
            if (file.endsWith('.json')) {
              const docPath = path.join(documentsDir, file);
              const doc = this.loadDocument(docPath);
              
              if (doc && doc.year === year && this.hasCommonAuthors(doc.authors, authors)) {
                results.push(doc);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error finding documents by authors and year:', error);
    }
    
    return results;
  }
  
  /**
   * Find documents by fuzzy title matching
   * @param title Title to search for
   * @returns Array of matching documents
   */
  private findDocumentsByFuzzyMatch(title: string): Document[] {
    const results: Document[] = [];
    const allDocuments = this.getAllDocuments();
    
    // Normalize the search title
    const normalizedTitle = this.normalizeForFuzzyMatch(title);
    const titleWords = normalizedTitle.split(/\s+/).filter(word => word.length > 3);
    
    // Minimum word match threshold (adjust as needed)
    const minWordMatchRatio = 0.5; // At least 50% of significant words should match
    
    for (const doc of allDocuments) {
      // Skip documents that are clearly unrelated
      if (!doc.title) continue;
      
      // Normalize the document title
      const normalizedDocTitle = this.normalizeForFuzzyMatch(doc.title);
      const docTitleWords = normalizedDocTitle.split(/\s+/).filter(word => word.length > 3);
      
      // Count how many significant words from the search title appear in the document title
      let matchCount = 0;
      for (const word of titleWords) {
        if (docTitleWords.includes(word)) {
          matchCount++;
        }
      }
      
      // Calculate match ratio
      const titleWordCount = titleWords.length;
      const matchRatio = titleWordCount > 0 ? matchCount / titleWordCount : 0;
      
      // If match ratio exceeds threshold, consider it a match
      if (matchRatio >= minWordMatchRatio) {
        results.push(doc);
      }
    }
    
    return results;
  }
  
  /**
   * Normalize a string for fuzzy matching
   * @param text Text to normalize
   * @returns Normalized text
   */
  private normalizeForFuzzyMatch(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
  }
  
  /**
   * Load a document from a file
   * @param filePath Path to the document file
   * @returns The loaded document or null if there was an error
   */
  private loadDocument(filePath: string): Document | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const docData = JSON.parse(content);
      
      // Convert document from our new format to the expected Document interface
      // Make sure filePath is included
      if (!docData.filePath) {
        docData.filePath = filePath;
      }
      
      // Return null if critical fields are missing
      if (!docData.id || !docData.title || !docData.content) {
        console.warn(`Document at ${filePath} is missing critical fields`);
        return null;
      }
      
      // Ensure authors is an array
      if (!Array.isArray(docData.authors)) {
        docData.authors = [];
      }
      
      return docData;
    } catch (error) {
      console.error(`Error loading document from ${filePath}:`, error);
      return null;
    }
  }
  
  /**
   * Check if two titles are similar
   * @param title1 First title
   * @param title2 Second title
   * @returns True if the titles are similar
   */
  private isTitleSimilar(title1: string, title2: string): boolean {
    // More aggressive normalization to handle different formatting styles
    const normalize = (title: string) => {
      return title
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove non-alphanumeric characters
        .replace(/\s+/g, '') // Remove all whitespace
        .replace(/_/g, ''); // Remove underscores (used in document IDs)
    };
    
    const normalizedTitle1 = normalize(title1);
    const normalizedTitle2 = normalize(title2);
    
    // Direct match after aggressive normalization
    if (normalizedTitle1 === normalizedTitle2) {
      return true;
    }
    
    // For less aggressive comparison, use the original normalization
    const simpleNormalize = (title: string) => 
      title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    
    const simpleNormalizedTitle1 = simpleNormalize(title1);
    const simpleNormalizedTitle2 = simpleNormalize(title2);
    
    // Check for substring match
    if (simpleNormalizedTitle1.includes(simpleNormalizedTitle2) || simpleNormalizedTitle2.includes(simpleNormalizedTitle1)) {
      return true;
    }
    
    // Check word overlap
    const words1 = new Set(simpleNormalizedTitle1.split(' ').filter(w => w.length > 3));
    const words2 = new Set(simpleNormalizedTitle2.split(' ').filter(w => w.length > 3));
    
    let commonWords = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        commonWords++;
      }
    }
    
    // If 70% of the words in the shorter title are found in the longer title
    const minWords = Math.min(words1.size, words2.size);
    const similarityRatio = minWords > 0 ? commonWords / minWords : 0;
    
    if (similarityRatio >= 0.7) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if two author lists have common authors
   * @param authors1 First author list
   * @param authors2 Second author list
   * @returns True if the author lists have common authors
   */
  private hasCommonAuthors(authors1: string[], authors2: string[]): boolean {
    if (!authors1 || !authors2 || authors1.length === 0 || authors2.length === 0) {
      return false;
    }
    
    // Extract last names from each author
    const getLastNames = (authors: string[]) => {
      return authors.map(author => {
        // Try to extract last name
        const parts = author.split(',');
        if (parts.length > 1) {
          return parts[0].trim().toLowerCase(); // Last name is before the comma
        } else {
          // Assume the last word is the last name
          const words = author.trim().split(' ');
          return words[words.length - 1].toLowerCase();
        }
      });
    };
    
    const lastNames1 = getLastNames(authors1);
    const lastNames2 = getLastNames(authors2);
    
    // Check for common last names
    for (const lastName1 of lastNames1) {
      if (lastName1.length > 1 && lastNames2.some(ln2 => ln2 === lastName1)) {
        return true;
      }
    }
    
    return false;
  }

  private getAllDocuments(): Document[] {
    const results: Document[] = [];
    const documentsDir = path.join(this.documentsDir, 'documents');
    
    if (!fs.existsSync(documentsDir)) {
      return results;
    }
    
    const files = fs.readdirSync(documentsDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const docPath = path.join(documentsDir, file);
        const doc = this.loadDocument(docPath);
        
        if (doc) {
          results.push(doc);
        }
      }
    }
    
    return results;
  }
}
