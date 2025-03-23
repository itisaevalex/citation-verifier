const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const FormData = require('form-data');
const axios = require('axios');
const app = express();
const port = 3000;
const os = require('os');
const uuidv4 = require('uuid').v4;

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

// Debug route to process a sample PDF directly
app.get('/debug-process-sample', async (req, res) => {
  try {
    console.log('Debug: Processing sample PDF directly');
    const samplePath = path.join(__dirname, 'samples', 'sample-paper.pdf');
    
    // Check if the sample file exists
    if (!fs.existsSync(samplePath)) {
      return res.status(404).json({
        success: false,
        error: 'Sample PDF file not found'
      });
    }
    
    // Log file stats
    const stats = fs.statSync(samplePath);
    console.log(`Sample file stats: size=${stats.size} bytes`);
    
    // Read first bytes to verify it's a PDF
    const buffer = Buffer.alloc(5);
    const fd = fs.openSync(samplePath, 'r');
    fs.readSync(fd, buffer, 0, 5, 0);
    fs.closeSync(fd);
    
    const isPDF = buffer.toString('ascii').startsWith('%PDF');
    console.log(`Sample PDF header check: isPDF=${isPDF}, header=${buffer.toString('hex')}`);
    
    // Try to copy the file to uploads directory
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    
    const destPath = path.join(uploadDir, `debug-${Date.now()}-sample-paper.pdf`);
    fs.copyFileSync(samplePath, destPath);
    console.log(`Copied sample file to: ${destPath}`);
    
    // Execute verification process
    const { exec } = require('child_process');
    exec(`npx ts-node verify-citations.ts process "${destPath}" --verbose`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing command:', error);
        console.error('Command output:', stdout);
        console.error('Command errors:', stderr);
        
        return res.status(500).json({
          success: false,
          error: 'Failed to process sample document',
          details: error.message,
          output: stdout,
          stderr: stderr
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Sample document processed successfully',
        output: stdout
      });
    });
  } catch (error) {
    console.error('Error in debug-process-sample route:', error);
    return res.status(500).json({
      success: false,
      error: `Error: ${error.message}`
    });
  }
});

// Direct sample file processing route (skips file upload)
app.get('/direct-sample-process', async (req, res) => {
  try {
    const samplePdfPath = path.join(__dirname, 'samples', 'sample-paper.pdf');
    console.log(`Processing direct sample PDF: ${samplePdfPath}`);
    
    // Check if file exists
    if (!fs.existsSync(samplePdfPath)) {
      return res.status(404).json({ error: 'Sample PDF not found' });
    }
    
    // Log file size
    const stats = fs.statSync(samplePdfPath);
    console.log(`Sample PDF size: ${stats.size} bytes`);
    
    // Execute the verify-citations command directly
    const { exec } = require('child_process');
    exec(`npx ts-node verify-citations.ts process "${samplePdfPath}" --verbose`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error processing direct sample:', error);
        console.error('Command output:', stdout);
        console.error('Command errors:', stderr);
        
        return res.status(500).json({
          error: 'Failed to process direct sample',
          details: error.message,
          stdout,
          stderr
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Direct sample processed successfully',
        output: stdout
      });
    });
  } catch (error) {
    console.error('Error in direct-sample-process:', error);
    return res.status(500).json({ error: error.message });
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

const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Serve test-upload.html for debugging
app.get('/test-upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-upload.html'));
});

// Serve direct-upload.html for more robust PDF uploads
app.get('/direct-upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'direct-upload.html'));
});

// Serve server-upload.html for processing server-side files
app.get('/server-upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'server-upload.html'));
});

// API endpoint to list PDF files in the samples directory
app.get('/api/list-samples', (req, res) => {
  try {
    const samplesDir = path.join(__dirname, 'samples');
    
    // Create samples directory if it doesn't exist
    if (!fs.existsSync(samplesDir)) {
      fs.mkdirSync(samplesDir);
      return res.json({ files: [] });
    }
    
    // Read directory and filter for PDF files
    const files = fs.readdirSync(samplesDir)
      .filter(file => file.toLowerCase().endsWith('.pdf'));
    
    res.json({ files });
  } catch (error) {
    console.error('Error listing sample files:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to process a sample file
app.get('/api/process-sample', (req, res) => {
  try {
    const fileName = req.query.file;
    
    if (!fileName) {
      return res.status(400).json({ error: 'No file specified' });
    }
    
    // Ensure the file is from the samples directory (security measure)
    const filePath = path.join(__dirname, 'samples', fileName);
    
    // Basic security check to prevent directory traversal
    if (!filePath.startsWith(path.join(__dirname, 'samples'))) {
      return res.status(403).json({ error: 'Invalid file path' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Log file information
    const stats = fs.statSync(filePath);
    console.log(`Processing sample file: ${filePath}`);
    console.log(`File size: ${stats.size} bytes`);
    
    // Check if file is a PDF
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);
    
    const isPDF = buffer.toString().startsWith('%PDF-');
    console.log(`File header check: isPDF=${isPDF}, header=${buffer.toString('hex')}`);
    
    if (!isPDF) {
      return res.status(400).json({ error: 'The selected file is not a valid PDF' });
    }
    
    // Execute the verify-citations command
    const { exec } = require('child_process');
    exec(`npx ts-node verify-citations.ts process "${filePath}" --verbose`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error processing sample file:', error);
        console.error('Command output:', stdout);
        console.error('Command errors:', stderr);
        
        return res.status(500).json({
          error: 'Failed to process file',
          details: error.message,
          stdout,
          stderr
        });
      }
      
      // Return the command output
      res.setHeader('Content-Type', 'text/plain');
      res.send(stdout);
    });
  } catch (error) {
    console.error('Error in process-sample:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve the frontend static files
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// Parse JSON requests
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[DEBUG] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Enable Server-Sent Events for progress updates
const clients = {};
const sessionsProgress = {};

// Function to send SSE updates to clients for a specific session
function sendProgressUpdate(sessionId, data) {
  if (clients[sessionId]) {
    clients[sessionId].forEach(client => {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    });
  }
  // Store the latest progress data for this session
  sessionsProgress[sessionId] = data;
}

// API prefix middleware
app.use('/api', express.Router()
  // Simple test endpoint to verify file uploads
  .post('/test-upload', upload.single('file'), (req, res) => {
    console.log('TEST UPLOAD ENDPOINT HIT');
    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('File information:', req.file);
    
    return res.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size
      }
    });
  })

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
    sendProgressUpdate('verification', {
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
    
    clients['verification'] = clients['verification'] || [];
    clients['verification'].push(newClient);
    
    req.on('close', () => {
      console.log(`Client ${clientId} disconnected`);
      clients['verification'] = clients['verification'].filter(client => client.id !== clientId);
    });
  })
  // API endpoint to process a document
  .post('/process-document-local', upload.single('file'), async (req, res) => {
    try {
      console.log('Received request to process document locally');
      
      if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      console.log('File information:', req.file);
      
      // Generate a unique session ID for this processing request
      const sessionId = uuidv4();
      console.log(`Generated session ID: ${sessionId}`);
      
      // Create the progress file for this session
      const progressFilePath = path.join(__dirname, 'temp', `progress-${sessionId}.json`);
      
      try {
        // Ensure the temp directory exists
        if (!fs.existsSync(path.join(__dirname, 'temp'))) {
          fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });
        }
        
        // Write initial progress data
        fs.writeFileSync(progressFilePath, JSON.stringify({
          status: 'processing',
          currentReference: 'Preparing document...',
          currentIndex: 0,
          totalReferences: 0,
          processedReferences: []
        }));
        
        console.log(`Created progress file at: ${progressFilePath}`);
      } catch (fsError) {
        console.error('Error creating progress file:', fsError);
        return res.status(500).json({ 
          error: 'Error creating progress file', 
          details: fsError.message 
        });
      }
      
      // For debugging only - simplified response to test basic connectivity
      res.json({
        sessionId,
        status: 'starting',
        message: 'Document received, processing starting',
        references: [],
        progress: `/api/verification-progress/${sessionId}`
      });
      
      // Check if Gemini verification is requested
      const options = req.body.options ? JSON.parse(req.body.options) : {};
      const useGemini = options.useGemini === true;
      console.log(`Gemini verification requested: ${useGemini}`);
      
      // Start two-phase processing: extract first, then verify
      // Phase 1: Extract references quickly and return them to the client
      console.log('Starting Phase 1: Extracting references...');
      
      // Run the extract phase as an async process
      const extractProcess = exec(
        `node --no-warnings -r ts-node/register verify-citations.ts extract "${req.file.path}" -s ${sessionId} -v`,
        { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer for large documents
      );
      
      let extractionData = '';
      extractProcess.stdout.on('data', (data) => {
        extractionData += data;
        console.log('Extraction output:', data.toString());
      });
      
      extractProcess.stderr.on('data', (data) => {
        console.error('Extraction error:', data.toString());
      });
      
      // Wait for extraction to complete before starting verification
      extractProcess.on('close', (code) => {
        console.log(`Extraction process exited with code ${code}`);
        
        if (code !== 0) {
          console.error('Extraction failed, not starting verification');
          return;
        }
        
        // Phase 2: Verify each reference one by one (only start after extraction is complete)
        console.log('Starting Phase 2: Verifying references...');
        
        // Add Gemini flag if requested
        const geminiFlag = useGemini ? ' --gemini=true' : '';
        
        // Run the verify phase as an async process
        const verifyProcess = exec(
          `node --no-warnings -r ts-node/register verify-citations.ts verify "${req.file.path}" -s ${sessionId} -v${geminiFlag}`,
          { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer for large documents
        );
      
        let verificationData = '';
        verifyProcess.stdout.on('data', (data) => {
          verificationData += data;
          const logLine = data.toString().trim();
          
          // Log the original output
          console.log('Verification output:', logLine);
          
          // Parse special log markers for Gemini verification
          if (logLine.includes('[GEMINI:')) {
            try {
              // Extract the Gemini step
              const stepMatch = logLine.match(/\[GEMINI:(PREPARING|CALLING|PROCESSING|COMPLETED)\]/i);
              if (stepMatch) {
                const step = stepMatch[1].toLowerCase();
                
                // Extract the reference and details
                const parts = logLine.split(' - ');
                const reference = parts[0].split('] ')[1];
                const details = parts[1];
                
                // Extract result information if available
                let result = null;
                if (step === 'completed' && parts.length > 2 && parts[2].startsWith('Result:')) {
                  const resultPart = parts[2];
                  const isVerified = resultPart.includes('VERIFIED') && !resultPart.includes('NOT_VERIFIED');
                  
                  // Extract confidence score if available
                  const confidenceMatch = resultPart.match(/\((\d+)%\)/);
                  const confidenceScore = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.5;
                  
                  result = {
                    isVerified,
                    confidenceScore,
                    explanation: 'Extracted from verification log'
                  };
                }
                
                // Read the current progress
                let progress = {};
                if (fs.existsSync(progressFilePath)) {
                  progress = JSON.parse(fs.readFileSync(progressFilePath, 'utf8'));
                }
                
                // Update the progress with Gemini information
                const updatedProgress = {
                  ...progress,
                  geminiStatus: step,
                  currentStep: details,
                  stepProgress: step === 'preparing' ? 0 : 
                                step === 'calling' ? 1 : 
                                step === 'processing' ? 2 : 3,
                  totalSteps: 3
                };
                
                // Add the result if available
                if (result) {
                  updatedProgress.geminiResult = result;
                }
                
                // Write the updated progress back to the file
                fs.writeFileSync(progressFilePath, JSON.stringify(updatedProgress, null, 2));
              }
            } catch (error) {
              console.error('Error parsing Gemini log:', error);
            }
          }
        });
        
        verifyProcess.stderr.on('data', (data) => {
          console.error('Verification error:', data.toString());
        });
        
        // Log the completion of verification (async, after response is sent)
        verifyProcess.on('close', (code) => {
          if (code === 0) {
            console.log('Verification process completed successfully');
            
            // Clean up the progress file after verification is complete
            fs.unlink(progressFilePath, (err) => {
              if (err) {
                console.error(`Error removing progress file: ${err}`);
              } else {
                console.log(`Removed progress file: ${progressFilePath}`);
              }
            });
          } else {
            console.error(`Verification process exited with code ${code}`);
          }
        });
        
        verifyProcess.on('error', (error) => {
          console.error('Error in verification process:', error);
        });
      });
    } catch (error) {
      console.error('Error processing document locally:', error);
      res.status(500).json({ error: 'Error processing document', details: error.message });
    }
  })

  // API endpoint to verify a document with Gemini support
  .post('/verify', upload.single('file'), async (req, res) => {
    try {
      console.log('Received request to verify document with Gemini');
      
      if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      console.log('File information:', req.file);
      
      // Check if Gemini verification is requested
      const verifyWithGemini = req.body.verifyWithGemini === 'true';
      console.log(`Gemini verification requested: ${verifyWithGemini}`);
      
      // Generate a unique session ID for this processing request
      const sessionId = uuidv4();
      console.log(`Generated session ID: ${sessionId}`);
      
      // Create the progress file for this session
      const progressFilePath = path.join(__dirname, 'temp', `progress-${sessionId}.json`);
      
      try {
        // Ensure the temp directory exists
        if (!fs.existsSync(path.join(__dirname, 'temp'))) {
          fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });
        }
        
        // Write initial progress data
        fs.writeFileSync(progressFilePath, JSON.stringify({
          status: 'processing',
          currentReference: 'Preparing document...',
          currentIndex: 0,
          totalReferences: 0,
          processedReferences: []
        }));
        
        console.log(`Created progress file at: ${progressFilePath}`);
      } catch (fsError) {
        console.error('Error creating progress file:', fsError);
        return res.status(500).json({ 
          error: 'Error creating progress file', 
          details: fsError.message 
        });
      }
      
      // Send initial response to client
      res.json({
        sessionId,
        status: 'starting',
        message: 'Document received, processing starting',
        references: [],
        progress: `/api/verification-progress/${sessionId}`
      });
      
      // Start two-phase processing: extract first, then verify
      console.log('Starting document processing with Gemini verification if requested...');
      
      // Build command with Gemini flag if requested
      const geminiFlag = verifyWithGemini ? ' --gemini=true' : '';
      
      // Run the verify-citations.ts process command
      const verifyProcess = exec(
        `node --no-warnings -r ts-node/register verify-citations.ts process "${req.file.path}" -s ${sessionId} -v${geminiFlag}`,
        { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer for large documents
      );
      
      // Handle output and error streams
      verifyProcess.stdout.on('data', (data) => {
        const logLine = data.toString().trim();
        console.log('Verification output:', logLine);
        
        // Parse special log markers for Gemini verification
        if (logLine.includes('[GEMINI:')) {
          try {
            // Extract the Gemini step
            const stepMatch = logLine.match(/\[GEMINI:(PREPARING|CALLING|PROCESSING|COMPLETED)\]/i);
            if (stepMatch) {
              const step = stepMatch[1].toLowerCase();
              
              // Extract the reference and details
              const parts = logLine.split(' - ');
              const reference = parts[0].split('] ')[1];
              const details = parts[1];
              
              // Extract result information if available
              let result = null;
              if (step === 'completed' && parts.length > 2 && parts[2].startsWith('Result:')) {
                const resultPart = parts[2];
                const isVerified = resultPart.includes('VERIFIED') && !resultPart.includes('NOT_VERIFIED');
                
                // Extract confidence score if available
                const confidenceMatch = resultPart.match(/\((\d+)%\)/);
                const confidenceScore = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.5;
                
                result = {
                  isVerified,
                  confidenceScore,
                  explanation: 'Extracted from verification log'
                };
              }
              
              // Read the current progress
              let progress = {};
              if (fs.existsSync(progressFilePath)) {
                progress = JSON.parse(fs.readFileSync(progressFilePath, 'utf8'));
              }
              
              // Update the progress with Gemini information
              const updatedProgress = {
                ...progress,
                geminiStatus: step,
                currentStep: details,
                stepProgress: step === 'preparing' ? 0 : 
                              step === 'calling' ? 1 : 
                              step === 'processing' ? 2 : 3,
                totalSteps: 3
              };
              
              // Add the result if available
              if (result) {
                updatedProgress.geminiResult = result;
              }
              
              // Write the updated progress back to the file
              fs.writeFileSync(progressFilePath, JSON.stringify(updatedProgress, null, 2));
            }
          } catch (error) {
            console.error('Error parsing Gemini log:', error);
          }
        }
      });
      
      verifyProcess.stderr.on('data', (data) => {
        console.error('Verification error:', data.toString());
      });
      
      // Log the completion of verification (async, after response is sent)
      verifyProcess.on('close', (code) => {
        console.log(`Verification process exited with code ${code}`);
        
        // Update progress to completed
        try {
          if (fs.existsSync(progressFilePath)) {
            const progress = JSON.parse(fs.readFileSync(progressFilePath, 'utf8'));
            progress.status = code === 0 ? 'completed' : 'error';
            fs.writeFileSync(progressFilePath, JSON.stringify(progress, null, 2));
          }
        } catch (error) {
          console.error('Error updating progress file on completion:', error);
        }
      });
    } catch (error) {
      console.error('Error processing document:', error);
      res.status(500).json({ error: 'Error processing document', details: error.message });
    }
  })
  // API endpoint to get verification progress updates via Server-Sent Events (SSE)
  .get('/verification-progress/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const progressFilePath = path.join(__dirname, 'temp', `progress-${sessionId}.json`);
    
    console.log(`Client connected to SSE endpoint for session: ${sessionId}`);
    console.log(`Looking for progress updates at: ${progressFilePath}`);
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send initial connection message
    res.write(`data: ${JSON.stringify({ connected: true, sessionId })}\n\n`);
    
    // Function to read and send progress updates
    const sendUpdate = () => {
      try {
        console.log(`Checking for updates in: ${progressFilePath}`);
        if (fs.existsSync(progressFilePath)) {
          console.log(`Progress file exists`);
          const progressData = JSON.parse(fs.readFileSync(progressFilePath, 'utf8'));
          console.log(`Read progress data: ${JSON.stringify(progressData).substring(0, 100)}...`);
          
          // If there's geminiStatus in the progress data, add some human-readable information
          if (progressData.geminiStatus) {
            let geminiStatusMessage = '';
            switch (progressData.geminiStatus) {
              case 'preparing':
                geminiStatusMessage = 'Preparing to verify with AI';
                break;
              case 'calling':
                geminiStatusMessage = 'Calling AI to verify citation';
                break;
              case 'processing':
                geminiStatusMessage = 'Processing AI response';
                break;
              case 'completed':
                const result = progressData.geminiResult;
                geminiStatusMessage = result ? 
                  `AI verification ${result.isVerified ? 'succeeded' : 'failed'} (confidence: ${Math.round(result.confidenceScore * 100)}%)` :
                  'AI verification completed';
                break;
            }
            progressData.geminiStatusMessage = geminiStatusMessage;
          }
          
          res.write(`data: ${JSON.stringify(progressData)}\n\n`);
          
          // If verification is completed or errored, we can stop the interval
          if (progressData.status === 'completed' || progressData.status === 'error') {
            console.log(`Verification completed or errored, closing SSE connection`);
            clearInterval(intervalId);
            res.end();
          }
        } else {
          console.log(`Progress file does not exist: ${progressFilePath}`);
        }
      } catch (error) {
        console.error(`Error reading progress file for session ${sessionId}:`, error);
      }
    };
    
    // Send updates every 500ms
    const intervalId = setInterval(sendUpdate, 500);
    
    // Handle client disconnect
    req.on('close', () => {
      console.log(`Client disconnected from SSE endpoint for session: ${sessionId}`);
      clearInterval(intervalId);
    });
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
