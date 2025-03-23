# Gemini API Integration Guide

## Introduction

This guide provides a comprehensive overview of integrating Google's Generative AI (Gemini) into TypeScript applications, with a specific focus on text comparison and citation verification. Gemini provides powerful natural language understanding capabilities that can be used to compare text passages, determine factual accuracy, and generate structured outputs.

## Table of Contents

1. [Overview of Gemini](#overview-of-gemini)
2. [Setting Up Gemini in Your Project](#setting-up-gemini-in-your-project)
3. [Basic Usage](#basic-usage)
4. [Text Comparison for Citation Verification](#text-comparison-for-citation-verification)
5. [Prompt Engineering Best Practices](#prompt-engineering-best-practices)
6. [Handling Responses](#handling-responses)
7. [Error Handling](#error-handling)
8. [Advanced Use Cases](#advanced-use-cases)
9. [Limitations and Considerations](#limitations-and-considerations)
10. [References](#references)

## Overview of Gemini

Gemini is Google's advanced multimodal AI model that can process and generate content across text, images, audio, video, and code. In the context of citation verification, we primarily use its text understanding capabilities to:

- Compare citation contexts with source documents
- Detect factual accuracy and misrepresentation
- Generate structured verification reports with confidence scores

The model comes in several variants:

- **Gemini 1.5 Pro**: The most powerful general-purpose model, ideal for complex tasks like citation verification
- **Gemini 1.5 Flash**: A faster, more efficient model for simpler tasks
- **Gemini 1.0 Pro**: The previous generation, still useful for many applications

## Setting Up Gemini in Your Project

### Prerequisites

- Node.js (v14 or higher)
- TypeScript environment
- Google Generative AI API key

### Installation

Install the Google Generative AI SDK:

```bash
npm install @google/generative-ai
```

### Configuration

Set up your API key. For security, it's recommended to use environment variables:

```typescript
// Using environment variables (recommended)
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Alternatively, for quick testing only
const genAI = new GoogleGenerativeAI('your-api-key-here');
```

> **Important**: Never hardcode API keys in production code. Use environment variables or a secure key management system.

## Basic Usage

### Initializing the Model

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the API with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Choose the model to use
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
```

### Generating Simple Text

```typescript
async function generateText(prompt: string): Promise<string> {
  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

// Example usage
const summary = await generateText("Summarize the key benefits of machine learning in healthcare.");
console.log(summary);
```

## Text Comparison for Citation Verification

One of the primary use cases for Gemini in our system is citation verification. This involves comparing a citation context with the source document to determine if the citation accurately represents the source material.

### Implementation Example

Below is how we implement citation verification in our system:

```typescript
async function verifyWithGemini(
  citationContext: string,
  sourceDocument: string,
  documentMetadata: DocumentMetadata
): Promise<VerificationResult> {
  // Create a prompt that instructs Gemini to compare the texts
  const prompt = `
You are a scholarly citation verifier that evaluates whether a citation accurately represents the source material.

SOURCE DOCUMENT:
Title: ${documentMetadata.title}
Authors: ${documentMetadata.authors.join(', ')}
${documentMetadata.doi ? `DOI: ${documentMetadata.doi}` : ''}
${documentMetadata.year ? `Year: ${documentMetadata.year}` : ''}
${documentMetadata.journal ? `Journal: ${documentMetadata.journal}` : ''}

DOCUMENT CONTENT:
${sourceDocument}

CITATION CONTEXT TO VERIFY:
${citationContext}

TASK:
1. Determine if the citation context accurately represents what is stated in the source document.
2. Provide the specific section or quote from the source document that confirms or contradicts the citation.
3. Assess whether the citation is:
   - Accurately representing the source material
   - Misrepresenting the source material
   - Taking information out of context
   - Making claims not present in the source

IMPORTANT: Provide your verification result in the following JSON format:
{
  "isVerified": boolean,
  "confidenceScore": number between 0 and 1,
  "matchLocation": "specific text from the source document that matches",
  "explanation": "detailed explanation of your reasoning"
}`;

  // Call the Gemini API
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  
  // Parse JSON response
  try {
    // Extract JSON if it's wrapped in markdown code blocks
    const jsonMatch = text.match(/```(?:json)?([\s\S]*?)```/) || text.match(/{[\s\S]*?}/);
    const jsonString = jsonMatch ? jsonMatch[0].replace(/```json|```/g, '').trim() : text.trim();
    
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Failed to parse Gemini response: ${error}`);
  }
}
```

## Prompt Engineering Best Practices

Crafting effective prompts is crucial for getting good results from Gemini. Here are some best practices:

### 1. Be Specific and Clear

Clearly define what you want the model to do. For citation verification, specify:
- The task (verifying a citation)
- The inputs (citation context and source document)
- The expected output format (JSON structure)

### 2. Provide Context

Give Gemini all the context it needs to make an informed decision:
- Document metadata (title, authors, year, etc.)
- The full source text (or relevant sections)
- The citation context with sufficient surrounding text

### 3. Structure Your Prompts

Use a consistent structure for your prompts:
1. Role description ("You are a scholarly citation verifier...")
2. Input data (source document and citation)
3. Specific task instructions
4. Output format specification

### 4. Request Structured Output

For programmatic use, request structured output in a specific format:
```
IMPORTANT: Provide your verification result in the following JSON format:
{
  "isVerified": boolean,
  "confidenceScore": number between 0 and 1,
  "matchLocation": "specific text from the source document that matches",
  "explanation": "detailed explanation of your reasoning"
}
```

## Handling Responses

Gemini responses may come in different formats. It's important to process them correctly:

### Parsing JSON Responses

```typescript
function parseGeminiResponse(responseText: string): any {
  try {
    // First try to extract JSON if it's wrapped in markdown code blocks
    const jsonMatch = responseText.match(/```(?:json)?([\s\S]*?)```/) || 
                     responseText.match(/{[\s\S]*?}/);
    
    const jsonString = jsonMatch ? 
      jsonMatch[0].replace(/```json|```/g, '').trim() : 
      responseText.trim();
    
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Failed to parse response: ${error}`);
  }
}
```

### Handling Unstructured Responses

Sometimes Gemini might not return a valid JSON. In these cases, implement a fallback:

```typescript
function handleUnstructuredResponse(responseText: string): VerificationResult {
  // Simple heuristic analysis
  const isVerified = /verified|correct|accurate|true|yes/i.test(responseText) &&
                  !/not verified|incorrect|inaccurate|false|no/i.test(responseText);
  
  return {
    isVerified,
    confidenceScore: isVerified ? 0.7 : 0.3,
    explanation: `Could not parse structured response. Raw model output: ${responseText.substring(0, 200)}...`
  };
}
```

## Error Handling

Robust error handling is essential when working with AI APIs:

```typescript
async function safeGeminiCall(prompt: string): Promise<any> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    // Handle specific error types
    if (error.message.includes('rate limit')) {
      console.error('Rate limit exceeded. Implementing exponential backoff...');
      // Implement retry logic with exponential backoff
    } else if (error.message.includes('invalid API key')) {
      console.error('Authentication error: Invalid API key');
    } else {
      console.error('Error calling Gemini API:', error);
    }
    throw error;
  }
}
```

## Advanced Use Cases

### Batch Processing Citations

When verifying multiple citations, implement batch processing with rate limiting:

```typescript
async function batchVerifyCitations(
  citations: Array<{context: string, document: string, metadata: DocumentMetadata}>
): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  const batchSize = 5; // Process in batches of 5
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  for (let i = 0; i < citations.length; i += batchSize) {
    const batch = citations.slice(i, i + batchSize);
    const batchPromises = batch.map(citation => 
      verifyWithGemini(citation.context, citation.document, citation.metadata)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Add delay between batches to avoid rate limits
    if (i + batchSize < citations.length) {
      await delay(1000); // 1 second delay between batches
    }
  }
  
  return results;
}
```

### Fine-tuning for Citation Patterns

Adapt prompts for specific citation verification patterns:

```typescript
// For verifying statistical claims
const statisticalClaimPrompt = `...focus on verifying whether the statistical 
figures and percentages in the citation match those in the source document...`;

// For verifying quotations
const quotationPrompt = `...determine if the quoted text appears verbatim in the 
source document or if it has been modified...`;
```

## Limitations and Considerations

### Token Limits

Gemini models have token limits that restrict the amount of text you can process:

- Gemini 1.5 Pro: Maximum ~1 million tokens (input + output)
- Older models: Usually 8K-32K tokens

For longer documents, implement chunking strategies:

```typescript
function chunkDocument(document: string, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < document.length; i += maxChunkSize) {
    chunks.push(document.substr(i, maxChunkSize));
  }
  return chunks;
}
```

### Costs and Rate Limits

- Monitor your API usage to avoid unexpected costs
- Implement rate limiting in your application
- Set up alerts for unusual API consumption

### Privacy and Data Handling

- Be mindful of sending sensitive information to the API
- Follow your organization's data governance policies
- Consider data residency requirements

## References

- [Google Generative AI SDK Documentation](https://ai.google.dev/docs)
- [Google Gemini API Reference](https://ai.google.dev/api/rest/v1beta)
- [Gemini Prompt Design Guide](https://ai.google.dev/docs/prompt_design)
- [Citation Verification Best Practices](https://ai.google.dev/docs/use_cases/text_analysis)

## Example Implementation

For a complete working example, refer to our implementation in the `citation-verifier.ts` file in the `src/reference-comparison` directory.

```typescript
// Example command to run a test
npx ts-node test-gemma3.ts
```

This will demonstrate the Gemini API integration with our citation verification system.
