// This adapter allows us to use TypeScript modules in JavaScript
// It loads the ts-node/register hook and then imports our TypeScript module

// Register ts-node to handle TypeScript imports
require('ts-node/register');

// Path utilities for ensuring correct paths
const path = require('path');
const basePath = path.resolve(__dirname, '..', '..');

try {
  // Import the TypeScript modules
  const { DocumentParser } = require(path.join(basePath, 'src/document-extraction/document-parser'));
  // For TypeScript modules with named exports, we need to access the default property
  const documentDatabaseModule = require(path.join(basePath, 'src/document-database'));
  const DocumentDatabase = documentDatabaseModule.DocumentDatabase;
  const fs = require('fs');
  const axios = require('axios');
  const FormData = require('form-data');

  // Function to process a single PDF file
  async function processPdfFile(pdfFilePath, targetDir) {
    console.log(`Processing PDF file: ${path.basename(pdfFilePath)}`);
    try {
      // Check if GROBID service is available
      let grobidStatus;
      try {
        const statusResponse = await axios.get('http://localhost:8070/api/isalive');
        grobidStatus = statusResponse.status === 200;
      } catch (error) {
        console.error('Error connecting to GROBID service:', error.message);
        throw new Error('GROBID service is not available. Please ensure GROBID is running on port 8070.');
      }

      if (!grobidStatus) {
        throw new Error('GROBID service returned an unexpected status. Please check if it is running correctly.');
      }

      // Process the PDF with GROBID
      const formData = new FormData();
      formData.append('input', fs.createReadStream(pdfFilePath));
      
      console.log(`Sending request to GROBID for processing: ${path.basename(pdfFilePath)}`);
      const response = await axios.post(
        'http://localhost:8070/api/processFulltextDocument',
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 60000, // 60 seconds timeout
          validateStatus: status => status < 500 // Accept any status < 500
        }
      );

      // Check response status
      if (response.status !== 200) {
        console.error(`GROBID returned status code ${response.status} for file ${path.basename(pdfFilePath)}`);
        console.error('Response data:', response.data);
        throw new Error(`GROBID processing failed with status code ${response.status}`);
      }

      const teiXml = response.data;
      const parser = new DocumentParser(teiXml);
      
      // Extract metadata using the DocumentParser
      const title = parser.extractTitle();
      const authors = parser.extractAuthors().map(author => {
        if (author.rawName) return author.rawName;
        
        let fullName = '';
        if (author.firstName) fullName += author.firstName + ' ';
        if (author.middleName) fullName += author.middleName + ' ';
        if (author.lastName) fullName += author.lastName;
        
        return fullName.trim();
      });
      const content = parser.extractFullText();
      const doi = parser.extractDOI();
      const year = parser.extractPublicationYear();
      const journal = parser.extractJournal();
      
      // Create a sanitized ID from the paper title (preferred) or filename as fallback
      const id = title && title !== 'Untitled Document'
        ? title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 80)
        : path.basename(pdfFilePath)
            .toLowerCase()
            .replace(/\.pdf$/, '')
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);
      
      // Create document object
      const document = {
        id,
        title,
        authors,
        content,
        filePath: path.join(targetDir, `${id}.json`),
        sourcePdf: pdfFilePath,
        doi,
        year,
        journal
      };
      
      // Save the document
      fs.writeFileSync(
        document.filePath,
        JSON.stringify(document, null, 2)
      );
      
      console.log(`Saved document: ${document.id}`);
      return document;
    } catch (error) {
      console.error(`Error processing file ${path.basename(pdfFilePath)}:`, error.message);
      throw error;
    }
  }

  // Process PDF files
  async function processPdfs() {
    try {
      // Check if GROBID is running
      const grobidUrl = 'http://localhost:8070';
      
      try {
        await axios.get(`${grobidUrl}/api/isalive`, { timeout: 5000 });
        console.log('GROBID service is running.');
      } catch (error) {
        console.error('GROBID service is not running:', error.message);
        throw new Error('GROBID service is not running. Please start GROBID with: docker run -t --rm -p 8070:8070 grobid/grobid:0.8.1');
      }
      
      const pdfDirectory = path.join(basePath, 'src', 'document-database', 'pdf-documents');
      const documentsDirectory = path.join(basePath, 'src', 'document-database', 'documents');
      
      console.log(`Scanning for PDF documents in: ${pdfDirectory}`);
      
      // Ensure document directory exists
      if (!fs.existsSync(documentsDirectory)) {
        fs.mkdirSync(documentsDirectory, { recursive: true });
      }
      
      // Get all PDF files in the directory
      const files = fs.readdirSync(pdfDirectory).filter(file => file.toLowerCase().endsWith('.pdf'));
      console.log(`Found ${files.length} PDF files in the directory`);
      
      // Check which files have already been processed
      const processedFiles = new Set();
      const existingDocs = fs.readdirSync(documentsDirectory).filter(file => file.toLowerCase().endsWith('.json'));
      
      for (const docFile of existingDocs) {
        try {
          const docContent = JSON.parse(fs.readFileSync(path.join(documentsDirectory, docFile), 'utf8'));
          if (docContent.sourcePdf) {
            processedFiles.add(path.basename(docContent.sourcePdf));
          }
        } catch (error) {
          console.error(`Error reading document file ${docFile}:`, error.message);
        }
      }
      
      console.log(`Found ${processedFiles.size} already processed PDF files`);
      
      // Find PDFs that haven't been processed yet
      const newPdfFiles = files.filter(file => !processedFiles.has(file));
      console.log(`Found ${newPdfFiles.length} new PDF files to process`);
      
      let processedCount = 0;
      let errorCount = 0;
      
      // Process each new PDF file
      for (let i = 0; i < newPdfFiles.length; i++) {
        const file = newPdfFiles[i];
        const filePath = path.join(pdfDirectory, file);
        
        console.log(`Processing PDF file (${i + 1}/${newPdfFiles.length}): ${file}`);
        
        try {
          await processPdfFile(filePath, documentsDirectory);
          processedCount++;
        } catch (error) {
          console.error(`Error processing file ${file}:`, error.message);
          errorCount++;
        }
      }
      
      console.log(`\nProcessing complete: ${processedCount} documents processed, ${errorCount} errors`);
      
      return {
        processedCount,
        errorCount,
        message: `Processing complete: ${processedCount} documents processed, ${errorCount} errors`
      };
    } catch (error) {
      console.error('Error in PDF processing:', error);
      throw error;
    }
  }

  // Implement the rebuildDocumentIndex function
  async function rebuildDocumentIndex() {
    try {
      console.log('Rebuilding document index...');
      // Make sure DocumentDatabase is properly accessed
      if (typeof DocumentDatabase !== 'function') {
        console.error('DocumentDatabase is not a constructor. Type:', typeof DocumentDatabase);
        console.error('Module content:', JSON.stringify(documentDatabaseModule));
        throw new Error('DocumentDatabase is not properly imported');
      }
      const db = new DocumentDatabase();
      await db.rebuildIndex();
      console.log('Document index has been rebuilt successfully.');
      return {
        success: true,
        message: 'Document index has been rebuilt successfully.'
      };
    } catch (error) {
      console.error('Error rebuilding document index:', error);
      throw error;
    }
  }

  // Export the functions we need
  module.exports = {
    processPdfs,
    rebuildDocumentIndex
  };
} catch (error) {
  console.error('Error initializing PDF processing adapter:', error);
  // Provide dummy functions that report the error instead of crashing
  module.exports = {
    processPdfs: async () => {
      throw new Error(`Failed to initialize PDF processing: ${error.message}`);
    },
    rebuildDocumentIndex: async () => {
      throw new Error(`Failed to initialize document index rebuilding: ${error.message}`);
    }
  };
}
