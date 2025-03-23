import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';

/**
 * Client for interacting with the GROBID API
 */
export class GrobidClient {
  private baseUrl: string;

  /**
   * Creates a new GROBID client
   * @param baseUrl The base URL of the GROBID service
   */
  constructor(baseUrl: string = 'http://localhost:8070') {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if the GROBID service is running
   * @returns True if the service is available
   */
  async isAlive(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/isalive`);
      return response.data === true;
    } catch (error) {
      console.error('GROBID service check failed:', error);
      return false;
    }
  }

  /**
   * Process a PDF file to extract the full text and references
   * @param pdfPath Path to the PDF file
   * @param options Processing options
   * @returns The TEI XML response as a string
   */
  async processFullText(
    pdfPath: string, 
    options: {
      consolidateHeader?: '0' | '1' | '2' | '3',
      consolidateCitations?: '0' | '1' | '2',
      includeRawCitations?: '0' | '1',
      teiCoordinates?: string[]
    } = {}
  ): Promise<string> {
    const formData = new FormData();
    formData.append('input', fs.createReadStream(pdfPath));
    
    // Add optional parameters
    if (options.consolidateHeader) {
      formData.append('consolidateHeader', options.consolidateHeader);
    }
    
    if (options.consolidateCitations) {
      formData.append('consolidateCitations', options.consolidateCitations);
    }
    
    if (options.includeRawCitations) {
      formData.append('includeRawCitations', options.includeRawCitations);
    }
    
    if (options.teiCoordinates) {
      options.teiCoordinates.forEach(coord => {
        formData.append('teiCoordinates', coord);
      });
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/processFulltextDocument`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Accept': 'application/xml'
          },
          timeout: 120000 // 2 minutes timeout
        }
      );
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 503) {
        throw new Error('GROBID service is currently busy. Try again later.');
      }
      throw error;
    }
  }

  /**
   * Process a PDF file to extract only the references
   * @param pdfPath Path to the PDF file
   * @param options Processing options
   * @returns The TEI XML response as a string
   */
  async processReferences(
    pdfPath: string,
    options: {
      consolidateCitations?: '0' | '1' | '2',
      includeRawCitations?: '0' | '1'
    } = {}
  ): Promise<string> {
    const formData = new FormData();
    formData.append('input', fs.createReadStream(pdfPath));
    
    // Add optional parameters
    if (options.consolidateCitations) {
      formData.append('consolidateCitations', options.consolidateCitations);
    }
    
    if (options.includeRawCitations) {
      formData.append('includeRawCitations', options.includeRawCitations);
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/processReferences`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Accept': 'application/xml'
          },
          timeout: 60000 // 1 minute timeout
        }
      );
      
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process a PDF file to extract only the citations
   * @param pdfPath Path to the PDF file
   * @returns The TEI XML response as a string
   */
  async processCitations(pdfPath: string): Promise<string> {
    const formData = new FormData();
    formData.append('input', fs.createReadStream(pdfPath));

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/processCitation`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Accept': 'application/xml'
          },
          timeout: 30000 // 30 seconds timeout
        }
      );
      
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}
