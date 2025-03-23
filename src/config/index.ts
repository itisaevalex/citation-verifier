import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env file
dotenv.config();

// Define possible missing reference handling strategies
export type MissingReferenceHandling = 'skip' | 'log' | 'fetch' | 'prompt';

/**
 * Application configuration
 */
export interface Config {
  // API Keys
  googleApiKey: string;
  geminiApiKey: string;
  
  // GROBID Configuration
  grobidUrl: string;
  
  // Application Settings
  environment: string;
  logLevel: string;
  
  // Document Database
  documentDbPath: string;
  
  // Missing Reference Handling
  missingRefHandling: MissingReferenceHandling;
}

/**
 * Get the configuration values from environment variables
 * with fallbacks to default values
 */
export function getConfig(): Config {
  // Check for required API keys
  const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!googleApiKey) {
    console.warn('WARNING: No Google/Gemini API key found. Citation verification will not work.');
    console.warn('Please set GOOGLE_API_KEY or GEMINI_API_KEY in .env file.');
  }
  
  // Get project root directory
  const projectRoot = path.resolve(__dirname, '../..');
  
  // Default database path
  const defaultDbPath = path.join(projectRoot, 'src', 'document-database');
  
  return {
    // API Keys
    googleApiKey: googleApiKey || '',
    geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    
    // GROBID Configuration
    grobidUrl: process.env.GROBID_URL || 'http://localhost:8070',
    
    // Application Settings
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    
    // Document Database
    documentDbPath: process.env.DOCUMENT_DB_PATH || defaultDbPath,
    
    // Missing Reference Handling
    missingRefHandling: (process.env.MISSING_REF_HANDLING as MissingReferenceHandling) || 'log',
  };
}

// Export a singleton instance of the config
export const config = getConfig();

// Utility function to check if the environment is production
export const isProduction = config.environment === 'production';

/**
 * Validate the configuration
 * Returns true if the configuration is valid for citation verification
 */
export function validateConfig(): boolean {
  const issues: string[] = [];
  
  // Check API keys
  if (!config.googleApiKey && !config.geminiApiKey) {
    issues.push('No Google/Gemini API key found.');
  }
  
  // Check document database path
  if (!fs.existsSync(config.documentDbPath)) {
    issues.push(`Document database path '${config.documentDbPath}' does not exist.`);
  }
  
  // Print issues
  if (issues.length > 0) {
    console.error('Configuration issues detected:');
    issues.forEach(issue => console.error(`- ${issue}`));
    console.error('\nPlease check your .env file or environment variables.');
    return false;
  }
  
  return true;
}
