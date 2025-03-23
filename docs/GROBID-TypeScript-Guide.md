# Using GROBID with TypeScript for Citation Analysis

This guide provides a comprehensive overview of how to use GROBID with TypeScript to extract citation data from academic papers for advanced analysis and citation verification.

## Table of Contents

1. [Introduction to GROBID](#introduction-to-grobid)
2. [Setting Up GROBID](#setting-up-grobid)
3. [The TypeScript GROBID Client](#the-typescript-grobid-client)
4. [Processing PDFs](#processing-pdfs)
5. [Understanding Citation Data Structure](#understanding-citation-data-structure)
6. [Working with References](#working-with-references)
7. [Citation Verification Workflow](#citation-verification-workflow)
8. [Advanced Usage](#advanced-usage)
9. [Troubleshooting](#troubleshooting)

## Introduction to GROBID

[GROBID](https://github.com/kermitt2/grobid) (GeneRation Of BIbliographic Data) is a machine learning library for extracting, parsing, and restructuring raw documents (like PDFs) into structured TEI-encoded documents with a focus on technical and scientific publications.

GROBID provides several services particularly useful for citation analysis:
- Extraction of bibliographic references
- Identification of in-text citations
- Linking in-text citations to their corresponding references
- Parsing of document structure (sections, paragraphs, etc.)

## Setting Up GROBID

### Prerequisites

- Java 8 or higher
- Docker (recommended for easy setup)
- Node.js and TypeScript

### Installation Options

#### Using Docker (Recommended)

```bash
# Pull the GROBID Docker image
docker pull lfoppiano/grobid:0.7.2

# Run GROBID server on port 8070
docker run -t --rm -p 8070:8070 lfoppiano/grobid:0.7.2
```

#### Manual Installation

If you prefer to install GROBID directly:

1. Clone the repository
```bash
git clone https://github.com/kermitt2/grobid.git
```

2. Build with Gradle
```bash
cd grobid
./gradlew clean install
```

3. Run the service
```bash
./gradlew run
```

### Verifying Installation

Once GROBID is running, you can verify it by accessing:
- Web console: http://localhost:8070
- API documentation: http://localhost:8070/api

## The TypeScript GROBID Client

Our TypeScript client encapsulates the API calls to GROBID and provides a clean interface for processing PDFs and extracting citation data.

### Client Structure

```typescript
export class GrobidClient {
  constructor(
    private baseUrl: string = 'http://localhost:8070',
    private timeout: number = 60000
  ) {}

  // Methods for interacting with GROBID
  async checkService(): Promise<boolean>
  async processPdf(pdfPath: string, options?: ProcessPdfOptions): Promise<any>
  async getFullTextTEI(pdfPath: string, options?: FullTextOptions): Promise<string>
  async getReferenceAnnotations(pdfPath: string, options?: ReferenceAnnotationOptions): Promise<any>
}
```

### Installation in Your Project

1. Install required dependencies:

```bash
npm install axios form-data xmldom xpath
```

2. Copy the `grobid-client.ts` file to your project.

## Processing PDFs

### Basic PDF Processing

```typescript
import { GrobidClient } from './grobid-client';

async function processDocument(pdfPath: string) {
  // Create a GROBID client (defaults to localhost:8070)
  const client = new GrobidClient();
  
  // Check if GROBID service is running
  const isRunning = await client.checkService();
  if (!isRunning) {
    console.error('GROBID service is not running!');
    return;
  }
  
  // Get full TEI XML
  const teiXml = await client.getFullTextTEI(pdfPath);
  
  // Or get citation annotations in JSON format
  const annotations = await client.getReferenceAnnotations(pdfPath, {
    consolidateCitations: '1' // Enable citation consolidation
  });
  
  // Now you can process the data
  console.log('Document processed successfully!');
  return { teiXml, annotations };
}
```

### Processing Options

The GROBID client accepts several options for customizing the extraction process:

```typescript
interface ProcessPdfOptions {
  consolidateCitations?: boolean | string; // Enable citation consolidation
  includeRawCitations?: boolean;           // Include the raw citation text
  includeCoordinates?: boolean;            // Include coordinates for in-text citations
}
```

## Understanding Citation Data Structure

The citation data extracted from GROBID is structured into several components:

### BibReference

Represents a bibliographic reference in the document's reference section.

```typescript
interface BibReference {
  id: string;               // Reference identifier
  title: string;            // Publication title
  authors: Author[];        // List of authors
  date: string;             // Publication date
  journal: string;          // Journal name
  volume: string;           // Volume number
  issue: string;            // Issue number
  pages: {                  // Page range
    start: string;
    end: string;
  };
  doi: string;              // Digital Object Identifier
  rawText: string;          // Raw text of the reference
}
```

### CitationContext

Represents an in-text citation that refers to one or more bibliographic references.

```typescript
interface CitationContext {
  id: string;                 // Citation identifier
  text: string;               // Citation text (e.g., "[1]" or "Smith et al.")
  position: {                 // Position in the document
    page: number;
    coords?: { x: number; y: number; w: number; h: number; }
  };
  referenceIds: string[];     // IDs of referenced bibliography items
  surroundingText: string;    // Text surrounding the citation
}
```

### ReferenceUsage

Associates a bibliographic reference with all contexts where it is cited.

```typescript
interface ReferenceUsage {
  reference: BibReference;    // The bibliographic reference
  usageContexts: CitationContext[]; // All contexts where this reference is cited
}
```

## Working with References

### Extracting Reference Data

```typescript
import { CitationParser } from './citation-parser';

function extractReferences(teiXml: string) {
  // Create a parser for the TEI XML
  const parser = new CitationParser(teiXml);
  
  // Extract bibliographic references
  const references = parser.extractReferences();
  
  // Extract citation contexts
  const contexts = parser.extractCitationContexts();
  
  // Extract document title
  const title = parser.extractDocumentTitle();
  
  return { title, references, contexts };
}
```

### Matching Citations to References

```typescript
import { CitationProcessor } from './citation-processor';

function matchCitationsToReferences(citationData) {
  const processor = new CitationProcessor();
  
  // Match citation contexts to their references
  const referenceUsage = processor.matchCitationsToReferences(citationData);
  
  return referenceUsage;
}
```

### Analyzing Surrounding Text

The `surroundingText` property contains the sentence or paragraph where a citation appears, providing context for how the reference is used. This is crucial for citation verification.

```typescript
// Example of analyzing how a reference is used
function analyzeReferenceUsage(referenceUsage: ReferenceUsage[]) {
  for (const usage of referenceUsage) {
    console.log(`Reference: "${usage.reference.title}"`);
    console.log(`Used ${usage.usageContexts.length} times in the document`);
    
    for (const context of usage.usageContexts) {
      console.log(`  Page ${context.position.page}: "${context.surroundingText}"`);
      
      // Your analysis logic here:
      // - Is it used for methodology?
      // - Is it cited for its results?
      // - Is it used as background or related work?
    }
  }
}
```

## Citation Verification Workflow

For verifying if citations accurately represent the content of referenced papers, follow this workflow:

1. **Extract citation data from the citing paper**
   - Process the paper using GROBID
   - Extract references and citation contexts
   - Structure the data as ReferenceUsage objects

2. **For each reference, obtain the cited paper**
   - Use the DOI if available
   - Search academic databases with title and authors

3. **Process the cited paper with GROBID**
   - Extract its full text and structure

4. **For each citation context:**
   - Extract key claims being attributed to the cited paper
   - Search the cited paper for evidence of these claims
   - Verify if the citation accurately represents the content

### Example Verification Code Structure

```typescript
async function verifyCitation(citingPaperPath: string, citationIndex: number) {
  // 1. Process citing paper
  const processor = new CitationProcessor();
  const citationData = await processor.processPdf(citingPaperPath);
  
  // 2. Get the specific citation context
  const context = citationData.citationContexts[citationIndex];
  if (!context) {
    console.error('Citation context not found');
    return;
  }
  
  // 3. Find the referenced paper
  const referenceIds = context.referenceIds;
  const references = referenceIds.map(id => 
    citationData.references.find(ref => ref.id === id)
  ).filter(Boolean);
  
  // 4. For each reference, verify the citation
  for (const reference of references) {
    // 4.1 Get the cited paper (via DOI or search)
    const citedPaperPath = await fetchPaperByDoi(reference.doi);
    
    // 4.2 Process the cited paper
    const citedPaperData = await processor.processPdf(citedPaperPath);
    
    // 4.3 Extract key claims from the citation context
    const claims = extractClaims(context.surroundingText);
    
    // 4.4 Verify claims against the cited paper
    const verificationResults = verifyClaims(claims, citedPaperData);
    
    console.log(`Verification results for citation [${context.text}]:`);
    console.log(verificationResults);
  }
}

// This is where your friend's module would come in:
function verifyClaims(claims, citedPaperData) {
  // Analyze the cited paper content chunk by chunk
  // Compare with the claims made in the citation
  // Return verification results
}
```

## Advanced Usage

### Handling PDF Extraction Errors

GROBID's extraction isn't perfect, especially for complex documents. Implement error handling:

```typescript
try {
  const teiXml = await client.getFullTextTEI(pdfPath);
  // Process the XML
} catch (error) {
  if (error.message.includes('503')) {
    console.error('GROBID server is busy, retrying...');
    // Implement retry logic
  } else {
    console.error('Error processing PDF:', error);
    // Fallback to alternative processing
  }
}
```

### XML Namespace Handling

When working with TEI XML, handle namespaces properly to avoid errors:

```typescript
// Using local-name() in XPath to bypass namespace issues
const matches = xpath.select(`//*[local-name()='biblStruct']`, xmlDoc);
```

### Batch Processing

For processing multiple documents:

```typescript
async function batchProcess(pdfPaths: string[]) {
  const client = new GrobidClient();
  const results = [];
  
  for (const path of pdfPaths) {
    try {
      console.log(`Processing ${path}...`);
      const data = await client.processPdf(path);
      results.push({ path, data, success: true });
    } catch (error) {
      console.error(`Error processing ${path}:`, error);
      results.push({ path, error: error.message, success: false });
    }
    
    // Add a delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}
```

## Troubleshooting

### Common Issues

1. **Cannot resolve QName xml**
   - **Issue**: XML namespace resolution errors when parsing TEI
   - **Solution**: Use the `local-name()` function in XPath queries as shown above

2. **Empty or Missing Citation Contexts**
   - **Issue**: GROBID fails to extract some citations
   - **Solution**: Ensure the PDF is text-searchable; check for non-standard citation formats

3. **GROBID Service is Busy**
   - **Issue**: 503 Service Unavailable responses
   - **Solution**: Implement retry logic with exponential backoff

4. **Memory Issues**
   - **Issue**: Processing large PDFs causes out-of-memory errors
   - **Solution**: Increase memory allocated to GROBID in docker run command:
     ```
     docker run -t --rm -p 8070:8070 -e JAVA_OPTS="-Xmx4g" lfoppiano/grobid:0.7.2
     ```

### Debugging Tips

1. Inspect the raw TEI XML to understand the structure:
   ```typescript
   fs.writeFileSync('debug-output.xml', teiXml);
   ```

2. Check citation contexts with missing references:
   ```typescript
   const orphanedCitations = citationData.citationContexts.filter(
     ctx => !ctx.referenceIds.some(id => 
       citationData.references.find(ref => ref.id === id)
     )
   );
   console.log('Orphaned citations:', orphanedCitations);
   ```

3. Enable debug logging in GROBID by modifying the configuration.

---

This documentation should help your friend get started with using GROBID and our TypeScript client for citation verification. The key will be developing robust algorithms for comparing the claims in citation contexts with the actual content of referenced papers.

If additional guidance is needed on specific aspects, please let me know!
