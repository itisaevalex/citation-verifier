/**
 * Fixed Document Database Implementation
 * This is a simplified implementation that fixes the import issues
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
    console.log(`DocumentDatabase initialized with directory: ${this.dbDir}`);
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
    console.log(`Document saved to: ${doc.filePath}`);
    
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
   * Find documents by search criteria
   * @param criteria Search criteria (partial match)
   * @returns Array of matching documents
   */
  findDocuments(criteria: Partial<Document>): Document[] {
    const allDocs = this.getAllDocuments();
    
    return allDocs.filter(doc => {
      // Check each criteria field for a match
      for (const [key, value] of Object.entries(criteria)) {
        if (key === 'authors' && Array.isArray(value) && Array.isArray(doc.authors)) {
          // For authors, check if any author matches
          const authorMatch = value.some(author => 
            doc.authors.some(docAuthor => 
              docAuthor.toLowerCase().includes(author.toLowerCase())
            )
          );
          if (!authorMatch) return false;
        } else if (key === 'title' && typeof value === 'string' && doc.title) {
          // For title, check for substring match
          if (!doc.title.toLowerCase().includes(value.toLowerCase())) return false;
        } else if (key === 'doi' && typeof value === 'string' && doc.doi) {
          // For DOI, check for exact match (case insensitive)
          if (doc.doi.toLowerCase() !== value.toLowerCase()) return false;
        } else if (key === 'year' && doc.year) {
          // For year, check for exact match
          if (doc.year !== value) return false;
        }
      }
      return true;
    });
  }
}
