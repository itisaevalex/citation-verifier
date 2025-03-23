# GROBID Integration Guide

This guide explains how to use GROBID with the citation verification system to extract structured data from scholarly documents.

## What is GROBID?

GROBID (GeneRation Of BIbliographic Data) is a machine learning library for extracting, parsing, and restructuring raw scientific documents (PDF) into structured TEI XML format. Our citation verification system uses GROBID to:

1. Extract document metadata (title, authors, journal, etc.)
2. Parse full text content
3. Identify and extract bibliographic references
4. Locate citation contexts within the document

## Setting Up GROBID

### Option 1: Docker (Recommended)

The easiest way to run GROBID is through Docker:

```bash
docker run -t --rm -p 8070:8070 lfoppiano/grobid:0.7.2
```

This command will:
- Pull the GROBID image (version 0.7.2) if it's not available locally
- Start a GROBID server on port 8070
- Remove the container when stopped (--rm flag)

### Option 2: Local Installation

If you prefer to install GROBID locally:

1. Ensure you have Java 8+ installed
2. Download GROBID from [GitHub](https://github.com/kermitt2/grobid/releases)
3. Extract and build following their instructions
4. Start the service with `./gradlew run`

## Using the GROBID TypeScript Client

Our system includes a TypeScript client for interacting with GROBID in `src/GrobID/grobid-client.ts`:

```typescript
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';

export class GrobidClient {
  private baseUrl: string;
  
  constructor(baseUrl: string = 'http://localhost:8070') {
    this.baseUrl = baseUrl;
  }
  
  // Process a PDF and get TEI XML
  async processFullText(pdfPath: string): Promise<string> {
    const formData = new FormData();
    formData.append('input', fs.createReadStream(pdfPath));
    
    const response = await axios.post(
      `${this.baseUrl}/api/processFulltextDocument`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 60000
      }
    );
    
    return response.data;
  }
  
  // Other methods for specific GROBID endpoints...
}
```

## Key GROBID Endpoints

Our system uses these primary GROBID endpoints:

1. **processFulltextDocument** - Processes a full document and returns TEI XML with complete text and structure
2. **processReferences** - Extracts and parses bibliographic references
3. **processCitationList** - Processes a list of citations in isolation

## Citation Data Structure

After processing a document with GROBID, we extract and normalize the citation data into this structure:

```typescript
interface Citation {
  id: string;          // Citation ID (e.g., "b12")
  text: string;        // Raw citation text
  title: string;       // Publication title
  authors: string[];   // List of authors
  year: string;        // Publication year
  journal?: string;    // Journal/conference (if available)
  doi?: string;        // DOI identifier (if available)
}

interface CitationContext {
  citationId: string;  // Reference to Citation.id
  text: string;        // Text surrounding the citation
  page: number;        // Page number where citation appears
}
```

## Document Processing Workflow

The complete workflow for processing documents with GROBID is:

1. **Document Upload**:
   - User uploads a PDF document
   - System saves it temporarily for processing

2. **GROBID Processing**:
   - Call GROBID to process the PDF
   - Get back TEI XML with structured data

3. **XML Parsing**:
   - Parse the TEI XML using `DocumentParser` class
   - Extract metadata and full text content

4. **Reference Extraction**:
   - Identify all bibliographic references
   - Extract citation contexts where each reference is used

5. **Data Storage**:
   - Store structured document in the database
   - Index for efficient retrieval during verification

## Implementing Robust Error Handling

When integrating with GROBID, implement these error handling strategies:

1. **Connection Timeouts**: Set appropriate timeouts for GROBID requests (PDF processing can take time for large documents)
2. **Retry Logic**: Implement retries for temporary failures
3. **Fallback Processing**: Add a `--force` flag to bypass GROBID for testing
4. **Validation**: Validate GROBID output before processing further

## Best Practices

1. **Pre-Processing**: Clean PDFs when possible before sending to GROBID
2. **Caching**: Cache GROBID results to avoid reprocessing the same documents
3. **Batching**: Process documents in batches for better performance
4. **Monitoring**: Log GROBID processing time and success rates

## Troubleshooting

Common issues and solutions:

1. **GROBID not responding**: Ensure GROBID service is running and accessible at the configured URL
2. **Processing errors**: Some PDFs may be corrupt or have non-standard formatting
3. **Memory issues**: GROBID can require significant memory for large documents
4. **Missing data**: Some publications may not have all metadata fields available

For detailed API documentation, refer to the [official GROBID documentation](https://grobid.readthedocs.io/).
