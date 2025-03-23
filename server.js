const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const FormData = require('form-data');
const axios = require('axios');
const app = express();
const port = 3000;

// Debug route for GROBID extraction
app.get('/debug-grobid-extraction', async (req, res) => {
  try {
    console.log('Starting debug GROBID extraction test...');
    
    // Use the sample paper for testing
    const samplePath = path.join(__dirname, 'samples', 'sample-paper.pdf');
    
    if (!fs.existsSync(samplePath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Sample paper not found',
        path: samplePath
      });
    }
    
    console.log(`Using sample paper at: ${samplePath}`);
    
    // Make a direct HTTP request to GROBID
    const formData = new FormData();
    formData.append('input', fs.createReadStream(samplePath));
    
    console.log('Sending request to GROBID...');
    const grobidUrl = 'http://localhost:8070';
    
    try {
      // First check if GROBID is alive
      const aliveCheck = await axios.get(`${grobidUrl}/api/isalive`, { timeout: 5000 });
      console.log(`GROBID alive check: ${aliveCheck.status === 200 ? 'OK' : 'Failed'}`);
      
      // Then try to process a document
      const response = await axios.post(
        `${grobidUrl}/api/processHeaderDocument`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Accept': 'application/xml'
          },
          timeout: 30000
        }
      );
      
      if (response.status === 200) {
        console.log('Successfully processed document header with GROBID');
        // Just return the first 500 chars of response to keep it manageable
        return res.json({
          success: true,
          message: 'GROBID extraction successful',
          sampleData: response.data.substring(0, 500) + '...'
        });
      } else {
        console.error(`GROBID returned status: ${response.status}`);
        return res.status(500).json({
          success: false,
          error: `GROBID returned status: ${response.status}`
        });
      }
    } catch (error) {
      console.error('Error while processing with GROBID:', error.message);
      if (error.response) {
        console.error(`GROBID response status: ${error.response.status}`);
        console.error(`GROBID response data: ${JSON.stringify(error.response.data)}`);
      }
      return res.status(500).json({
        success: false,
        error: `GROBID processing error: ${error.message}`
      });
    }
  } catch (error) {
    console.error('General error in debug route:', error);
    return res.status(500).json({
      success: false,
      error: `General error: ${error.message}`
    });
  }
});

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Serve the frontend static files
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// Parse JSON requests
app.use(express.json());

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[DEBUG] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Enable Server-Sent Events for progress updates
const clients = [];

// Function to send SSE updates to all connected clients
function sendProgressUpdate(data) {
  clients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// API prefix middleware
app.use('/api', express.Router()
  .post('/extract-references', upload.single('pdf'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const pdfPath = req.file.path;
    
    // Run the verify-citations.ts script using exec which uses the shell
    const command = `npx ts-node verify-citations.ts process "${pdfPath}" --verbose`;
    
    console.log(`Executing command: ${command}`);
    
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error.message}`);
        return res.status(500).json({ 
          error: 'Failed to process document',
          details: stderr || error.message
        });
      }
      
      console.log(`Command stdout: ${stdout}`);
      
      if (stderr) {
        console.error(`Command stderr: ${stderr}`);
      }
      
      // Try to find the references JSON file
      const referencesFilePath = `${pdfPath.replace('.pdf', '')}-references.json`;
      const verificationFilePath = `${pdfPath.replace('.pdf', '')}-verification-report.json`;
      
      console.log(`Looking for references file at: ${referencesFilePath}`);
      console.log(`Looking for verification report at: ${verificationFilePath}`);
      
      try {
        // Read the references file
        let references = [];
        if (fs.existsSync(referencesFilePath)) {
          console.log('Found references file, parsing...');
          references = JSON.parse(fs.readFileSync(referencesFilePath, 'utf8'));
          console.log(`Parsed ${references.length} references`);
        } else {
          console.log('References file not found');
        }
        
        // Read the verification report if it exists
        let verificationReport = null;
        if (fs.existsSync(verificationFilePath)) {
          console.log('Found verification report file, parsing...');
          verificationReport = JSON.parse(fs.readFileSync(verificationFilePath, 'utf8'));
          console.log('Verification report summary:');
          console.log(`- Total citations: ${verificationReport.totalCitationsChecked}`);
          console.log(`- Verified: ${verificationReport.verifiedCitations}`);
          console.log(`- Unverified: ${verificationReport.unverifiedCitations}`);
          console.log(`- Inconclusive: ${verificationReport.inconclusiveCitations}`);
          console.log(`- Missing refs: ${verificationReport.missingReferences || 0}`);
        } else {
          console.log('Verification report file not found');
        }
        
        // Return the results in the format frontend expects
        res.json({
          references: references.map(ref => ({
            id: ref.id || Math.random().toString(36).substring(2, 10),
            title: ref.title || 'Unknown Title',
            link: ref.link || '#',
            status: ref.status || 'validating'
          }))
        });
        
      } catch (error) {
        console.error('Error reading results:', error);
        res.status(500).json({ 
          error: 'Failed to read processing results',
          details: error.message 
        });
      }
    });
  })
  .post('/verify-references', express.json(), (req, res) => {
    // This endpoint would normally verify the references against a database
    // For now, we'll just simulate verification with random statuses
    const references = req.body.references;
    
    if (!references || !Array.isArray(references)) {
      return res.status(400).json({ error: 'Invalid references data' });
    }
    
    // Add missing status to identify papers not in the database
    const verifiedReferences = references.map(ref => {
      const random = Math.random();
      // Add a new status "missing" to indicate the paper is not in the database
      // About 20% of references will be marked as missing for demonstration purposes
      const status = random > 0.8 ? 'valid' : 
                    random > 0.6 ? 'uncertain' : 
                    random > 0.4 ? 'invalid' : 
                    'missing';
      return {
        ...ref,
        status,
        inDatabase: status !== 'missing'
      };
    });
    
    // Count missing references
    const missingReferences = verifiedReferences.filter(ref => ref.status === 'missing').length;
    
    // Send SSE update for completion
    sendProgressUpdate({
      event: 'verification_completed',
      data: {
        stats: {
          total: verifiedReferences.length,
          valid: verifiedReferences.filter(ref => ref.status === 'valid').length,
          invalid: verifiedReferences.filter(ref => ref.status === 'invalid').length,
          uncertain: verifiedReferences.filter(ref => ref.status === 'uncertain').length,
          missing: missingReferences
        }
      }
    });
    
    // Return the verified references
    res.json({
      references: verifiedReferences,
      missingCount: missingReferences
    });
  })
  // Add endpoint to upload reference document to database
  .post('/upload-reference-document', upload.single('pdf'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const pdfPath = req.file.path;
    const referenceId = req.body.referenceId;
    
    if (!referenceId) {
      return res.status(400).json({ error: 'Missing reference ID' });
    }
    
    console.log(`Adding reference document to database with ID: ${referenceId}`);
    console.log(`PDF path: ${pdfPath}`);
    
    // In a real implementation, we would process the document and add it to the database
    // For now, we'll just simulate success
    
    // Simulate processing delay
    setTimeout(() => {
      // Return success response
      res.json({
        success: true,
        message: 'Reference document added to database',
        data: {
          referenceId,
          fileName: req.file.originalname,
          addedToDatabase: true
        }
      });
    }, 1500);
  })
  .get('/progress-updates', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send initial connection message
    res.write(`data: ${JSON.stringify({ event: 'connected', data: { timestamp: Date.now() } })}\n\n`);
    
    const clientId = Date.now();
    const newClient = {
      id: clientId,
      res
    };
    
    clients.push(newClient);
    
    req.on('close', () => {
      console.log(`Client ${clientId} disconnected`);
      clients.splice(clients.findIndex(client => client.id === clientId), 1);
    });
  })
  // API endpoint to process a document
  .post('/api/process-document-local', upload.single('document'), async (req, res) => {
    // Check if a file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: 'No document uploaded'
      });
    }
    
    const documentPath = path.resolve(req.file.path);
    console.log(`Processing document: ${documentPath}`);

    try {
      // First validate that GROBID is running
      try {
        console.log('Checking GROBID status before processing document...');
        const axios = require('axios');
        const grobidUrl = 'http://localhost:8070';
        
        const aliveCheck = await axios.get(`${grobidUrl}/api/isalive`, { timeout: 5000 });
        const isGrobidAlive = aliveCheck.status === 200;
        
        if (!isGrobidAlive) {
          console.error('GROBID service is not running.');
          return res.status(500).json({
            error: 'GROBID service is not running',
            details: 'Please start GROBID with: docker run -t --rm -p 8070:8070 grobid/grobid:0.8.1'
          });
        }
        console.log('GROBID service is running, proceeding with document processing...');
      } catch (grobidCheckError) {
        console.error('Error checking GROBID status:', grobidCheckError.message);
        return res.status(500).json({
          error: 'Failed to connect to GROBID service',
          details: grobidCheckError.message
        });
      }

      // Use the command-line approach for processing the document
      console.log(`Executing command: npx ts-node verify-citations.ts process "${documentPath}" --verbose`);
      
      const { exec } = require('child_process');
      exec(`npx ts-node verify-citations.ts process "${documentPath}" --verbose`, (error, stdout, stderr) => {
        if (error) {
          console.error('Error executing command:', error);
          console.error('Command output:', stdout);
          console.error('Command errors:', stderr);
          
          // Try to determine the source of the error
          if (stdout.includes('GROBID service is not running') || stderr.includes('GROBID service is not running')) {
            return res.status(500).json({
              error: 'GROBID service is not running',
              details: 'Please start GROBID with: docker run -t --rm -p 8070:8070 grobid/grobid:0.8.1'
            });
          } else if (stdout.includes('Error: Request failed with status code 500') || stderr.includes('Error: Request failed with status code 500')) {
            return res.status(500).json({
              error: 'GROBID processing failed',
              details: 'There was an error processing the document with GROBID. Check if the PDF is valid and if GROBID is running correctly.'
            });
          } else {
            return res.status(500).json({
              error: 'Failed to process document',
              details: error.message
            });
          }
        }
        
        try {
          // Get the output file paths
          const fileNameWithoutExt = path.basename(documentPath, '.pdf');
          const outputPath = path.dirname(documentPath);
          const referencesPath = path.join(outputPath, `${fileNameWithoutExt}-references.json`);
          const reportPath = path.join(outputPath, `${fileNameWithoutExt}-verification-report.json`);
          
          // Check if the output files exist
          if (!fs.existsSync(referencesPath)) {
            return res.status(500).json({
              error: 'References file not generated',
              details: 'The processing completed but the references file was not found.'
            });
          }
          
          if (!fs.existsSync(reportPath)) {
            return res.status(500).json({
              error: 'Verification report not generated',
              details: 'The processing completed but the verification report file was not found.'
            });
          }
          
          // Read the output files
          const references = JSON.parse(fs.readFileSync(referencesPath, 'utf8'));
          const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
          
          // Return the results
          res.json({
            success: true,
            references,
            report,
            output: stdout
          });
        } catch (parseError) {
          console.error('Error parsing output files:', parseError);
          return res.status(500).json({
            error: 'Error processing results',
            details: parseError.message
          });
        }
      });
    } catch (error) {
      console.error('Error executing command:', error);
      return res.status(500).json({
        error: 'Failed to process document',
        details: error.message
      });
    }
  })
  // API endpoint to check GROBID service status
  .get('/check-grobid', async (req, res) => {
    console.log('Checking GROBID service status...');
    
    try {
      // Import the modules we need for checking GROBID
      const path = require('path');
      const fs = require('fs');
      
      // Check if the reference-extraction module exists
      const extractorPath = path.join(__dirname, 'src', 'reference-extraction', 'reference-extractor.ts');
      if (!fs.existsSync(extractorPath)) {
        return res.status(404).json({
          success: false,
          status: 'error',
          message: `GROBID integration module not found at ${extractorPath}. Make sure the project structure is correct.`
        });
      }
      
      // Instead of dynamically requiring TS files, which doesn't work directly with Node.js,
      // we'll make an HTTP request to check GROBID directly
      const axios = require('axios');
      const grobidUrl = 'http://localhost:8070'; // Default GROBID URL
      
      console.log(`Attempting to connect to GROBID at ${grobidUrl}...`);
      
      try {
        const response = await axios.get(`${grobidUrl}/api/isalive`, { timeout: 5000 });
        const isGrobidAlive = response.status === 200;
        
        console.log(`GROBID service status: ${isGrobidAlive ? 'running' : 'not running'}`);
        
        res.json({
          success: true,
          status: isGrobidAlive ? 'connected' : 'disconnected',
          url: grobidUrl,
          message: isGrobidAlive 
            ? 'GROBID service is running' 
            : 'GROBID service is not running. Please start GROBID with: docker run -t --rm -p 8070:8070 grobid/grobid:0.8.1'
        });
      } catch (error) {
        console.log('GROBID connection error:', error.message);
        res.json({
          success: true,
          status: 'disconnected',
          url: grobidUrl,
          message: 'GROBID service is not running. Please start GROBID with: docker run -t --rm -p 8070:8070 grobid/grobid:0.8.1'
        });
      }
    } catch (error) {
      console.error('Error checking GROBID status:', error);
      res.status(500).json({
        success: false,
        status: 'error',
        message: `Error checking GROBID status: ${error.message}`
      });
    }
  })
);

// Sample paper route (for testing)
app.get('/sample-paper.pdf', (req, res) => {
  const samplePath = path.join(__dirname, 'samples', 'sample-paper.pdf');
  if (fs.existsSync(samplePath)) {
    res.sendFile(samplePath);
  } else {
    res.status(404).send('Sample paper not found');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Catch-all route to serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Citation verification server running at http://localhost:${port}`);
});
