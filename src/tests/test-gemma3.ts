import { GoogleGenerativeAI } from "@google/generative-ai";

// Set up the API key - in production, use environment variables
const API_KEY = "API_KEY";
const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Test function to verify Gemini is working correctly
 */
async function testGemma3() {
  try {
    console.log("Testing Gemini connection...");
    
    // Test text generation with Gemini
    console.log("Testing text generation with Gemini...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    // Structure the prompt for citation verification
    const prompt = `
You are a scholarly citation verifier that evaluates whether a citation accurately represents the source material.

SOURCE DOCUMENT:
"Machine learning is a subset of artificial intelligence that involves training algorithms to learn patterns from data. These algorithms can improve their performance over time without being explicitly programmed for specific tasks."

CITATION CONTEXT TO VERIFY:
"According to recent research, machine learning systems can adapt to new data patterns automatically."

TASK:
1. Determine if the citation context accurately represents what is stated in the source document.
2. Provide the specific section or quote from the source document that confirms or contradicts the citation.
3. Provide your verification result in the following JSON format:
{
  "isVerified": boolean,
  "confidenceScore": number between 0 and 1,
  "matchLocation": "specific text from the source document that matches",
  "explanation": "detailed explanation of your reasoning"
}
`;
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    console.log("Gemini Response:");
    console.log(text);
    
    // Try to parse the response as JSON (it might not be in proper JSON format)
    try {
      const jsonResponse = JSON.parse(text.replace(/```json|```/g, '').trim());
      console.log("\nParsed JSON Response:");
      console.log(JSON.stringify(jsonResponse, null, 2));
    } catch (parseError) {
      console.log("\nCould not parse response as JSON, but the API call was successful.");
    }
    
    console.log("\n✅ Gemini API test completed successfully!");
    return true;
  } catch (error) {
    console.error("❌ Error testing Gemini:", error);
    return false;
  }
}

// Run the test
testGemma3()
  .then(success => {
    if (success) {
      console.log("Gemini integration is working correctly.");
    } else {
      console.error("Failed to verify Gemini integration.");
    }
  })
  .catch(error => {
    console.error("Unexpected error:", error);
  });
