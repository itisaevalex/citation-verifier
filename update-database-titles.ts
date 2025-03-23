/**
 * Script to update the document database index to use proper titles
 */
import * as fs from 'fs';
import * as path from 'path';

// Define paths
const dbDir = path.join(process.cwd(), 'src', 'document-database');
const documentsDir = path.join(dbDir, 'documents');
const indexPath = path.join(dbDir, 'index.json');

console.log('=== Updating Document Database Index with Proper Titles ===');

// Step 1: Check if documents exist in the database directory
console.log('Checking document files...');
let documentFiles: string[] = [];

try {
  documentFiles = fs.readdirSync(documentsDir)
    .filter(file => file.endsWith('.json'));
  
  console.log(`Found ${documentFiles.length} documents in database`);
} catch (error) {
  console.error('Error reading documents directory:', error);
  process.exit(1);
}

// Step 2: Load current index (if exists)
let index: any = {
  byDoi: {},
  byTitleWords: {},
  byYear: {}
};

try {
  if (fs.existsSync(indexPath)) {
    console.log('Loading existing index...');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    index = JSON.parse(indexContent);
    
    // Make sure all required sections exist
    if (!index.byDoi) index.byDoi = {};
    if (!index.byTitleWords) index.byTitleWords = {};
    if (!index.byYear) index.byYear = {};
    
    console.log('Index loaded successfully');
  } else {
    console.log('No existing index found, will create a new one');
  }
} catch (error) {
  console.error('Error reading index file:', error);
  console.log('Creating new index');
}

// Clear the specific title mappings (keep DOI, title words, and year indices)
for (const key of Object.keys(index)) {
  if (key !== 'byDoi' && key !== 'byTitleWords' && key !== 'byYear') {
    delete index[key];
  }
}

// Step 3: Create a new title-based index
console.log('Creating title-based index...');

// Create a new byTitle section
index.byTitle = {};
const existingTitles = new Set<string>();

// Process all document files
for (const file of documentFiles) {
  const filePath = path.join(documentsDir, file);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const doc = JSON.parse(content);
    
    // Use normalized path with forward slashes for consistency
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    // Add to title index using the original title
    if (doc.title) {
      let title = doc.title.trim();
      
      // Handle duplicate titles
      let uniqueTitle = title;
      let counter = 1;
      while (existingTitles.has(uniqueTitle.toLowerCase())) {
        uniqueTitle = `${title} (${counter})`;
        counter++;
      }
      
      // Add the title to our set to track duplicates
      existingTitles.add(uniqueTitle.toLowerCase());
      
      // Add the title -> path mapping
      index.byTitle[uniqueTitle] = normalizedPath;
      
      console.log(`Indexed document: "${uniqueTitle}"`);
    } else {
      console.log(`Skipping document without title: ${file}`);
    }
    
    // Make sure DOI index entries use the proper normalized paths
    if (doc.doi) {
      index.byDoi[doc.doi.toLowerCase().trim()] = normalizedPath;
    }
    
  } catch (error) {
    console.error(`Error processing document ${file}:`, error);
  }
}

// Step 4: Save the updated index
console.log('Saving updated index...');
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

console.log('=== Document Database Updated Successfully ===');
console.log(`Total documents indexed: ${Object.keys(index.byTitle).length}`);
