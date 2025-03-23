import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import axios from 'axios';
import FormData from 'form-data';

import { DocumentParser } from './document-parser';

/**
 * Document data structure containing metadata and full text content
 */
export interface DocumentData {
  title: string;
  authors: Array<{firstName?: string, middleName?: string, lastName?: string, rawName?: string}>;
  publicationYear: string;
  journal: string;
  doi: string;
  fullText: string;
}

/**
 * Options for processing documents
 */
export interface DocumentProcessingOptions {
  grobidUrl?: string;
  timeout?: number;
}

/**
 * Class for processing PDF documents to extract metadata and full text
 */
export class DocumentProcessor {
  private grobidUrl: string;
  private timeout: number;

  /**
   * Constructor
   * @param options Processing options
   */
  constructor(options: DocumentProcessingOptions = {}) {
    this.grobidUrl = options.grobidUrl || 'http://localhost:8070';
    this.timeout = options.timeout || 60000; // Default 60 seconds
  }

  /**
   * Process a PDF file using GROBID to extract document information
   * @param pdfPath Path to the PDF file
   * @returns Document data with metadata and full text
   */
  async processPdf(pdfPath: string): Promise<DocumentData> {
    try {
      // Check if the file exists
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF file not found at path: ${pdfPath}`);
      }

      // Get the TEI XML from GROBID
      const teiXml = await this.processFileWithGrobid(pdfPath);
      return this.processXml(teiXml);
    } catch (error) {
      console.error(`Error processing PDF ${pdfPath}:`, error);
      throw error;
    }
  }

  /**
   * Process TEI XML to extract document data
   * @param teiXml TEI XML string from GROBID
   * @returns Document data with metadata and full text
   */
  processXml(teiXml: string): DocumentData {
    // Create a new DocumentParser instance
    const parser = new DocumentParser(teiXml);
    
    // Extract document metadata and full text
    const title = parser.extractTitle();
    const authors = parser.extractAuthors();
    const publicationYear = parser.extractPublicationYear();
    const journal = parser.extractJournal();
    const doi = parser.extractDOI();
    const fullText = parser.extractFullText();
    
    // Return the extracted document data
    return {
      title,
      authors,
      publicationYear,
      journal,
      doi,
      fullText
    };
  }

  /**
   * Send a PDF file to GROBID and get the TEI XML response
   * @param pdfPath Path to the PDF file
   * @returns TEI XML string from GROBID
   */
  private async processFileWithGrobid(pdfPath: string): Promise<string> {
    try {
      // Check if GROBID service is running
      await this.checkGrobidStatus();
      
      // Create form data for the request
      const formData = new FormData();
      formData.append('input', fs.createReadStream(pdfPath));
      
      // Send the PDF to GROBID
      const response = await axios.post(
        `${this.grobidUrl}/api/processFulltextDocument`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: this.timeout,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );
      
      // Return the TEI XML response
      return response.data;
    } catch (error: any) {
      console.error('Error processing file with GROBID:', error);
      throw new Error(`Failed to process file with GROBID: ${error.message || String(error)}`);
    }
  }

  /**
   * Check if the GROBID service is running
   * @returns True if GROBID is running, false otherwise
   */
  async checkGrobidStatus(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.grobidUrl}/api/isalive`);
      
      // The response data might be an object or a string, handle both cases
      const responseData = typeof response.data === 'string' 
        ? response.data 
        : JSON.stringify(response.data);
      
      return response.status === 200 && responseData.includes('true');
    } catch (error: any) {
      console.error('Error checking GROBID status:', error.message || String(error));
      return false;
    }
  }
}
