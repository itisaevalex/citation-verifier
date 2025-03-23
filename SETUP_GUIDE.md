# TruthSource: Citation Verifier - Setup Guide

This guide provides step-by-step instructions for setting up and running the TruthSource citation verification system, including both backend and frontend components.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Setting up GROBID](#setting-up-grobid)
- [Setting up the Backend](#setting-up-the-backend)
- [Setting up the Frontend](#setting-up-the-frontend)
- [Running the Complete System](#running-the-complete-system)
- [Testing the System](#testing-the-system)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Ensure you have the following installed:

- Node.js (v14+) and npm
- Docker and Docker Compose
- Git
- A Gemini API key (for AI-powered citation verification)

## Initial Setup

1. Clone the repository:
   ```powershell
   git clone https://github.com/your-repo/citation-verifier.git
   cd citation-verifier
   ```

2. Install dependencies for the backend:
   ```powershell
   npm install
   ```

3. Install dependencies for the frontend:
   ```powershell
   cd frontend
   npm install
   cd ..
   ```

4. Create a `.env` file in the root directory with the following contents:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   GROBID_URL=http://localhost:8070
   NODE_ENV=development
   PORT=3000
   ```

## Setting up GROBID

GROBID is a crucial component for extracting structured information from PDF documents.

### Option 1: Run GROBID using Docker (Recommended)

1. Pull and run the GROBID Docker image:
   ```powershell
   docker pull lfoppiano/grobid:0.7.2
   docker run -p 8070:8070 -d --name grobid lfoppiano/grobid:0.7.2
   ```

2. Verify GROBID is running:
   ```powershell
   curl http://localhost:8070/api/isalive
   ```
   You should receive a "true" response.

### Option 2: Run GROBID locally

If you prefer to run GROBID locally without Docker:

1. Follow the installation instructions at: https://grobid.readthedocs.io/en/latest/Install-Grobid/
2. Start GROBID with:
   ```powershell
   cd path/to/grobid
   ./gradlew run
   ```

## Setting up the Backend

1. Build the TypeScript code:
   ```powershell
   npm run build
   ```

2. Test your GROBID integration to ensure it's working correctly:
   ```powershell
   npx ts-node test-grobid-integration.ts sample-paper.pdf
   ```
   This test script should connect to GROBID, process the sample PDF, and produce output files.

## Setting up the Frontend

1. Navigate to the frontend directory:
   ```powershell
   cd frontend
   ```

2. Configure the frontend to connect to your backend by editing `src/config.ts` if necessary.

3. Build the frontend:
   ```powershell
   npm run build
   ```

## Running the Complete System

### Development Mode

1. Start the backend server:
   ```powershell
   # From the root directory
   npm run dev
   ```

2. In a separate terminal, start the frontend development server:
   ```powershell
   cd frontend
   npm run dev
   ```

3. Access the application:
   - Backend API: http://localhost:3000
   - Frontend: http://localhost:5173

### Production Mode

1. Build both backend and frontend:
   ```powershell
   npm run build
   cd frontend
   npm run build
   cd ..
   ```

2. Start the production server:
   ```powershell
   npm start
   ```

3. Access the application at http://localhost:3000

## Testing the System

### Command-line Citation Verification

You can verify citations from the command line using:

```powershell
npx ts-node verify-citations.ts process path/to/your/paper.pdf --verbose
```

This will:
1. Extract references from the PDF
2. Match citation contexts to references
3. Verify citations against the document database
4. Generate a verification report

### Web Interface

1. Access the web interface at http://localhost:5173 (dev) or http://localhost:3000 (prod)
2. Upload a PDF document
3. View the extraction and verification results

## Troubleshooting

### GROBID Connection Issues

If you encounter GROBID connection issues:

1. Verify GROBID is running:
   ```powershell
   curl http://localhost:8070/api/isalive
   ```

2. Run the diagnostic tool:
   ```powershell
   npx ts-node debug-grobid.js
   ```

3. Check your GROBID URL configuration in the `.env` file

### PDF Processing Errors

If you encounter errors processing specific PDFs:

1. Ensure the PDF is not corrupted or password-protected
2. Try with the debug script:
   ```powershell
   node debug-grobid.js path/to/problematic/paper.pdf
   ```

3. Check the log outputs for specific error messages

### API Key Issues

If you encounter issues with the Gemini API:

1. Verify your API key is correctly set in the `.env` file
2. Ensure your API key has not expired or reached its quota limit
3. Check your network connectivity to the Gemini API endpoints

## Next Steps

After setting up and running the system, you can:

- Add more documents to the reference database
- Customize the verification rules
- Integrate with publishing workflows
- Contribute to the project by improving extraction and verification algorithms

For more information and advanced configuration options, refer to the main project documentation.
