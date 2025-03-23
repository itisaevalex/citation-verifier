#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as path from 'path';
import { ReferenceExtractor } from './src/reference-extraction';
import { CitationVerifier, VerificationOptions, VerificationProgress, Reference as VerifierReference } from './src/reference-comparison';
import { DocumentDatabase } from './src/document-database/index';
import { config, MissingReferenceHandling, validateConfig } from './src/config';
import { Command } from 'commander';

const program = new Command();

// Define the commands
const COMMANDS = {
  EXTRACT: 'extract',
  VERIFY: 'verify',
  ADD_DOC: 'add-document',
  LIST_DOCS: 'list-documents',
  REBUILD_INDEX: 'rebuild-index',
  PROCESS: 'process', 
  HELP: 'help'
};

/**
 * Write progress information to a file for real-time tracking
 * @param sessionId Unique session ID for the verification process
 * @param progress Progress data to write
 */
function writeProgressToFile(sessionId: string, progress: VerificationProgress): void {
  if (!sessionId) return;
  
  const tempDir = path.join(__dirname, 'temp');
  
  // Ensure temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const progressFilePath = path.join(tempDir, `progress-${sessionId}.json`);
  
  try {
    fs.writeFileSync(progressFilePath, JSON.stringify(progress, null, 2));
    if (progress.status === 'processing') {
      console.log(`Progress updated: Processing reference ${progress.currentIndex + 1}/${progress.totalReferences}`);
    } else {
      console.log(`Progress updated: ${progress.status}`);
    }
  } catch (error) {
    console.error('Error writing progress file:', error);
  }
}

/**
 * Print command usage information
 */
function printUsage() {
  console.log(`
  Citation Verification Tool

  Usage:
    ts-node verify-citations.ts <command> [options]

  Commands:
    extract <pdf>          Extract references and citation contexts from a PDF document
    verify <pdf>           Verify extracted references against document database
    process <pdf>          Process a document through the complete citation verification workflow
    add-document <path>    Add a document to the database
    list-documents         List documents in the database
    rebuild-index          Rebuild the document database index
    help                   Show this help message

  Options:
    -o, --output-dir <dir>              Output directory for results
    -s, --session-id <id>               Session ID for progress tracking
    -m, --missing-ref-handling <mode>   How to handle missing references (log|ignore|simulate)
    -c, --confidence-threshold <value>  Confidence threshold for verification (0.0-1.0)
    -k, --api-key <key>                 Google API key for Gemini API
    -v, --verbose                       Enable verbose output
  `);
}

/**
 * Setup CLI program
 */
function setupProgram() {
  program
    .name('verify-citations')
    .description('Citation verification tool')
    .version('1.0.0');

  // Process command
  program
    .command(COMMANDS.PROCESS)
    .description('Complete workflow: extract references and verify citations')
    .argument('<pdf-path>', 'Path to the PDF file')
    .option('--missing-ref-handling <mode>', 'How to handle missing references (log, skip, prompt, fetch)', config.missingRefHandling)
    .option('--api-key <key>', 'Google API key for Gemini')
    .option('--verbose', 'Enable verbose output')
    .option('--session-id <id>', 'Unique session ID for progress tracking')
    .option('--confidence-threshold <number>', 'Confidence threshold (0-1) for verification', '0.7')
    .option('--gemini [boolean]', 'Enable Gemini AI verification for citations')
    .action(async (pdfPath, options) => {
      try {
        await processDocument([pdfPath], options);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Extract command
  program
    .command(COMMANDS.EXTRACT)
    .description('Extract references from a PDF')
    .argument('<pdf-path>', 'Path to the PDF file')
    .argument('[output-path]', 'Path to save extracted references')
    .option('--verbose', 'Enable verbose output')
    .action(async (pdfPath, outputPath, options) => {
      try {
        await extractReferences([pdfPath, outputPath], options);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Verify command
  program
    .command(COMMANDS.VERIFY)
    .description('Verify citations against the document database')
    .argument('<references-json>', 'Path to references JSON file')
    .option('--missing-ref-handling <mode>', 'How to handle missing references (log, skip, prompt, fetch)', config.missingRefHandling)
    .option('--api-key <key>', 'Google API key for Gemini')
    .option('--verbose', 'Enable verbose output')
    .option('--confidence-threshold <number>', 'Confidence threshold for verification (0.0-1.0)')
    .option('--gemini [boolean]', 'Enable Gemini AI verification for citations')
    .action(async (referencesJson, options) => {
      try {
        await verifyReferences([referencesJson], options);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Add document command
  program
    .command(COMMANDS.ADD_DOC)
    .description('Add a document to the database')
    .argument('<pdf-path>', 'Path to the PDF file')
    .argument('[metadata-json]', 'Path to JSON metadata file')
    .action(async (pdfPath, metadataJson) => {
      try {
        await addDocument([pdfPath, metadataJson]);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // List documents command
  program
    .command(COMMANDS.LIST_DOCS)
    .description('List all documents in the database')
    .action(() => {
      try {
        listDocuments();
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Rebuild index command
  program
    .command(COMMANDS.REBUILD_INDEX)
    .description('Rebuild the document database index')
    .action(() => {
      try {
        rebuildIndex();
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Help command
  program
    .command(COMMANDS.HELP)
    .description('Show help')
    .action(() => {
      program.help();
    });

  // Default behavior for unknown commands
  program
    .command('*', { hidden: true })
    .action(() => {
      console.error('Unknown command');
      program.help();
    });
}

/**
 * Main function
 */
async function main() {
  try {
    // Config validation
    validateConfig();
    
    // Set up command line interface
    program
      .version('1.0.0')
      .description('Citation Verification Tool');
    
    program
      .command('extract <pdf>')
      .description('Extract references and citation contexts from a PDF document')
      .option('-o, --output-dir <dir>', 'Output directory for extracted references')
      .option('-s, --session-id <id>', 'Session ID for progress tracking')
      .option('-v, --verbose', 'Enable verbose output')
      .action(async (pdf, options) => {
        await extractReferences([pdf], options);
      });
    
    program
      .command('verify <pdf>')
      .description('Verify extracted references against document database')
      .option('-o, --output-dir <dir>', 'Output directory for verification report')
      .option('-s, --session-id <id>', 'Session ID for progress tracking')
      .option('-m, --missing-ref-handling <mode>', 'How to handle missing references (log|ignore|simulate)')
      .option('-c, --confidence-threshold <threshold>', 'Confidence threshold for verification (0.0-1.0)')
      .option('-k, --api-key <key>', 'Google API key for Gemini API')
      .option('-v, --verbose', 'Enable verbose output')
      .action(async (pdf, options) => {
        await verifyReferences([pdf], options);
      });
      
    program
      .command('process <pdf>')
      .description('Process a document through the complete citation verification workflow')
      .option('-o, --output-dir <dir>', 'Output directory for results')
      .option('-s, --session-id <id>', 'Session ID for progress tracking')
      .option('-m, --missing-ref-handling <mode>', 'How to handle missing references (log|ignore|simulate)')
      .option('-c, --confidence-threshold <threshold>', 'Confidence threshold for verification (0.0-1.0)')
      .option('-k, --api-key <key>', 'Google API key for Gemini API')
      .option('-v, --verbose', 'Enable verbose output')
      .option('--gemini [boolean]', 'Enable Gemini AI verification for citations')
      .action(async (pdf, options) => {
        await processDocument([pdf], options);
      });
    
    program
      .command('add-document <pdf>')
      .description('Add a document to the database')
      .option('-m, --metadata <file>', 'Path to JSON metadata file')
      .action(async (pdf, options) => {
        await addDocument([pdf, options.metadata]);
      });
    
    program
      .command('list-documents')
      .description('List documents in the database')
      .action(() => {
        listDocuments();
      });
    
    program
      .command('rebuild-index')
      .description('Rebuild the document database index')
      .action(() => {
        rebuildIndex();
      });
    
    // Execute the parsed command
    await program.parseAsync(process.argv);
    
    // If no command is provided, print usage
    if (!process.argv.slice(2).length) {
      program.outputHelp();
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Process a document through the complete citation verification workflow:
 * 1. Extract references and citation contexts from PDF
 * 2. Verify citations against the document database
 * 3. Generate a comprehensive verification report
 * 
 * @param args Command arguments
 * @param options Command options
 */
async function processDocument(args: string[], options: any = {}) {
  const pdfPath = args[0];
  const verbose = options.verbose || false;
  const sessionId = options.sessionId || '';
  
  if (verbose) {
    console.log('Processing document with options:', options);
  }
  
  // Update missing reference handling if specified
  if (options.missingRefHandling) {
    config.missingRefHandling = options.missingRefHandling as MissingReferenceHandling;
  }
  
  // Update API key if specified
  if (options.apiKey) {
    config.googleApiKey = options.apiKey;
  }
  
  // Update confidence threshold if specified
  const confidenceThreshold = options.confidenceThreshold ? 
    parseFloat(options.confidenceThreshold) : 0.7;
  
  if (verbose) {
    console.log(`Extracting references from: ${pdfPath}`);
  }
  
  // Send initial progress update
  if (sessionId) {
    writeProgressToFile(sessionId, {
      currentReference: 'Starting document processing',
      currentIndex: 0,
      totalReferences: 0,
      processedReferences: [] as VerifierReference[],
      status: 'processing'
    });
  }
  
  try {
    // 1. Extract references and citation contexts from PDF
    if (verbose) console.log('Step 1: Extracting references and citation contexts...');
    
    const extractor = new ReferenceExtractor();
    
    // Check the GROBID service first
    if (verbose) console.log('Checking GROBID service...');
    const serviceAvailable = await extractor.checkService();
    if (!serviceAvailable) {
      console.error('ERROR: GROBID service is not running. Please start it first.');
      
      // Send error progress update
      if (sessionId) {
        writeProgressToFile(sessionId, {
          currentReference: 'Error: GROBID service not available',
          currentIndex: 0,
          totalReferences: 0,
          processedReferences: [] as VerifierReference[],
          status: 'error',
          error: 'GROBID service is not running'
        });
      }
      
      return;
    }
    
    // Update progress
    if (sessionId) {
      writeProgressToFile(sessionId, {
        currentReference: 'Extracting references from document',
        currentIndex: 0,
        totalReferences: 0,
        processedReferences: [] as VerifierReference[],
        status: 'processing'
      });
    }
    
    const enhancedRefs = await extractor.extractReferencesWithContext(pdfPath);
    
    if (verbose) {
      console.log(`Extracted ${enhancedRefs.length} references with citation contexts`);
    }
    
    // Write extracted references to file
    const outputDir = options.outputDir || path.dirname(pdfPath);
    const fileNameWithoutExt = path.basename(pdfPath, '.pdf');
    const referencesPath = path.join(outputDir, `${fileNameWithoutExt}-references.json`);
    
    fs.writeFileSync(referencesPath, JSON.stringify(enhancedRefs, null, 2));
    
    if (verbose) {
      console.log(`Reference data saved to: ${referencesPath}`);
    }
    
    // 2. Verify citations against the document database
    if (verbose) console.log('\nStep 2: Verifying citations against document database...');
    
    // Create verification options from command line options
    const verificationOptions: VerificationOptions = {
      missingRefHandling: config.missingRefHandling,
      confidenceThreshold,
      verbose,
      saveIntermediateResults: true,
      useGemini: options.gemini ? true : false
    };
    
    // Create progress callback function if we have a session ID
    const progressCallback = sessionId ? 
      (progress: VerificationProgress) => writeProgressToFile(sessionId, progress) : 
      undefined;
    
    // Create verifier with progress callback
    const verifier = new CitationVerifier(
      config.documentDbPath, 
      verificationOptions,
      progressCallback,
      sessionId
    );
    
    // Get document title from file name
    const documentTitle = path.basename(pdfPath, '.pdf').replace(/-/g, ' ').replace(/_/g, ' ');
    
    // Verify all citations
    const report = await verifier.verifyAllCitations(enhancedRefs, documentTitle);
    
    if (verbose) {
      console.log('\nVerification complete!');
      console.log(`Verified: ${report.verifiedCitations}, Unverified: ${report.unverifiedCitations}, Inconclusive: ${report.inconclusiveCitations}`);
      console.log(`Missing references: ${report.missingReferences}`);
    }
    
    // Write verification report to file
    const reportPath = path.join(outputDir, `${fileNameWithoutExt}-verification-report.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    if (verbose) {
      console.log(`Verification report saved to: ${reportPath}`);
    }
    
    // 3. Generate reference list with verification status for frontend
    const references = enhancedRefs.map((ref, index) => {
      const result = report.results[index];
      return {
        id: `ref-${index + 1}`,
        title: ref.title,
        authors: ref.authors,
        year: ref.year || '',
        status: result.isVerified ? 'valid' as const : 
                (result.confidenceScore < 0 ? 'uncertain' as const : 'invalid' as const),
        link: ref.doi ? `https://doi.org/${ref.doi}` : '#'
      };
    });
    
    // Create a json file for the references with statuses for the frontend
    const frontendRefsPath = path.join(outputDir, `${fileNameWithoutExt}-frontend-references.json`);
    fs.writeFileSync(frontendRefsPath, JSON.stringify({ references }, null, 2));
    
    if (verbose) {
      console.log(`Frontend references saved to: ${frontendRefsPath}`);
    }
    
    // Print the output in JSON format for the server to parse (at the end)
    console.log(JSON.stringify({ references, report }));
    
    // Send final progress update
    if (sessionId) {
      writeProgressToFile(sessionId, {
        currentReference: 'Completed',
        currentIndex: enhancedRefs.length,
        totalReferences: enhancedRefs.length,
        processedReferences: references.map(ref => ({
          id: ref.id,
          title: ref.title,
          status: ref.status as 'valid' | 'invalid' | 'uncertain',
          link: ref.link
        } as VerifierReference)),
        status: 'completed'
      });
    }
    
  } catch (error) {
    console.error('Error processing document:', error);
    
    // Send error progress update
    if (sessionId) {
      writeProgressToFile(sessionId, {
        currentReference: 'Error processing document',
        currentIndex: 0,
        totalReferences: 0,
        processedReferences: [] as VerifierReference[],
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * Extract references and citation contexts from a PDF document
 * @param args Command arguments
 * @param options Command options
 */
async function extractReferences(args: string[], options: any = {}) {
  const pdfPath = args[0];
  const verbose = options.verbose || false;
  const sessionId = options.sessionId || '';
  
  if (verbose) {
    console.log(`Extracting references from: ${pdfPath}`);
  }
  
  // Send initial progress update
  if (sessionId) {
    writeProgressToFile(sessionId, {
      currentReference: 'Starting reference extraction',
      currentIndex: 0,
      totalReferences: 0,
      processedReferences: [] as VerifierReference[],
      status: 'processing'
    });
  }
  
  try {
    // 1. Extract references and citation contexts from PDF
    if (verbose) console.log('Extracting references and citation contexts...');
    
    const extractor = new ReferenceExtractor();
    
    // Check the GROBID service first
    if (verbose) console.log('Checking GROBID service...');
    const serviceAvailable = await extractor.checkService();
    if (!serviceAvailable) {
      console.error('ERROR: GROBID service is not running. Please start it first.');
      
      // Send error progress update
      if (sessionId) {
        writeProgressToFile(sessionId, {
          currentReference: 'Error: GROBID service not available',
          currentIndex: 0,
          totalReferences: 0,
          processedReferences: [] as VerifierReference[],
          status: 'error',
          error: 'GROBID service is not running'
        });
      }
      
      return;
    }
    
    // Update progress
    if (sessionId) {
      writeProgressToFile(sessionId, {
        currentReference: 'Extracting references from document',
        currentIndex: 0,
        totalReferences: 0,
        processedReferences: [] as VerifierReference[],
        status: 'processing'
      });
    }
    
    const enhancedRefs = await extractor.extractReferencesWithContext(pdfPath);
    
    if (verbose) {
      console.log(`Extracted ${enhancedRefs.length} references with citation contexts`);
    }
    
    // Write extracted references to file
    const outputDir = options.outputDir || path.dirname(pdfPath);
    const fileNameWithoutExt = path.basename(pdfPath, '.pdf');
    const referencesPath = path.join(outputDir, `${fileNameWithoutExt}-references.json`);
    
    fs.writeFileSync(referencesPath, JSON.stringify(enhancedRefs, null, 2));
    
    if (verbose) {
      console.log(`Reference data saved to: ${referencesPath}`);
    }
    
    // Generate reference list with preliminary status for frontend
    const references = enhancedRefs.map((ref, index) => {
      return {
        id: `ref-${index + 1}`,
        title: ref.title,
        authors: ref.authors,
        year: ref.year || '',
        status: 'validating' as const,
        link: ref.doi ? `https://doi.org/${ref.doi}` : '#'
      };
    });
    
    // Send progress update with extracted references
    if (sessionId) {
      writeProgressToFile(sessionId, {
        currentReference: 'References extracted',
        currentIndex: enhancedRefs.length,
        totalReferences: enhancedRefs.length,
        processedReferences: references.map(ref => ({
          id: ref.id,
          title: ref.title,
          status: 'validating' as 'valid' | 'invalid' | 'uncertain',
          link: ref.link
        } as VerifierReference)),
        status: 'completed'
      });
    }
    
    // Print the output in JSON format for the server to parse
    console.log(JSON.stringify({ 
      references, 
      extractedReferences: enhancedRefs,
      status: 'completed',
      message: `Successfully extracted ${enhancedRefs.length} references`
    }));
    
  } catch (error) {
    console.error('Error extracting references:', error);
    
    // Send error progress update
    if (sessionId) {
      writeProgressToFile(sessionId, {
        currentReference: 'Error extracting references',
        currentIndex: 0,
        totalReferences: 0,
        processedReferences: [] as VerifierReference[],
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * Verify extracted references against document database
 * @param args Command arguments
 * @param options Command options
 */
async function verifyReferences(args: string[], options: any = {}) {
  const pdfPath = args[0];
  const verbose = options.verbose || false;
  const sessionId = options.sessionId || '';
  
  if (verbose) {
    console.log(`Verifying references for document: ${pdfPath}`);
  }
  
  // Update missing reference handling if specified
  if (options.missingRefHandling) {
    config.missingRefHandling = options.missingRefHandling as MissingReferenceHandling;
  }
  
  // Update API key if specified
  if (options.apiKey) {
    config.googleApiKey = options.apiKey;
  }
  
  // Update confidence threshold if specified
  const confidenceThreshold = options.confidenceThreshold ? 
    parseFloat(options.confidenceThreshold) : 0.7;
  
  try {
    // First, load the extracted references
    const fileNameWithoutExt = path.basename(pdfPath, '.pdf');
    const outputDir = options.outputDir || path.dirname(pdfPath);
    const referencesPath = path.join(outputDir, `${fileNameWithoutExt}-references.json`);
    
    if (!fs.existsSync(referencesPath)) {
      console.error(`ERROR: References file not found at ${referencesPath}`);
      console.error('Please extract references first using the extract command');
      
      // Send error progress update
      if (sessionId) {
        writeProgressToFile(sessionId, {
          currentReference: 'Error: References not found',
          currentIndex: 0,
          totalReferences: 0,
          processedReferences: [] as VerifierReference[],
          status: 'error',
          error: `References file not found at ${referencesPath}`
        });
      }
      
      return;
    }
    
    const enhancedRefs = JSON.parse(fs.readFileSync(referencesPath, 'utf8'));
    
    if (verbose) {
      console.log(`Loaded ${enhancedRefs.length} references from ${referencesPath}`);
      console.log('Verifying citations against document database...');
    }
    
    // Create verification options from command line options
    const verificationOptions: VerificationOptions = {
      missingRefHandling: config.missingRefHandling,
      confidenceThreshold,
      verbose,
      saveIntermediateResults: true,
      useGemini: options.gemini ? true : false
    };
    
    // Create progress callback function if we have a session ID
    const progressCallback = sessionId ? 
      (progress: VerificationProgress) => writeProgressToFile(sessionId, progress) : 
      undefined;
    
    // Create verifier with progress callback
    const verifier = new CitationVerifier(
      config.documentDbPath, 
      verificationOptions,
      progressCallback,
      sessionId
    );
    
    // Get document title from file name
    const documentTitle = path.basename(pdfPath, '.pdf').replace(/-/g, ' ').replace(/_/g, ' ');
    
    // Verify all citations
    const report = await verifier.verifyAllCitations(enhancedRefs, documentTitle);
    
    if (verbose) {
      console.log('\nVerification complete!');
      console.log(`Verified: ${report.verifiedCitations}, Unverified: ${report.unverifiedCitations}, Inconclusive: ${report.inconclusiveCitations}`);
      console.log(`Missing references: ${report.missingReferences}`);
    }
    
    // Write verification report to file
    const reportPath = path.join(outputDir, `${fileNameWithoutExt}-verification-report.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    if (verbose) {
      console.log(`Verification report saved to: ${reportPath}`);
    }
    
    // Generate reference list with verification status for frontend
    const references = enhancedRefs.map((ref: any, index: number) => {
      const result = report.results[index];
      return {
        id: `ref-${index + 1}`,
        title: ref.title,
        authors: ref.authors,
        year: ref.year || '',
        status: result.isVerified ? 'valid' as const : 
                (result.confidenceScore < 0 ? 'uncertain' as const : 'invalid' as const),
        link: ref.doi ? `https://doi.org/${ref.doi}` : '#'
      };
    });
    
    // Create a json file for the references with statuses for the frontend
    const frontendRefsPath = path.join(outputDir, `${fileNameWithoutExt}-frontend-references.json`);
    fs.writeFileSync(frontendRefsPath, JSON.stringify({ references }, null, 2));
    
    if (verbose) {
      console.log(`Frontend references saved to: ${frontendRefsPath}`);
    }
    
    // Send final progress update
    if (sessionId) {
      writeProgressToFile(sessionId, {
        currentReference: 'Verification completed',
        currentIndex: enhancedRefs.length,
        totalReferences: enhancedRefs.length,
        processedReferences: references.map((ref: any) => ({
          id: ref.id,
          title: ref.title,
          status: ref.status as 'valid' | 'invalid' | 'uncertain',
          link: ref.link
        } as VerifierReference)),
        status: 'completed'
      });
    }
    
    // Print the output in JSON format for the server to parse
    console.log(JSON.stringify({ references, report }));
    
  } catch (error) {
    console.error('Error verifying references:', error);
    
    // Send error progress update
    if (sessionId) {
      writeProgressToFile(sessionId, {
        currentReference: 'Error verifying references',
        currentIndex: 0,
        totalReferences: 0,
        processedReferences: [] as VerifierReference[],
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * Add a document to the database
 * @param args Command arguments
 */
async function addDocument(args: string[]) {
  if (args.length === 0) {
    console.error('Error: Missing PDF path');
    printUsage();
    return;
  }
  
  const pdfPath = args[0];
  const metadataJsonPath = args[1];
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`Error: PDF file not found at ${pdfPath}`);
    return;
  }
  
  console.log('=== Adding Document to Database ===');
  
  // Parse metadata if provided
  let metadata: any = {};
  if (metadataJsonPath && fs.existsSync(metadataJsonPath)) {
    console.log('Loading metadata from JSON file...');
    metadata = JSON.parse(fs.readFileSync(metadataJsonPath, 'utf-8'));
  } else {
    // Try to extract basic metadata from PDF file name
    const baseName = path.basename(pdfPath, '.pdf');
    const parts = baseName.split('-');
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      if (!isNaN(parseInt(lastPart)) && lastPart.length === 4) {
        // Assume it's a year
        metadata.year = lastPart;
        metadata.title = parts.slice(0, -1).join(' ');
      } else {
        metadata.title = baseName;
      }
    } else {
      metadata.title = baseName;
    }
  }
  
  // Read the PDF file as binary data
  const pdfData = fs.readFileSync(pdfPath);
  
  // For now, we'll use a simplified approach - assume the PDF content is the metadata
  // In a real implementation, this would extract text from the PDF
  const documentContent = pdfData.toString('base64').substring(0, 1000); // Just store part of the base64 as a placeholder
  
  // Create document object
  const document = {
    title: metadata.title || path.basename(pdfPath, '.pdf'),
    authors: metadata.authors || [],
    content: documentContent,
    doi: metadata.doi,
    year: metadata.year,
    journal: metadata.journal
  };
  
  // Add document to database
  console.log('Adding document to database...');
  const db = new DocumentDatabase(config.documentDbPath);
  const documentId = db.addDocument(document);
  
  console.log(`Document added with ID: ${documentId}`);
  
  return {
    documentId,
    metadata
  };
}

/**
 * List all documents in the database
 */
function listDocuments() {
  console.log('=== Documents in Database ===');
  
  const db = new DocumentDatabase(config.documentDbPath);
  const documents = db.getAllDocuments();
  
  if (documents.length === 0) {
    console.log('No documents in the database');
    return;
  }
  
  // Display document list
  documents.forEach((doc, index) => {
    console.log(`\nDocument #${index + 1}:`);
    console.log(`  ID: ${doc.id}`);
    console.log(`  Title: ${doc.title}`);
    
    if (doc.authors && doc.authors.length > 0) {
      console.log(`  Authors: ${doc.authors.join(', ')}`);
    }
    
    if (doc.year) {
      console.log(`  Year: ${doc.year}`);
    }
    
    if (doc.doi) {
      console.log(`  DOI: ${doc.doi}`);
    }
    
    console.log(`  File: ${path.basename(doc.filePath)}`);
  });
  
  console.log(`\nTotal: ${documents.length} documents`);
  
  return documents;
}

/**
 * Rebuild the document database index
 */
function rebuildIndex() {
  console.log('=== Rebuilding Document Database Index ===');
  
  const db = new DocumentDatabase(config.documentDbPath);
  db.rebuildIndex();
  
  console.log('Document database index rebuilt successfully');
  
  return true;
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
