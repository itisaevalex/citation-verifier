/**
 * Script to fix document database issues
 */
import * as fs from 'fs';
import * as path from 'path';

// Define paths
const dbDir = path.join(process.cwd(), 'src', 'document-database');
const documentsDir = path.join(dbDir, 'documents');
const indexPath = path.join(dbDir, 'index.json');

// Ensure directories exist
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
  console.log(`Created documents directory at ${documentsDir}`);
}

console.log('=== Fixing Document Database ===');

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

// Step 3: Rebuild the index from document files
console.log('Rebuilding index from document files...');

// Clear existing mappings (but keep the structure)
index.byDoi = {};
index.byTitleWords = {};
index.byYear = {};

// Index all documents
for (const file of documentFiles) {
  const filePath = path.join(documentsDir, file);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const doc = JSON.parse(content);
    
    // Use normalized path with forward slashes for consistency
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    // Add document name -> path mapping
    const baseName = path.basename(file, '.json');
    index[baseName] = normalizedPath;
    
    // Add to DOI index
    if (doc.doi) {
      index.byDoi[doc.doi.toLowerCase().trim()] = normalizedPath;
    }
    
    // Add to title words index
    if (doc.title) {
      const titleWords = doc.title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .split(' ')
        .filter((w: string) => w.length > 3);
      
      for (const word of titleWords) {
        if (!index.byTitleWords[word]) {
          index.byTitleWords[word] = [];
        }
        
        if (!index.byTitleWords[word].includes(normalizedPath)) {
          index.byTitleWords[word].push(normalizedPath);
        }
      }
    }
    
    // Add to year index
    if (doc.year || doc.publicationYear) {
      const year = doc.year || doc.publicationYear;
      if (!index.byYear[year]) {
        index.byYear[year] = [];
      }
      
      if (!index.byYear[year].includes(normalizedPath)) {
        index.byYear[year].push(normalizedPath);
      }
    }
    
    console.log(`Indexed document: ${file}`);
  } catch (error) {
    console.error(`Error processing document ${file}:`, error);
  }
}

// Step 4: Save the updated index
console.log('Saving updated index...');
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

console.log('=== Document Database Fixed Successfully ===');
console.log(`Total documents indexed: ${documentFiles.length}`);
