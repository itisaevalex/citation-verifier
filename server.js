const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const app = express();
const port = 3000;

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

// API endpoint to process a document
app.post('/process-document-local', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const pdfPath = req.file.path;
  
  // Run the verify-citations.ts script using exec which uses the shell
  // This will have access to the same PATH that your command line has
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
    const verificationFilePath = `${pdfPath.replace('.pdf', '')}-verification.json`;
    
    try {
      // Read the references file
      let references = [];
      if (fs.existsSync(referencesFilePath)) {
        references = JSON.parse(fs.readFileSync(referencesFilePath, 'utf8'));
      }
      
      // Read the verification report if it exists
      let verificationReport = null;
      if (fs.existsSync(verificationFilePath)) {
        verificationReport = JSON.parse(fs.readFileSync(verificationFilePath, 'utf8'));
      }
      
      // Return the results
      res.json({
        references,
        verificationReport: verificationReport || {
          documentTitle: path.basename(pdfPath, '.pdf'),
          totalCitationsChecked: references.length,
          verifiedCitations: 0,
          unverifiedCitations: 0,
          inconclusiveCitations: references.length,
          missingReferences: 0
        }
      });
      
      // Clean up the temporary files
      // fs.unlinkSync(pdfPath);
      // if (fs.existsSync(referencesFilePath)) fs.unlinkSync(referencesFilePath);
      // if (fs.existsSync(verificationFilePath)) fs.unlinkSync(verificationFilePath);
      
    } catch (error) {
      console.error('Error reading results:', error);
      res.status(500).json({ 
        error: 'Failed to read processing results',
        details: error.message 
      });
    }
  });
});

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
