export type AnalysisStep = {
  id: number;
  name: string;
  status: 'pending' | 'processing' | 'completed';
  details: string[];
  currentDetail: number;
};

export type Reference = {
  id: string;
  title: string;
  link: string;
  status: 'validating' | 'valid' | 'invalid' | 'uncertain';
  authors?: string;
  year?: string;
  context?: string;
  details?: string[];
};

export type Summary = {
  totalReferences: number;
  validReferences: number;
  invalidReferences: number;
  uncertainReferences: number;
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
