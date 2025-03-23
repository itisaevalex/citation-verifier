const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Calculate absolute paths
const basePath = path.resolve(__dirname, '..', '..');
const documentParserPath = path.join(basePath, 'src', 'document-extraction', 'document-parser.js');
const documentDatabasePath = path.join(basePath, 'src', 'document-database', 'index.js');

// Dynamically require the modules
const DocumentParser = require(documentParserPath).DocumentParser;
const DocumentDatabase = require(documentDatabasePath).DocumentDatabase;

// Main function to process PDF files
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
    
    // Define paths
    const pdfDirectory = path.join(basePath, 'src', 'document-database', 'pdf-documents');
    const documentsDirectory = path.join(basePath, 'src', 'document-database', 'documents');
    
    console.log(`Scanning for PDF documents in: ${pdfDirectory}`);
    
    // Check if directories exist
    if (!fs.existsSync(pdfDirectory)) {
      throw new Error(`PDF documents directory not found: ${pdfDirectory}`);
    }
    
    if (!fs.existsSync(documentsDirectory)) {
      // Create the documents directory if it doesn't exist
      fs.mkdirSync(documentsDirectory, { recursive: true });
    }
    
    // Get list of all PDF files in the directory
    const pdfFiles = fs.readdirSync(pdfDirectory)
      .filter(file => file.toLowerCase().endsWith('.pdf'));
    
    console.log(`Found ${pdfFiles.length} PDF files in the directory`);
    
    // Get list of already processed documents
    const existingDocuments = fs.readdirSync(documentsDirectory)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        try {
          const content = fs.readFileSync(path.join(documentsDirectory, file), 'utf-8');
          const doc = JSON.parse(content);
          if (!doc) return null;
          return {
            id: doc.id,
            filePath: doc.filePath,
            sourcePdf: doc.sourcePdf || '' // Some documents might not have sourcePdf field
          };
        } catch (error) {
          console.error(`Error reading document ${file}:`, error);
          return null;
        }
      })
      .filter(Boolean);
    
    // Get list of PDF files that have already been processed
    const processedPdfFiles = existingDocuments
      .map(doc => doc?.sourcePdf)
      .filter(Boolean)
      .map(filePath => path.basename(filePath));
    
    console.log(`Found ${processedPdfFiles.length} already processed PDF files`);
    
    // Get list of new PDF files that need to be processed
    const newPdfFiles = pdfFiles.filter(file => !processedPdfFiles.includes(file));
    
    console.log(`Found ${newPdfFiles.length} new PDF files to process`);
    
    if (newPdfFiles.length === 0) {
      console.log('No new PDF files to process.');
      return {
        processedCount: 0,
        errorCount: 0,
        message: 'No new PDF files to process.'
      };
    }
    
    // Process each PDF file
    let processedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < newPdfFiles.length; i++) {
      const file = newPdfFiles[i];
      const filePath = path.join(pdfDirectory, file);
      
      console.log(`Processing PDF file (${i + 1}/${newPdfFiles.length}): ${file}`);
      
      try {
        // Process the PDF with GROBID
        const formData = new FormData();
        formData.append('input', fs.createReadStream(filePath));
        
        const response = await axios.post(
          `${grobidUrl}/api/processFulltextDocument`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              'Accept': 'application/xml'
            },
            timeout: 60000 // 60 seconds timeout for large documents
          }
        );
        
        if (response.status === 200) {
          console.log(`Successfully processed document with GROBID: ${file}`);
          
          // The response is XML - use the DocumentParser to extract data
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
            : file
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
            filePath: path.join(documentsDirectory, `${id}.json`),
            sourcePdf: filePath,
            doi,
            year,
            journal
          };
          
          // Save the document
          fs.writeFileSync(
            document.filePath,
            JSON.stringify(document, null, 2)
          );
          
          processedCount++;
          console.log(`Saved document: ${document.id}`);
        } else {
          console.error(`GROBID returned error status: ${response.status} for file: ${file}`);
          errorCount++;
        }
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
    console.error('Error in PDF processing script:', error);
    throw error;
  }
}

// Function to rebuild the document index
async function rebuildDocumentIndex() {
  try {
    console.log('Rebuilding document index...');
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

// Export the functions
module.exports = {
  processPdfs,
  rebuildDocumentIndex
};
