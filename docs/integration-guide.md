# Citation Verification System Integration Guide

This guide will help you integrate the citation verification functionality into your website demo by explaining the essential code components and providing implementation instructions.

## 1. Core Components Overview

The citation verification system consists of the following essential components:

### 1.1 Document Processing
- **Purpose**: Processes PDF documents to extract metadata and full text
- **Key Files**: 
  - `src/document-extraction/document-processor.ts`
  - `src/document-extraction/document-parser.ts`

### 1.2 Reference Extraction
- **Purpose**: Extracts references from academic papers
- **Key Files**: 
  - `src/reference-extraction/reference-extractor.ts`
  - `src/reference-extraction/citation-processor.ts`

### 1.3 Citation Verification
- **Purpose**: Verifies citations by comparing them to documents in the database
- **Key Files**: 
  - `src/reference-comparison/citation-verifier.ts`
  - `src/reference-comparison/document-loader.ts`

### 1.4 Document Database
- **Purpose**: Stores and indexes documents for verification
- **Key Files**: 
  - `src/document-database/index.ts`
  - `src/document-database/index.json`

## 2. Integration Instructions

### 2.1 Setting Up a Backend API

Create these API endpoints in your web application:

```typescript
// Express.js example
import express from 'express';
import multer from 'multer';
import path from 'path';
import { ReferenceExtractor } from './src/reference-extraction';
import { CitationVerifier } from './src/reference-comparison';
import { DocumentProcessor } from './src/document-extraction';
import { DocumentDatabase } from './src/document-database';

const app = express();
const upload = multer({ dest: 'uploads/' });

// 1. API endpoint to extract references from a PDF
app.post('/api/extract-references', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const extractor = new ReferenceExtractor();
    const references = await extractor.extractFromPdf(req.file.path);
    
    return res.json({ references });
  } catch (error) {
    console.error('Error extracting references:', error);
    return res.status(500).json({ error: 'Failed to extract references' });
  }
});

// 2. API endpoint to verify citations
app.post('/api/verify-citations', express.json(), async (req, res) => {
  try {
    const { references } = req.body;
    if (!references) {
      return res.status(400).json({ error: 'No references provided' });
    }
    
    const verifier = new CitationVerifier(path.join(__dirname, 'src', 'document-database'));
    const report = await verifier.verifyCitations('submitted-paper', references);
    
    return res.json({ report });
  } catch (error) {
    console.error('Error verifying citations:', error);
    return res.status(500).json({ error: 'Failed to verify citations' });
  }
});

// 3. API endpoint to add a document to the database
app.post('/api/add-document', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const docProcessor = new DocumentProcessor();
    const metadata = await docProcessor.processPdf(req.file.path);
    
    const db = new DocumentDatabase();
    await db.addDocument(req.file.path, metadata);
    
    return res.json({ success: true, document: metadata });
  } catch (error) {
    console.error('Error adding document:', error);
    return res.status(500).json({ error: 'Failed to add document' });
  }
});

// 4. API endpoint to get documents from the database
app.get('/api/list-documents', async (req, res) => {
  try {
    const db = new DocumentDatabase();
    const documents = await db.getAllDocuments();
    
    return res.json({ documents });
  } catch (error) {
    console.error('Error listing documents:', error);
    return res.status(500).json({ error: 'Failed to list documents' });
  }
});

// 5. Optional: API endpoint to rebuild the document index
app.post('/api/rebuild-index', async (req, res) => {
  try {
    // Use the manual rebuild function from verify-citations.ts
    const { rebuildIndex } = require('./verify-citations');
    await rebuildIndex();
    
    return res.json({ success: true, message: 'Index rebuilt successfully' });
  } catch (error) {
    console.error('Error rebuilding index:', error);
    return res.status(500).json({ error: 'Failed to rebuild index' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### 2.2 Frontend Implementation

Create a simple React frontend to interact with these API endpoints:

```jsx
// Sample React components for citation verification
import React, { useState } from 'react';
import axios from 'axios';

export function CitationVerifier() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [references, setReferences] = useState(null);
  const [verificationResults, setVerificationResults] = useState(null);
  
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };
  
  const extractReferences = async () => {
    if (!file) return;
    
    setLoading(true);
    const formData = new FormData();
    formData.append('pdf', file);
    
    try {
      const response = await axios.post('/api/extract-references', formData);
      setReferences(response.data.references);
    } catch (error) {
      console.error('Error extracting references:', error);
      alert('Failed to extract references');
    } finally {
      setLoading(false);
    }
  };
  
  const verifyCitations = async () => {
    if (!references) return;
    
    setLoading(true);
    try {
      const response = await axios.post('/api/verify-citations', { references });
      setVerificationResults(response.data.report);
    } catch (error) {
      console.error('Error verifying citations:', error);
      alert('Failed to verify citations');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="citation-verifier">
      <h1>Citation Verification Tool</h1>
      
      <div className="upload-section">
        <h2>Step 1: Upload Academic Paper</h2>
        <input type="file" accept=".pdf" onChange={handleFileChange} />
        <button onClick={extractReferences} disabled={!file || loading}>
          Extract References
        </button>
      </div>
      
      {references && (
        <div className="references-section">
          <h2>Step 2: Review Extracted References</h2>
          <p>Found {references.length} references</p>
          <ul>
            {references.map((ref, index) => (
              <li key={index}>
                {ref.reference.title} ({ref.reference.year})
              </li>
            ))}
          </ul>
          <button onClick={verifyCitations} disabled={loading}>
            Verify Citations
          </button>
        </div>
      )}
      
      {verificationResults && (
        <div className="results-section">
          <h2>Step 3: Citation Verification Results</h2>
          <div className="summary">
            <p>Total Citations: {verificationResults.totalCitationsChecked}</p>
            <p>Verified: {verificationResults.verifiedCitations}</p>
            <p>Unverified: {verificationResults.unverifiedCitations}</p>
            <p>Inconclusive: {verificationResults.inconclusiveCitations}</p>
          </div>
          
          <h3>Detailed Results</h3>
          <ul className="results-list">
            {verificationResults.results.map((result, index) => (
              <li key={index} className={result.isVerified ? "verified" : result.confidenceScore > 0 ? "unverified" : "inconclusive"}>
                <h4>{result.referenceTitle}</h4>
                <p>Citation Context: "{result.citationContext}"</p>
                <p>Status: {result.isVerified ? "Verified" : result.confidenceScore > 0 ? "Unverified" : "Inconclusive"}</p>
                <p>Confidence: {Math.round(result.confidenceScore * 100)}%</p>
                <p>Explanation: {result.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## 3. Running the Essential Code

To run the essential parts of the citation verification system:

1. **Start the GROBID Service**:
   ```bash
   # If using Docker
   docker run -t --rm -p 8070:8070 lfoppiano/grobid:0.7.2
   ```

2. **Initialize the Document Database**:
   ```bash
   # Create necessary directories if they don't exist
   mkdir -p src/document-database/documents
   mkdir -p src/document-database/pdf-documents
   
   # Initialize the index if needed
   npx ts-node verify-citations.ts rebuild-index
   ```

3. **Add Documents to the Database**:
   ```bash
   # Add academic papers to be used for verification
   npx ts-node verify-citations.ts add-document path/to/paper.pdf
   ```

4. **Run the Verification Process**:
   ```bash
   # Extract references from a paper
   npx ts-node verify-citations.ts extract path/to/paper.pdf paper-references.json
   
   # Verify citations against the database
   npx ts-node verify-citations.ts verify paper-references.json
   ```

5. **Use Local Verification Mode**: Add the `--local` flag when Gemini API access is unavailable:
   ```bash
   npx ts-node verify-citations.ts verify paper-references.json --local
   ```

## 4. Configuration Options

For the website demo, you'll need to manage these environment variables:

```javascript
// Environment Configuration
const config = {
  // GROBID service URL
  GROBID_URL: process.env.GROBID_URL || 'http://localhost:8070',
  
  // Gemini API key (if using Google's Generative AI)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  
  // Document database path
  DB_PATH: process.env.DB_PATH || path.join(__dirname, 'src', 'document-database'),
  
  // Timeout values
  PROCESS_TIMEOUT: parseInt(process.env.PROCESS_TIMEOUT || '60000'),
  
  // Local verification flag
  USE_LOCAL_VERIFICATION: process.env.USE_LOCAL_VERIFICATION === 'true' || false
};
```

## 5. Integration Checklist

- [ ] Set up backend API endpoints
- [ ] Create frontend components 
- [ ] Configure GROBID service
- [ ] Initialize document database
- [ ] Add academic papers to the database
- [ ] Implement file upload functionality
- [ ] Create visualization for verification results
- [ ] Add error handling and progress indicators
- [ ] Implement caching for improved performance
