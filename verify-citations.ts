#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as path from 'path';
import { ReferenceExtractor } from './src/reference-extraction';
import { CitationVerifier, VerificationOptions } from './src/reference-comparison';
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
 * Print usage information
 */
function printUsage() {
  console.log(`
Citation Verification Tool
-------------------------
Usage: ts-node verify-citations.ts <command> [options]

Commands:
  ${COMMANDS.PROCESS} <pdf-path>                   Complete workflow: extract references and verify citations
  ${COMMANDS.EXTRACT} <pdf-path> [output-path]     Extract references from a PDF
  ${COMMANDS.VERIFY} <references-json>             Verify citations against the document database
  ${COMMANDS.ADD_DOC} <pdf-path> [metadata-json]   Add a document to the database
  ${COMMANDS.LIST_DOCS}                           List all documents in the database
  ${COMMANDS.REBUILD_INDEX}                       Rebuild the document database index
  ${COMMANDS.HELP}                                Show this help message

Options:
  --missing-ref-handling <mode>      How to handle missing references (log, skip, prompt, fetch)
  --api-key <key>                    Google API key for Gemini (default: from .env)
  --verbose                          Enable verbose output
  --confidence-threshold <number>    Confidence threshold (0-1) for verification

Examples:
  ts-node verify-citations.ts process paper.pdf
  ts-node verify-citations.ts extract paper.pdf
  ts-node verify-citations.ts verify paper-references.json --missing-ref-handling=prompt
  ts-node verify-citations.ts add-document referenced-paper.pdf metadata.json
  `);
}

/**
 * Setup CLI program
 */
function setupProgram() {
  program
    .name('verify-citations')
    .description('Citation Verification Tool')
    .version('0.1.0');

  // Process command
  program
    .command(COMMANDS.PROCESS)
    .description('Complete workflow: extract references and verify citations')
    .argument('<pdf-path>', 'Path to the PDF file')
    .option('--missing-ref-handling <mode>', 'How to handle missing references (log, skip, prompt, fetch)', config.missingRefHandling)
    .option('--api-key <key>', 'Google API key for Gemini')
    .option('--verbose', 'Enable verbose output')
    .option('--confidence-threshold <number>', 'Confidence threshold (0-1) for verification', '0.7')
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
    .option('--confidence-threshold <number>', 'Confidence threshold (0-1) for verification', '0.7')
    .action(async (referencesJson, options) => {
      try {
        await verifyCitations([referencesJson], options);
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
  // Validate configuration
  if (!validateConfig()) {
    console.warn('Warning: Configuration issues detected. Some features may be limited.');
  }

  // Check if using Commander
  if (process.argv.length > 2 && process.argv[2] !== '--help' && process.argv[2] !== '-h') {
    setupProgram();
    await program.parseAsync(process.argv);
    return;
  }

  // Legacy command processing mode
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printUsage();
    return;
  }
  
  const command = args[0];
  
  try {
    switch (command) {
      case COMMANDS.PROCESS:
        await processDocument(args.slice(1), {});
        break;
      case COMMANDS.EXTRACT:
        await extractReferences(args.slice(1), {});
        break;
      case COMMANDS.VERIFY:
        await verifyCitations(args.slice(1), {});
        break;
      case COMMANDS.ADD_DOC:
        await addDocument(args.slice(1));
        break;
      case COMMANDS.LIST_DOCS:
        listDocuments();
        break;
      case COMMANDS.REBUILD_INDEX:
        rebuildIndex();
        break;
      case COMMANDS.HELP:
      default:
        printUsage();
        break;
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
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
  if (args.length === 0) {
    console.error('Error: Missing PDF path');
    printUsage();
    return;
  }
  
  const pdfPath = args[0];
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`Error: PDF file not found at ${pdfPath}`);
    return;
  }
  
  console.log('=== Citation Verification Workflow ===');
  console.log(`Processing document: ${pdfPath}`);
  
  // Step 1: Check if GROBID service is running
  const extractor = new ReferenceExtractor(config.grobidUrl);
  console.log('\n📋 Step 1: Checking GROBID service...');
  const isGrobidAlive = await extractor.checkService();
  
  if (!isGrobidAlive) {
    console.error('❌ GROBID service is not running. Please start GROBID and try again.');
    console.error('GROBID can be started with: docker run -t --rm -p 8070:8070 grobid/grobid:0.8.1');
    return;
  }
  
  console.log('✅ GROBID service is running');
  
  // Step 2: Extract references and citation contexts
  console.log('\n📋 Step 2: Extracting references and citation contexts...');
  const enhancedReferences = await extractor.extractReferencesWithContext(pdfPath);
  
  // Save the references
  const outputDir = path.dirname(pdfPath);
  const referencesPath = path.join(outputDir, `${path.basename(pdfPath, '.pdf')}-references.json`);
  fs.writeFileSync(referencesPath, JSON.stringify(enhancedReferences, null, 2));
  
  console.log(`✅ Extracted ${enhancedReferences.length} references`);
  console.log(`✅ References saved to: ${referencesPath}`);
  
  // Step 3: Verify citations against the document database
  console.log('\n📋 Step 3: Verifying citations against document database...');
  
  // Get document title from PDF file name
  const documentTitle = path.basename(pdfPath, '.pdf');
  
  // Parse verification options
  const verificationOptions: VerificationOptions = {
    missingRefHandling: (options.missingRefHandling as MissingReferenceHandling) || config.missingRefHandling,
    confidenceThreshold: parseFloat(options.confidenceThreshold || '0.7'),
    verbose: options.verbose || false,
    saveIntermediateResults: true
  };
  
  // Create verifier
  const documentDatabaseDir = config.documentDbPath;
  const verifier = new CitationVerifier(documentDatabaseDir, verificationOptions);
  
  // Verify all citations
  const report = await verifier.verifyAllCitations(enhancedReferences, documentTitle);
  
  // Save the verification report
  const reportPath = path.join(outputDir, `${documentTitle}-verification-report.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Step 4: Display verification summary
  console.log('\n📋 Step 4: Citation verification summary');
  
  // Calculate verification metrics
  const verificationRate = Math.round(report.verifiedCitations / report.totalCitationsChecked * 100) || 0;
  const unverifiedRate = Math.round(report.unverifiedCitations / report.totalCitationsChecked * 100) || 0;
  const inconclusiveRate = Math.round(report.inconclusiveCitations / report.totalCitationsChecked * 100) || 0;
  
  console.log(`Total citations: ${report.totalCitationsChecked}`);
  console.log(`Verified: ${report.verifiedCitations} (${verificationRate}%)`);
  console.log(`Unverified: ${report.unverifiedCitations} (${unverifiedRate}%)`);
  console.log(`Inconclusive: ${report.inconclusiveCitations} (${inconclusiveRate}%)`);
  console.log(`Missing References: ${report.missingReferences || 0}`);
  console.log(`\n✅ Full verification report saved to: ${reportPath}`);
  
  // Display potential next steps
  console.log('\nNext Steps:');
  console.log('- Review the verification report for details on each citation');
  console.log('- Add missing reference documents to the database to improve verification rate');
  if (report.missingReferences > 0) {
    console.log('- Check the fetch list for missing references that need to be added');
  }
  console.log('- Run with `--verbose` flag for detailed citation context analysis');
  
  return report;
}

/**
 * Extract references from a PDF
 * @param args Command arguments
 * @param options Command options
 */
async function extractReferences(args: string[], options: any = {}) {
  if (args.length === 0) {
    console.error('Error: Missing PDF path');
    printUsage();
    return;
  }
  
  const pdfPath = args[0];
  const outputPath = args[1] || process.cwd();
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`Error: PDF file not found at ${pdfPath}`);
    return;
  }
  
  console.log('=== Extracting References with Enhanced Context ===');
  
  // Check GROBID service
  const extractor = new ReferenceExtractor(config.grobidUrl);
  console.log('Checking GROBID service...');
  const isGrobidAlive = await extractor.checkService();
  
  if (!isGrobidAlive) {
    console.error('Error: GROBID service is not running. Please start GROBID and try again.');
    console.error('GROBID can be started with: docker run -t --rm -p 8070:8070 grobid/grobid:0.8.1');
    return;
  }
  
  console.log('GROBID service is running');
  
  // Extract references
  console.log('Extracting references from PDF...');
  const enhancedReferences = await extractor.extractReferencesWithContext(pdfPath);
  
  // Save the references
  let outputFilePath;
  if (fs.statSync(outputPath).isDirectory()) {
    outputFilePath = path.join(outputPath, `${path.basename(pdfPath, '.pdf')}-references.json`);
  } else {
    outputFilePath = outputPath;
  }
  
  fs.writeFileSync(outputFilePath, JSON.stringify(enhancedReferences, null, 2));
  
  console.log(`Extracted ${enhancedReferences.length} references`);
  console.log(`References saved to: ${outputFilePath}`);
  
  return {
    references: enhancedReferences,
    outputPath: outputFilePath
  };
}

/**
 * Verify citations against the document database
 * @param args Command arguments
 * @param options Command options
 */
async function verifyCitations(args: string[], options: any = {}) {
  if (args.length === 0) {
    console.error('Error: Missing references JSON path');
    printUsage();
    return;
  }
  
  const referencesJsonPath = args[0];
  
  if (!fs.existsSync(referencesJsonPath)) {
    console.error(`Error: References JSON file not found at ${referencesJsonPath}`);
    return;
  }
  
  console.log('=== Verifying Citations Against Document Database ===');
  
  // Load references
  console.log('Loading references from JSON file...');
  const enhancedReferences = JSON.parse(fs.readFileSync(referencesJsonPath, 'utf-8'));
  
  // Parse verification options
  const verificationOptions: VerificationOptions = {
    missingRefHandling: (options.missingRefHandling as MissingReferenceHandling) || config.missingRefHandling,
    confidenceThreshold: parseFloat(options.confidenceThreshold || '0.7'),
    verbose: options.verbose || false
  };
  
  // Create verifier
  const documentDatabaseDir = config.documentDbPath;
  const verifier = new CitationVerifier(documentDatabaseDir, verificationOptions);
  
  // Get document title from file name
  const documentTitle = path.basename(referencesJsonPath, '-references.json');
  
  // Verify all citations
  console.log('Verifying citations...');
  const report = await verifier.verifyAllCitations(enhancedReferences, documentTitle);
  
  // Save the verification report
  const reportPath = path.join(path.dirname(referencesJsonPath), `${documentTitle}-verification-report.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Display verification summary
  console.log('\nCitation verification summary:');
  
  // Calculate verification metrics
  const verificationRate = Math.round(report.verifiedCitations / report.totalCitationsChecked * 100) || 0;
  const unverifiedRate = Math.round(report.unverifiedCitations / report.totalCitationsChecked * 100) || 0;
  const inconclusiveRate = Math.round(report.inconclusiveCitations / report.totalCitationsChecked * 100) || 0;
  const missingRefRate = Math.round((report.missingReferences || 0) / report.totalCitationsChecked * 100) || 0;
  
  console.log(`Total citations: ${report.totalCitationsChecked}`);
  console.log(`Verified: ${report.verifiedCitations} (${verificationRate}%)`);
  console.log(`Unverified: ${report.unverifiedCitations} (${unverifiedRate}%)`);
  console.log(`Inconclusive: ${report.inconclusiveCitations} (${inconclusiveRate}%)`);
  console.log(`Missing References: ${report.missingReferences || 0} (${missingRefRate}%)`);
  console.log(`\nVerification report saved to: ${reportPath}`);
  
  return report;
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
