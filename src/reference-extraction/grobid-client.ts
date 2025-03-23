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
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found at path: ${pdfPath}`);
    }

    console.log(`[GrobidClient] Processing PDF: ${pdfPath}`);
    
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
      console.log(`[GrobidClient] Sending request to ${this.baseUrl}/api/processFulltextDocument`);
      
      const response = await axios.post(
        `${this.baseUrl}/api/processFulltextDocument`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Accept': 'application/xml'
          },
          timeout: 120000, // 2 minutes timeout
          maxContentLength: 50 * 1024 * 1024 // 50MB max response size
        }
      );
      
      console.log(`[GrobidClient] Request successful, status: ${response.status}, response length: ${response.data.length} characters`);
      
      // Basic validation to ensure we got a TEI XML response
      if (typeof response.data === 'string' && 
          (response.data.includes('<TEI') && response.data.includes('xmlns="http://www.tei-c.org/ns/1.0"'))) {
        return response.data;
      } else {
        console.error('[GrobidClient] Response does not appear to be valid TEI XML');
        throw new Error('GROBID response is not valid TEI XML');
      }
    } catch (error: any) {
      console.error('[GrobidClient] Error in processFullText:', error.message);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error(`[GrobidClient] Response status: ${error.response.status}`);
          console.error(`[GrobidClient] Response headers: ${JSON.stringify(error.response.headers)}`);
          if (error.response.data) {
            console.error(`[GrobidClient] Response data: ${JSON.stringify(error.response.data).substring(0, 200)}...`);
          }
          
          if (error.response.status === 503) {
            throw new Error('GROBID service is currently busy. Try again later.');
          } else if (error.response.status === 500) {
            throw new Error('GROBID processing failed. The PDF may be invalid or corrupted.');
          } else if (error.response.status === 413) {
            throw new Error('The PDF file is too large for GROBID to process.');
          } else {
            throw new Error(`GROBID returned error status ${error.response.status}: ${error.response.statusText}`);
          }
        } else if (error.request) {
          // The request was made but no response was received
          console.error('[GrobidClient] No response received from GROBID');
          throw new Error('No response received from GROBID. The service may be down or unreachable.');
        } else {
          // Something happened in setting up the request that triggered an Error
          throw new Error(`Error with GROBID request: ${error.message}`);
        }
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
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found at path: ${pdfPath}`);
    }

    console.log(`[GrobidClient] Processing references from PDF: ${pdfPath}`);
    
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
      console.log(`[GrobidClient] Sending request to ${this.baseUrl}/api/processReferences`);
      
      const response = await axios.post(
        `${this.baseUrl}/api/processReferences`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Accept': 'application/xml'
          },
          timeout: 60000, // 1 minute timeout
          maxContentLength: 50 * 1024 * 1024 // 50MB max response size
        }
      );
      
      console.log(`[GrobidClient] Request successful, status: ${response.status}, response length: ${response.data.length} characters`);
      
      // Basic validation to ensure we got a TEI XML response
      if (typeof response.data === 'string' && 
          (response.data.includes('<TEI') || response.data.includes('<tei'))) {
        return response.data;
      } else {
        console.error('[GrobidClient] Response does not appear to be valid TEI XML');
        throw new Error('GROBID response is not valid TEI XML');
      }
    } catch (error: any) {
      console.error('[GrobidClient] Error in processReferences:', error.message);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error(`[GrobidClient] Response status: ${error.response.status}`);
          console.error(`[GrobidClient] Response headers: ${JSON.stringify(error.response.headers)}`);
          if (error.response.data) {
            console.error(`[GrobidClient] Response data: ${JSON.stringify(error.response.data).substring(0, 200)}...`);
          }
          
          if (error.response.status === 503) {
            throw new Error('GROBID service is currently busy. Try again later.');
          } else if (error.response.status === 500) {
            throw new Error('GROBID processing failed. The PDF may be invalid or corrupted.');
          } else if (error.response.status === 413) {
            throw new Error('The PDF file is too large for GROBID to process.');
          } else {
            throw new Error(`GROBID returned error status ${error.response.status}: ${error.response.statusText}`);
          }
        } else if (error.request) {
          // The request was made but no response was received
          console.error('[GrobidClient] No response received from GROBID');
          throw new Error('No response received from GROBID. The service may be down or unreachable.');
        } else {
          // Something happened in setting up the request that triggered an Error
          throw new Error(`Error with GROBID request: ${error.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Process a PDF file to extract only the citations
   * @param pdfPath Path to the PDF file
   * @returns The TEI XML response as a string
   */
  async processCitations(pdfPath: string): Promise<string> {
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found at path: ${pdfPath}`);
    }

    console.log(`[GrobidClient] Processing citations from PDF: ${pdfPath}`);
    
    const formData = new FormData();
    formData.append('input', fs.createReadStream(pdfPath));

    try {
      console.log(`[GrobidClient] Sending request to ${this.baseUrl}/api/processCitation`);
      
      const response = await axios.post(
        `${this.baseUrl}/api/processCitation`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Accept': 'application/xml'
          },
          timeout: 60000, // 1 minute timeout
          maxContentLength: 50 * 1024 * 1024 // 50MB max response size
        }
      );
      
      console.log(`[GrobidClient] Request successful, status: ${response.status}, response length: ${response.data.length} characters`);
      
      // Basic validation to ensure we got a TEI XML response
      if (typeof response.data === 'string' && 
          (response.data.includes('<TEI') || response.data.includes('<tei'))) {
        return response.data;
      } else {
        console.error('[GrobidClient] Response does not appear to be valid TEI XML');
        throw new Error('GROBID response is not valid TEI XML');
      }
    } catch (error: any) {
      console.error('[GrobidClient] Error in processCitations:', error.message);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error(`[GrobidClient] Response status: ${error.response.status}`);
          console.error(`[GrobidClient] Response headers: ${JSON.stringify(error.response.headers)}`);
          if (error.response.data) {
            console.error(`[GrobidClient] Response data: ${JSON.stringify(error.response.data).substring(0, 200)}...`);
          }
          
          if (error.response.status === 503) {
            throw new Error('GROBID service is currently busy. Try again later.');
          } else if (error.response.status === 500) {
            throw new Error('GROBID processing failed. The PDF may be invalid or corrupted.');
          } else if (error.response.status === 413) {
            throw new Error('The PDF file is too large for GROBID to process.');
          } else {
            throw new Error(`GROBID returned error status ${error.response.status}: ${error.response.statusText}`);
          }
        } else if (error.request) {
          // The request was made but no response was received
          console.error('[GrobidClient] No response received from GROBID');
          throw new Error('No response received from GROBID. The service may be down or unreachable.');
        } else {
          // Something happened in setting up the request that triggered an Error
          throw new Error(`Error with GROBID request: ${error.message}`);
        }
      }
      throw error;
    }
  }
}
