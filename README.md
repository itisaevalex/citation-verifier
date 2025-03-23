# TruthSource: AI-Powered Citation Verifier

![TruthSource](https://example.com/truthsource-logo.png)

> Tackling Research Fraud: How AI can help align with progress and fight dogma

## 🚀 Project Inspiration

Academic research drives human progress, but the integrity of this ecosystem is increasingly threatened by fraud, misrepresentation, and citation manipulation. We created TruthSource after encountering numerous instances where:

- Research papers misquoted or misrepresented source material
- Claims were attributed to papers that didn't support them
- Citations were fabricated or exaggerated to support unfounded conclusions

**Personal Experience**: As researchers ourselves, we've witnessed how inaccurate citations can propagate through the literature like a virus, creating false consensus and leading entire fields astray. One of our team members discovered that a widely-cited claim in medical literature traced back to a paper that actually concluded the opposite.

In an age of information overload, researchers often trust citations without verification, allowing misleading or fraudulent claims to gain unwarranted credibility.

## 💡 Problem We're Solving

TruthSource addresses three critical problems in scientific publishing:

1. **Citation Accuracy**: 14-21% of citations in academic literature contain significant errors or misrepresentations
2. **Verification Bottlenecks**: Manual citation checking is prohibitively time-consuming for reviewers and editors
3. **Propagation of Misinformation**: Incorrect citations can spread through literature for years before being detected

Our solution provides an automated system to extract, analyze, and verify citations from academic papers, dramatically reducing the time and expertise needed to validate research integrity.

## 🛠️ Technology Stack

### Languages
- **TypeScript**: Core application logic and type safety
- **JavaScript**: Runtime environment and supporting utilities
- **Bash**: Deployment and configuration scripts

### Frameworks/Libraries
- **Node.js**: Runtime environment for executing JavaScript code
- **GROBID**: Open-source machine learning library for extracting structured data from PDFs
- **Google Generative AI (Gemini)**: Large language model for understanding and verifying citation context
- **Axios**: HTTP client for API communication
- **Commander.js**: Command-line interface framework
- **Winston**: Logging framework for application insights

### Platforms
- **Docker**: Containerization for GROBID service
- **Google Cloud**: API services for Gemini integration
- **GitHub**: Version control and CI/CD pipeline

### Tools
- **TypeScript Compiler**: Static type checking and code compilation
- **ESLint**: Code quality and style enforcement
- **dotenv**: Environment variable management for secure configuration

## 🔍 Product Summary

TruthSource is an AI-powered citation verification system that extracts citations from academic papers and validates them against original sources. By combining document parsing technology with state-of-the-art language models, we enable researchers, reviewers, and publishers to efficiently validate citation accuracy.

### Key Features

1. **Automated Citation Extraction**
   - Extracts full bibliographic references and in-text citations from PDF documents
   - Preserves citation context and location data for comprehensive analysis
   - Handles complex citation formats across different academic disciplines

2. **Intelligent Citation Matching**
   - Links in-text citations to corresponding reference list entries
   - Implements fuzzy matching to handle variations in citation format
   - Identifies multi-reference citations and distributes context appropriately

3. **AI-Powered Verification**
   - Uses Gemini AI to analyze the semantic relationship between citation context and source material
   - Distinguishes between direct quotes, paraphrases, and general references
   - Evaluates whether the cited source actually supports the claims made

4. **Missing Reference Management**
   - Provides flexible options for handling citations to documents not in the database
   - Offers interactive prompting for user guidance on reference acquisition
   - Logs missing references for future batch processing

5. **Structured Verification Reports**
   - Generates detailed reports highlighting potential citation issues
   - Categorizes citations as verified, unverified, or requiring manual review
   - Provides evidence and confidence scores for each verification decision

### How AI Enhances Our Solution

TruthSource leverages AI in multiple innovative ways:

1. **Context Understanding**: Unlike simple text-matching approaches, our Gemini AI integration understands the semantic meaning of citation contexts, allowing it to verify paraphrased content that wouldn't be caught by traditional methods.

2. **Cross-Document Analysis**: The AI analyzes both the citing document and the referenced source to determine if the citation accurately represents the original work's findings and conclusions.

3. **Nuanced Classification**: Our model distinguishes between different types of citation errors, from minor misquotations to complete fabrications, providing nuanced feedback that helps prioritize issues.

4. **Learning Capabilities**: With each verification, the system improves its understanding of citation patterns and common misrepresentation techniques, becoming more effective over time.

## 📋 Setup Instructions

### Prerequisites

- Node.js 16.x or higher
- Docker (for running GROBID)
- Google API key for using Gemini AI

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/itisaevalex/citation-verifier
   cd citation-verifier
   ```

2. **Run the setup script**
   ```bash
   npm run setup
   ```

3. **Start GROBID service**
   ```bash
   docker run -p 8070:8070 grobid/grobid:0.8.1
   ```

4. **Process a document**
   ```bash
   npm run process -- /path/to/paper.pdf
   ```

### Configuration Options

Create a `.env` file at the root of the project with the following options:

```
# Required
GOOGLE_API_KEY=your_api_key_here

# Optional
GROBID_URL=http://localhost:8070
MISSING_REF_HANDLING=log  # Options: log, skip, prompt, fetch
DOCUMENT_DB_PATH=./src/document-database/documents
LOG_LEVEL=info
```

## 🏗️ Architecture

TruthSource follows a modular architecture with these key components:

1. **Document Processing Pipeline**
   - PDF extraction using GROBID
   - Reference and citation context mapping
   - Document database integration

2. **Verification Engine**
   - Citation context analysis
   - Source document retrieval
   - AI-powered semantic comparison

3. **Reporting System**
   - Structured verification results
   - Evidence collection and presentation
   - Confidence scoring and prioritization

## 🔮 Future Development

Our roadmap includes:

1. Web-based user interface for easier document submission and report visualization
2. Integration with academic databases for automatic source retrieval
3. Batch processing capabilities for journal publishers
4. Browser extension for real-time citation verification while reading papers
5. API access for third-party integration

## 👥 Team

- [Team Member 1] - Machine Learning Engineering
- [Team Member 2] - Full-Stack Development
- [Team Member 3] - Natural Language Processing
- [Team Member 4] - Academic Research

## 📜 License

This project is proprietary software. See the [LICENSE](LICENSE) file for details.

---

Built with ❤️ for the integrity of science at [Hackathon Name] 2025
