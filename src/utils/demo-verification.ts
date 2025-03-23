#!/usr/bin/env ts-node
import * as path from 'path';
import * as fs from 'fs';
import { ReferenceExtractor } from '../reference-extraction';
import { CitationVerifier } from '../reference-comparison';
// Import the fixed DocumentDatabase implementation
import { DocumentDatabase, Document } from './document-database-fix';

/**
 * Demo script that shows the complete citation verification workflow:
 * 1. Extract references from a paper
 * 2. Add sample documents to the database
 * 3. Verify citations against those documents
 */
async function demonstrateVerification() {
  console.log('===== Citation Verification Demonstration =====\n');
  
  // 1. Set up directories
  const basePath = process.cwd();
  const samplePdfPath = path.join(basePath, 'sample-paper.pdf');
  const docDbPath = path.join(basePath, 'src', 'document-database');
  
  // Check for sample PDF
  if (!fs.existsSync(samplePdfPath)) {
    console.log('Sample PDF not found. Creating a placeholder file for demonstration purposes.\n');
    // Create a minimal example text file instead
    fs.writeFileSync(samplePdfPath, 'Sample paper content for demonstration.');
  }
  
  // 2. Set up the document database with sample documents
  console.log('Setting up document database with sample documents...');
  const db = new DocumentDatabase();
  
  // Add sample documents
  const sampleDoc1: Omit<Document, 'id' | 'filePath'> = {
    title: 'Machine Learning: A Comprehensive Review',
    authors: ['Smith, J.', 'Johnson, A.'],
    doi: '10.1234/ml.2025.1234',
    content: `Machine learning is a subset of artificial intelligence that involves training algorithms to learn patterns from data. 
    These algorithms can improve their performance over time without being explicitly programmed for specific tasks.
    Recent advances in neural networks have led to significant improvements in machine learning performance.
    Deep learning, a subset of machine learning, uses multiple layers of neural networks to extract complex features from data.
    Reinforcement learning is another approach where agents learn to make decisions by interacting with an environment.`,
    year: '2025',
    journal: 'Journal of AI Research'
  };
  
  const sampleDoc2: Omit<Document, 'id' | 'filePath'> = {
    title: 'Natural Language Processing: Current Challenges',
    authors: ['Brown, M.', 'Davis, L.'],
    doi: '10.5678/nlp.2024.5678',
    content: `Natural Language Processing (NLP) systems have made remarkable progress in recent years.
    Large language models can now generate human-like text and understand complex linguistic contexts.
    However, challenges remain in areas such as linguistic bias, factual accuracy, and reasoning capabilities.
    Current approaches often struggle with understanding implicit meaning and contextual nuances.
    Future research directions include improved grounding, multimodal integration, and reasoning over external knowledge sources.`,
    year: '2024',
    journal: 'Computational Linguistics Journal'
  };
  
  // Add to database
  const id1 = db.addDocument(sampleDoc1);
  const id2 = db.addDocument(sampleDoc2);
  
  console.log(`Added sample document 1 with ID: ${id1}`);
  console.log(`Added sample document 2 with ID: ${id2}`);
  
  // 3. Extract references from the sample paper
  console.log('\nExtracting references from the sample paper...');
  const extractor = new ReferenceExtractor();
  
  // Check if GROBID is running
  console.log('Checking if GROBID service is running...');
  const isGrobidRunning = await extractor.checkService();
  
  let enhancedReferences;
  
  if (isGrobidRunning) {
    console.log('✅ GROBID service is running. Processing PDF...');
    enhancedReferences = await extractor.extractReferencesWithContext(samplePdfPath);
    console.log(`Extracted ${enhancedReferences.length} references from the paper.`);
  } else {
    console.log('❌ GROBID service is not running. Using sample references for demonstration.');
    
    // Create sample enhanced references for demonstration that match the EnhancedReference interface
    enhancedReferences = [
      {
        reference: {
          id: 'ref1',
          authors: ['Smith, J.', 'Johnson, A.'],
          title: 'Machine Learning: A Comprehensive Review',
          year: '2025',
          doi: '10.1234/ml.2025.1234',
          journal: 'Journal of AI Research',
          rawText: 'Smith, J., Johnson, A. (2025). Machine Learning: A Comprehensive Review. Journal of AI Research, 10(1).'
        },
        citationCount: 1,
        contexts: [
          {
            text: '[1]',
            page: 1,
            surroundingText: 'According to recent research, machine learning systems can adapt to new data patterns automatically [1].'
          }
        ]
      },
      {
        reference: {
          id: 'ref2',
          authors: ['Brown, M.', 'Davis, L.'],
          title: 'Natural Language Processing: Current Challenges',
          year: '2024',
          doi: '10.5678/nlp.2024.5678',
          journal: 'Computational Linguistics Journal',
          rawText: 'Brown, M., Davis, L. (2024). Natural Language Processing: Current Challenges. Computational Linguistics Journal, 15(2).'
        },
        citationCount: 1,
        contexts: [
          {
            text: '[2]',
            page: 2,
            surroundingText: 'Large language models generate human-like text that is often indistinguishable from human writing [2].'
          }
        ]
      }
    ];
  }
  
  // Save references (optional)
  const referencesPath = path.join(basePath, 'sample-paper-references.json');
  fs.writeFileSync(referencesPath, JSON.stringify(enhancedReferences, null, 2));
  console.log(`References saved to: ${referencesPath}`);
  
  // 4. Verify the citations against the document database
  console.log('\nVerifying citations against the document database...');
  const verifier = new CitationVerifier(docDbPath);
  
  try {
    const report = await verifier.verifyAllCitations(enhancedReferences, 'Sample Paper');
    
    // Save the verification report
    const reportPath = path.join(basePath, 'sample-paper-verification-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n===== Verification Report Summary =====');
    console.log(`Total citations checked: ${report.totalCitationsChecked}`);
    console.log(`Verified citations: ${report.verifiedCitations} (${Math.round(report.verifiedCitations / report.totalCitationsChecked * 100)}%)`);
    console.log(`Unverified citations: ${report.unverifiedCitations} (${Math.round(report.unverifiedCitations / report.totalCitationsChecked * 100)}%)`);
    console.log(`Inconclusive citations: ${report.inconclusiveCitations} (${Math.round(report.inconclusiveCitations / report.totalCitationsChecked * 100)}%)`);
    console.log('\nDetailed results:');
    
    report.results.forEach((result, index) => {
      console.log(`\nCitation ${index + 1}:`);
      console.log(`Reference: "${result.referenceTitle}"`);
      console.log(`Context: "${result.citationContext}"`);
      console.log(`Verified: ${result.isVerified ? '✅ YES' : '❌ NO'} (Confidence: ${Math.round(result.confidenceScore * 100)}%)`);
      if (result.matchLocation) {
        console.log(`Match location: "${result.matchLocation.substring(0, 100)}..."`);
      }
      console.log(`Explanation: ${result.explanation.substring(0, 100)}...`);
    });
    
    console.log(`\nFull report saved to: ${reportPath}`);
  } catch (error) {
    console.error('Error during verification:', error);
  }
  
  console.log('\n===== Demonstration Complete =====');
  console.log('The citation verification system now has these components:');
  console.log('1. Reference Extraction: Extract references and citation contexts from PDFs (using GROBID)');
  console.log('2. Document Database: Store and index referenced documents for verification');
  console.log('3. Reference Comparison: Verify citations against referenced documents (using Gemini)');
}

// Run the demonstration
demonstrateVerification().catch(console.error);
