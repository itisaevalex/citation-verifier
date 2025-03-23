#!/usr/bin/env ts-node
import * as path from 'path';
import * as fs from 'fs';
import { ReferenceExtractor } from '../reference-extraction';

/**
 * Simplified demo script that shows the citation extraction workflow:
 * 1. Extract references from a paper
 * 2. Display citation contexts and how they would be verified
 */
async function demonstrateSimpleVerification() {
  console.log('===== Citation Verification Simplified Demo =====\n');
  
  // 1. Set up directories
  const basePath = process.cwd();
  const samplePdfPath = path.join(basePath, 'samples', 'sample-paper.pdf');
  
  // Check for sample PDF
  if (!fs.existsSync(samplePdfPath)) {
    console.log(`Sample PDF not found at ${samplePdfPath}. Checking alternative location...`);
    const altPath = path.join(basePath, 'sample-paper.pdf');
    
    if (fs.existsSync(altPath)) {
      console.log(`Found sample PDF at ${altPath}.`);
    } else {
      console.log('Sample PDF not found. Creating a placeholder file for demonstration purposes.\n');
      // Create a minimal example text file instead
      fs.writeFileSync(altPath, 'Sample paper content for demonstration.');
    }
  } else {
    console.log(`Found sample PDF at ${samplePdfPath}.`);
  }
  
  // 2. Extract references using ReferenceExtractor
  console.log('\nExtracting references from the sample paper...');
  const extractor = new ReferenceExtractor();
  
  // Check if GROBID is running
  console.log('Checking if GROBID service is running...');
  const isGrobidRunning = await extractor.checkService();
  
  let enhancedReferences;
  
  if (isGrobidRunning) {
    console.log('✅ GROBID service is running. Processing PDF...');
    try {
      enhancedReferences = await extractor.extractReferencesWithContext(samplePdfPath);
      console.log(`Extracted ${enhancedReferences.length} references from the paper.`);
      
      // Save references
      const referencesPath = path.join(basePath, 'samples', 'sample-paper-references.json');
      fs.writeFileSync(referencesPath, JSON.stringify(enhancedReferences, null, 2));
      console.log(`References saved to: ${referencesPath}`);
      
      // Display sample of extracted references
      console.log('\n=== Sample of Extracted References ===');
      const sampleSize = Math.min(3, enhancedReferences.length);
      
      for (let i = 0; i < sampleSize; i++) {
        const ref = enhancedReferences[i];
        console.log(`\nReference ${i+1}: ${ref.reference.title || 'Untitled'}`);
        console.log(`Authors: ${ref.reference.authors ? ref.reference.authors.join(', ') : 'N/A'}`);
        console.log(`Year: ${ref.reference.year || 'N/A'}`);
        console.log(`DOI: ${ref.reference.doi || 'N/A'}`);
        console.log(`Citation contexts: ${ref.citationCount}`);
        
        // Show first citation context if available
        if (ref.contexts && ref.contexts.length > 0) {
          console.log(`\nExample citation context:`);
          console.log(`Page ${ref.contexts[0].page}: "${ref.contexts[0].surroundingText}"`);
        }
      }
      
      console.log('\n=== Verification Process Explanation ===');
      console.log('In a full verification workflow:');
      console.log('1. Each reference would be matched against documents in the database');
      console.log('2. Citation contexts would be compared with the content of the referenced documents');
      console.log('3. AI-powered verification would determine if citations accurately represent the source');
      console.log('4. A verification report would be generated with confidence scores and explanations');
      
    } catch (error) {
      console.error('Error during reference extraction:', error);
    }
  } else {
    console.log('❌ GROBID service is not running. Using sample references for demonstration.');
    
    // Create sample enhanced references for demonstration
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
    
    // Display simulated references
    console.log('\n=== Sample of Simulated References ===');
    for (let i = 0; i < enhancedReferences.length; i++) {
      const ref = enhancedReferences[i];
      console.log(`\nReference ${i+1}: ${ref.reference.title}`);
      console.log(`Authors: ${ref.reference.authors.join(', ')}`);
      console.log(`Year: ${ref.reference.year}`);
      console.log(`DOI: ${ref.reference.doi}`);
      console.log(`Citation contexts: ${ref.citationCount}`);
      
      // Show first citation context
      console.log(`\nExample citation context:`);
      console.log(`Page ${ref.contexts[0].page}: "${ref.contexts[0].surroundingText}"`);
    }
  }
  
  console.log('\n===== Simplified Demonstration Complete =====');
  console.log('This simplified demonstration shows:');
  console.log('1. How to extract references and citation contexts from academic papers');
  console.log('2. The structure of citation data that would be used for verification');
  console.log('3. How the verification process would analyze citation accuracy');
  
  console.log('\nTo run the full verification workflow, the database component would need to be fixed.');
  console.log('You can process your own PDFs with: ts-node verify-citations.ts extract <pdf-path>');
}

// Run the demonstration
demonstrateSimpleVerification().catch(console.error);
