export interface AnalysisStep {
  id: number;
  name: string;
  status: 'pending' | 'processing' | 'completed';
  details: string[];
  currentDetail: number;
};

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
