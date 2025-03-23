import * as fs from 'fs';
import * as path from 'path';
import { VerificationProgress } from '../reference-comparison/citation-verifier';

/**
 * A utility class for logging progress with special markers for Gemini verification steps
 */
export class ProgressLogger {
  private sessionId: string;
  private progressFilePath: string;
  private currentProgress: VerificationProgress;
  
  /**
   * Create a new ProgressLogger
   * @param sessionId Unique session ID for this verification process
   * @param tempDir Directory to store progress files (default: 'temp')
   */
  constructor(sessionId: string, tempDir: string = 'temp') {
    this.sessionId = sessionId;
    this.progressFilePath = path.join(process.cwd(), tempDir, `progress-${sessionId}.json`);
    
    // Ensure temp directory exists
    if (!fs.existsSync(path.join(process.cwd(), tempDir))) {
      fs.mkdirSync(path.join(process.cwd(), tempDir), { recursive: true });
    }
    
    // Initialize with default progress
    this.currentProgress = {
      currentReference: 'Initializing...',
      currentIndex: 0,
      totalReferences: 0,
      processedReferences: [],
      status: 'processing'
    };
    
    // Write initial progress
    this.writeProgress();
  }
  
  /**
   * Write the current progress to the progress file
   */
  private writeProgress(): void {
    fs.writeFileSync(this.progressFilePath, JSON.stringify(this.currentProgress, null, 2));
  }
  
  /**
   * Update the core progress information
   */
  public updateProgress(progress: Partial<VerificationProgress>): void {
    this.currentProgress = { ...this.currentProgress, ...progress };
    this.writeProgress();
    console.log(`[PROGRESS] ${JSON.stringify(progress)}`);
  }
  
  /**
   * Log a Gemini verification step with special markers
   * @param reference The reference being verified
   * @param step Which step in the verification process (preparing, calling, processing, completed)
   * @param details Additional details about the step
   * @param result Optional verification result if step is 'completed'
   */
  public logGeminiStep(
    reference: string, 
    step: 'preparing' | 'calling' | 'processing' | 'completed',
    details: string,
    result?: { isVerified: boolean; confidenceScore: number; explanation: string }
  ): void {
    // Update the progress with Gemini-specific information
    const geminiUpdate: Partial<VerificationProgress> = {
      geminiStatus: step,
      currentStep: details,
      stepProgress: step === 'preparing' ? 0 : 
                    step === 'calling' ? 1 : 
                    step === 'processing' ? 2 : 3,
      totalSteps: 3
    };
    
    // Add verification result if provided
    if (step === 'completed' && result) {
      geminiUpdate.geminiResult = {
        isVerified: result.isVerified,
        confidenceScore: result.confidenceScore,
        explanation: result.explanation.substring(0, 100) // Truncate long explanations
      };
    }
    
    // Update and write progress
    this.currentProgress = { ...this.currentProgress, ...geminiUpdate };
    this.writeProgress();
    
    // Log with special marker for potential parsing
    console.log(`[GEMINI:${step.toUpperCase()}] ${reference} - ${details}${
      result ? ` - Result: ${result.isVerified ? 'VERIFIED' : 'NOT_VERIFIED'} (${Math.round(result.confidenceScore * 100)}%)` : ''
    }`);
  }
  
  /**
   * Log a reference was found in the database
   */
  public logReferenceFound(reference: string): void {
    console.log(`[REFERENCE:FOUND] ${reference}`);
  }
  
  /**
   * Log a reference was not found in the database
   */
  public logReferenceMissing(reference: string): void {
    console.log(`[REFERENCE:MISSING] ${reference}`);
  }
  
  /**
   * Log completion of the verification process
   */
  public logCompletion(totalVerified: number, totalProcessed: number): void {
    const update: Partial<VerificationProgress> = {
      status: 'completed',
      currentReference: 'Verification completed',
      currentIndex: totalProcessed,
      totalReferences: totalProcessed
    };
    
    this.updateProgress(update);
    console.log(`[COMPLETE] Verification completed - ${totalVerified}/${totalProcessed} references verified`);
  }
  
  /**
   * Log an error in the verification process
   */
  public logError(error: string): void {
    const update: Partial<VerificationProgress> = {
      status: 'error',
      error
    };
    
    this.updateProgress(update);
    console.log(`[ERROR] ${error}`);
  }
}
