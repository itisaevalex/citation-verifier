export interface AnalysisStep {
  id: number;
  name: string;
  status: 'pending' | 'processing' | 'completed';
  details: string[];
  currentDetail: number;
};

// Interface for Gemini verification progress information
export interface GeminiVerificationInfo {
  status: 'preparing' | 'calling' | 'processing' | 'completed';
  currentStep?: string;
  stepProgress?: number;
  totalSteps?: number;
  result?: {
    isVerified: boolean;
    confidenceScore: number;
    explanation: string;
  };
  statusMessage?: string;
}

export interface Reference {
  id: string;
  title: string;
  link: string;
  status: 'validating' | 'valid' | 'invalid' | 'uncertain' | 'missing';
  authors?: string;
  year?: string;
  context?: string;
  details?: string[];
  inDatabase?: boolean;
  uploading?: boolean;
  uploadSuccess?: boolean;
  uploadError?: string;
  geminiVerification?: GeminiVerificationInfo;
};

export interface Summary {
  totalReferences: number;
  validReferences: number;
  invalidReferences: number;
  uncertainReferences: number;
  missingReferences: number;
  completionTime: string;
  issues: string[];
};

// Type for verification report from backend
export interface VerificationReport {
  documentTitle: string;
  totalCitationsChecked: number;
  verifiedCitations: number;
  unverifiedCitations: number;
  inconclusiveCitations: number;
  missingReferences: number;
  citations: CitationResult[];
}

// Type for individual citation result
export interface CitationResult {
  referenceIndex: number;
  verified: boolean;
  verificationConfidence: number;
  verificationMethod: string;
  details?: string;
}
