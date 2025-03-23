/**
 * Document Database Module
 * 
 * This module provides functionality for managing the document database,
 * including adding, indexing, and retrieving documents.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for a document in the database
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
 * Class for managing the document database
 */
export class DocumentDatabase {
  private dbDir: string;
  
  /**
   * Creates a new DocumentDatabase
   * @param dbDir Directory where the documents are stored
   */
  constructor(dbDir: string = path.join(process.cwd(), 'src', 'document-database', 'documents')) {
    this.dbDir = dbDir;
    // Ensure the documents directory exists
    if (!fs.existsSync(this.dbDir)) {
      fs.mkdirSync(this.dbDir, { recursive: true });
    }
  }
  
  /**
   * Add a document to the database
   * @param document The document to add
   * @returns The ID of the added document
   */
  addDocument(document: Omit<Document, 'id' | 'filePath'>): string {
    // Generate ID from title
    const id = this.generateDocumentId(document.title);
    
    // Create the document with ID and path
    const doc: Document = {
      ...document,
      id,
      filePath: path.join(this.dbDir, `${id}.json`)
    };
    
    // Save the document
    fs.writeFileSync(doc.filePath, JSON.stringify(doc, null, 2));
    
    // Update the index
    this.updateIndex(doc);
    
    return id;
  }
  
  /**
   * Get a document by ID
   * @param id The document ID
   * @returns The document or null if not found
   */
  getDocument(id: string): Document | null {
    const filePath = path.join(this.dbDir, `${id}.json`);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error reading document ${id}:`, error);
      return null;
    }
  }
  
  /**
   * Generate a document ID from a title
   * @param title The document title
   * @returns The generated ID
   */
  private generateDocumentId(title: string): string {
    const sanitized = title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    
    // Check if document with same ID already exists
    let id = sanitized;
    let counter = 1;
    
    while (fs.existsSync(path.join(this.dbDir, `${id}.json`))) {
      id = `${sanitized}_${counter}`;
      counter++;
    }
    
    return id;
  }
  
  /**
   * Update the document index
   * @param doc The document to index
   */
  private updateIndex(doc: Document): void {
    const indexPath = path.join(this.dbDir, '..', 'index.json');
    let index: any = {};
    
    // Load existing index if it exists
    if (fs.existsSync(indexPath)) {
      try {
        index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      } catch (error) {
        console.error('Error reading index:', error);
      }
    }
    
    // Initialize index sections if they don't exist
    if (!index.byDoi) index.byDoi = {};
    if (!index.byTitleWords) index.byTitleWords = {};
    if (!index.byYear) index.byYear = {};
    
    // Add to DOI index
    if (doc.doi) {
      index.byDoi[doc.doi.toLowerCase().trim()] = doc.filePath;
    }
    
    // Add to title words index
    const titleWords = doc.title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(w => w.length > 3);
    
    for (const word of titleWords) {
      if (!index.byTitleWords[word]) {
        index.byTitleWords[word] = [];
      }
      
      if (!index.byTitleWords[word].includes(doc.filePath)) {
        index.byTitleWords[word].push(doc.filePath);
      }
    }
    
    // Add to year index
    if (doc.year) {
      if (!index.byYear[doc.year]) {
        index.byYear[doc.year] = [];
      }
      
      if (!index.byYear[doc.year].includes(doc.filePath)) {
        index.byYear[doc.year].push(doc.filePath);
      }
    }
    
    // Save the updated index
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  }
  
  /**
   * Get all documents in the database
   * @returns Array of documents
   */
  getAllDocuments(): Document[] {
    const documents: Document[] = [];
    
    try {
      const files = fs.readdirSync(this.dbDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const docPath = path.join(this.dbDir, file);
          try {
            const content = fs.readFileSync(docPath, 'utf-8');
            documents.push(JSON.parse(content));
          } catch (error) {
            console.error(`Error reading document ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error reading documents directory:', error);
    }
    
    return documents;
  }
  
  /**
   * Rebuild the document index
   */
  rebuildIndex(): void {
    const documents = this.getAllDocuments();
    
    // Remove existing index
    const indexPath = path.join(this.dbDir, '..', 'index.json');
    if (fs.existsSync(indexPath)) {
      fs.unlinkSync(indexPath);
    }
    
    // Rebuild index
    for (const doc of documents) {
      this.updateIndex(doc);
    }
    
    console.log(`Index rebuilt with ${documents.length} documents`);
  }
}
