# Citation Verifier

A TypeScript module that analyzes academic papers to extract and verify citation accuracy by:
1. Extracting text and citation data from academic PDFs using GROBID
2. Identifying quoted or referenced content and matching it to specific citations
3. Providing structured output for verification against original sources

## Purpose

This module serves as the first stage in building a citation verification pipeline. It extracts all citations, reference metadata, and their contexts from PDF papers, preparing the data for deeper analysis through LLMs like Gemini AI to determine:

- Whether text represents a direct quote, paraphrase, or reference to external work
- The relationship between in-text citations and their source material
- The accuracy of attribution in academic writing

## Prerequisites

- Node.js 16.x or higher
- Docker (for running GROBID)
- Google API key for using Gemini AI (for citation verification)

## Setup Instructions

### 1. Configure Environment Variables

Create a `.env` file at the root of the project:
```bash
# Copy the example environment file
npm run setup
# Or manually
cp .env.example .env
```

Then edit the `.env` file to add your Google API key:
```
GOOGLE_API_KEY=your_api_key_here
```

### 2. Start GROBID Service

Start the GROBID service using Docker:

```bash
docker pull grobid/grobid:0.8.1
docker run -p 8070:8070 grobid/grobid:0.8.1
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Build the Project

```bash
npm run build
```

## Usage

### Process a Document to Extract and Verify Citations

```bash
npx ts-node src/utils/verify-citations.ts process /path/to/paper.pdf
```

This single command:
- Checks GROBID service availability
- Extracts references from the PDF
- Verifies citations against available documents
- Generates a verification report

### Extract References Only

```bash
npx ts-node src/utils/verify-citations.ts extract /path/to/paper.pdf
```

### Add Reference Documents to the Database

```bash
npx ts-node src/utils/verify-citations.ts add-document /path/to/reference.pdf
```

### Verify Previously Extracted References

```bash
npx ts-node src/utils/verify-citations.ts verify /path/to/references.json
```

### Handling Missing References

When citations reference documents not in your database, the system provides several handling options that can be configured in your `.env` file:

```
# Options: log, skip, prompt, fetch
MISSING_REF_HANDLING=prompt
```

- **log**: Record missing references without stopping (default)
- **skip**: Skip missing references and mark as inconclusive
- **prompt**: Ask the user what to do with each missing reference
- **fetch**: Attempt to automatically fetch references (future feature)

You can also set this option when running verification:

```bash
npx ts-node src/utils/verify-citations.ts verify /path/to/references.json --missing-ref-handling=prompt
```

## Security

### API Key Protection

This project uses environment variables for API key management to ensure sensitive credentials are not committed to version control:

- Never commit your `.env` file to GitHub
- The repository includes a `.gitignore` file that excludes `.env` files
- For CI/CD pipelines, use encrypted environment variables or secrets management

## Output Format

The module generates structured data in JSON format with the following structure:

```json
{
  "documentTitle": "Paper Title",
  "references": [
    {
      "id": "b0",
      "title": "Referenced Work Title",
      "authors": [
        {
          "firstName": "John",
          "lastName": "Smith"
        }
      ],
      "date": "2020",
      "journal": "Journal of Example Studies",
      "doi": "10.1234/example.567",
      "rawText": "Smith, J. (2020). Referenced Work Title. Journal of Example Studies."
    }
  ],
  "citationContexts": [
    {
      "id": "ref1",
      "text": "As Smith (2020) argues...",
      "position": {
        "page": 2,
        "coords": {
          "x": 100,
          "y": 200,
          "width": 150,
          "height": 20
        }
      },
      "referenceIds": ["b0"]
    }
  ]
}
```

## Integration with Gemini AI

This module prepares data for processing with Gemini AI or other LLMs. Here's how to use the extracted data:

1. **Extract citation data with this module**
   ```typescript
   const processor = new CitationProcessor();
   const citationData = await processor.processPdf("paper.pdf");
   ```

2. **Process with Gemini AI**
   ```typescript
   // Example integration (requires Google AI API)
   const { GoogleGenerativeAI } = require("@google/generative-ai");
   const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
   
   for (const context of citationData.citationContexts) {
     // Get the surrounding paragraph for context
     const paragraphText = extractParagraphFromPDF(context.position);
     
     // Find matching references
     const refs = citationData.references.filter(ref => 
       context.referenceIds.includes(ref.id)
     );
     
     // Ask Gemini to analyze
     const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
     const analysisPrompt = `
       Determine if this text contains a direct quote, paraphrase, or general reference:
       
       Citation Context: "${paragraphText}"
       
       Referenced work: "${refs[0]?.title || 'Unknown'}" by ${refs[0]?.authors.map(a => 
         `${a.lastName}, ${a.firstName}`).join('; ') || 'Unknown'}
       
       Identify the specific text being cited, if any, and rate how accurately it represents the source.
     `;
     
     // Send to Gemini API
     const result = await model.generateContent(analysisPrompt);
     const analysis = result.response.text();
     
     // Store result
     verificationResults.push({
       citationContext: context,
       references: refs,
       analysis
     });
   }
   ```

## Contributing

We welcome contributions to improve the citation verification system! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Development

Start the development server with auto-reload:

```bash
npm run dev
```

## Next Steps in the Citation Verification Pipeline

This module handles the first stage of citation extraction. To complete the verification system:

1. Implement the Gemini AI integration to analyze text and determine if content is:
   - Direct quotation (exact text from source)
   - Paraphrase (reworded content from source)
   - General reference (mentioning source without specific content)

2. Build a verification engine to match extracted text against source documents

3. Create a user interface to display verification results