# IBM Docling Guide for Citation Verification

This guide explains how to use IBM Docling as an alternative to GROBID for citation extraction and verification in academic papers.

## Introduction

IBM Docling is a modern, open-source library designed for efficient document parsing and conversion. It offers several advantages over GROBID:

- **Modern architecture**: Designed for integration with AI frameworks like LangChain and LlamaIndex
- **Enhanced extraction**: Better handling of tables, figures, and complex layouts
- **Simplified deployment**: Can be used without running a separate server
- **Python-based**: Native Python support without requiring Java

## Setup Options

You can set up IBM Docling in two ways:

### Option 1: Using Poetry (Recommended)

```bash
# Install Poetry
curl -sSL 'https://install.python-poetry.org' | python3 -

# Verify installation
poetry --version

# Clone Docling repository
git clone https://github.com/DS4SD/docling-ibm-models.git
cd docling-ibm-models

# Set up the environment
poetry env use $(which python3.10)
poetry shell
poetry install --no-dev
```

### Option 2: Using Docker

```bash
# Pull the Docker image
docker pull ibm/docling:latest

# You can run it with:
docker run -it ibm/docling:latest
```

## Project Structure

This project includes a TypeScript implementation for using IBM Docling to extract citations from academic papers:

```
src/
├── Docling/
│   ├── docling-client.ts   # Client for interacting with Docling
│   └── citation-processor.ts # Processes citation data from Docling
└── GrobID/                 # Original GROBID implementation
test-docling-parser.ts      # Test script for Docling implementation
```

## Using the Docling Implementation

### Basic Usage

```typescript
import { CitationProcessor } from './src/Docling/citation-processor';

async function extractCitations() {
  // Create a processor
  const processor = new CitationProcessor({
    // Specify Python venv or use Docker
    pythonVenv: 'docling-env' // or 'docker' to use Docker
  });
  
  // Check if Docling is available
  const isAvailable = await processor.checkService();
  if (!isAvailable) {
    console.error('Docling is not properly installed');
    return;
  }
  
  // Process a PDF
  const citationData = await processor.processPdf('path/to/paper.pdf', {
    includeCoordinates: true, // Include position coordinates for citations
    consolidateCitations: true // Consolidate similar citations
  });
  
  // Save the data
  processor.saveCitationData(citationData, 'output.json');
}
```

### Running the Test Script

```bash
# Install dependencies if you haven't already
npm install

# Run the test script with a sample PDF
npx ts-node test-docling-parser.ts sample-paper.pdf
```

## Comparison with GROBID

### Architecture Differences

| Feature | GROBID | IBM Docling |
|---------|--------|-------------|
| Runtime | Java-based server | Python library |
| Deployment | Requires running server | Can be used directly in Python |
| Output Format | TEI XML | JSON or Markdown |
| Integration | RESTful API | Native Python, LangChain, LlamaIndex |

### Output Structure

IBM Docling provides structured output with the following components:

- **Document metadata**: Title, authors, abstract, etc.
- **Section structure**: Hierarchical sections with headings
- **Citations**: In-text citations with surrounding context
- **References**: Bibliographic references with structured metadata
- **Tables and figures**: Extracted with position information

## Migrating from GROBID

### Step 1: Install IBM Docling

Follow the setup instructions at the beginning of this guide.

### Step 2: Update Import Statements

Change your import statements from GROBID to Docling:

```typescript
// Before (GROBID)
import { CitationProcessor } from './src/GrobID/citation-processor';

// After (Docling)
import { CitationProcessor } from './src/Docling/citation-processor';
```

### Step 3: Update Processing Logic

The main API remains similar, but with some differences:

```typescript
// Before (GROBID)
const processor = new CitationProcessor();
const isAlive = await processor.checkService();

// After (Docling)
const processor = new CitationProcessor({
  pythonVenv: 'docling-env' // Specify your environment
});
const isAvailable = await processor.checkService();
```

### Step 4: Handle Different Output Structure

While we've maintained similar interfaces, some output structures may differ. The main differences are:

- References may have slightly different field names
- Citation contexts may use different positioning information
- Docling includes additional structured data about the document

## Advanced Usage

### Using with LangChain

Docling can be integrated with LangChain for advanced document processing:

```python
from langchain.document_loaders import DoclingLoader

loader = DoclingLoader(file_path="path/to/document.pdf")
docs = loader.load()

# Use in LangChain pipeline
```

### Using with LlamaIndex

Docling works well with LlamaIndex for semantic search and retrieval:

```python
from llama_index.node_parser.docling import DoclingNodeParser

reader = DoclingReader(export_type=DoclingReader.ExportType.JSON)
node_parser = DoclingNodeParser()
index = VectorStoreIndex.from_documents(
    documents=reader.load_data("path/to/document.pdf"),
    transformations=[node_parser],
)

result = index.as_query_engine(llm=YOUR_LLM_MODEL).query("What is the main argument?")
```

## Troubleshooting

### Common Issues

1. **Python environment problems**:
   - Ensure you have Python 3.10+ installed
   - Verify your virtual environment is activated

2. **Docker issues**:
   - Check Docker is running: `docker ps`
   - Ensure you have permissions to run Docker

3. **Permission errors**:
   - Ensure you have read/write permissions for input/output files

### Getting Help

If you encounter issues:
- Check the [IBM Docling GitHub repository](https://github.com/DS4SD/docling-ibm-models)
- Review open issues for similar problems
- Contact the Docling community on GitHub

## References

- [IBM Docling Documentation](https://github.com/DS4SD/docling-ibm-models)
- [LangChain Integration Guide](https://python.langchain.com/docs/integrations/document_loaders/docling)
- [LlamaIndex Integration](https://docs.llamaindex.ai/en/stable/module_guides/loading/node_parsers/docling/)
