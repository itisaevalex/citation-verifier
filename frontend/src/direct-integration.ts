import type { Reference, VerificationReport } from './types';

/**
 * Process a document directly using the backend citation verification logic
 * This bypasses the API and uses the backend code directly through our local server
 */
export async function processDocumentDirect(file: File): Promise<{
  references: Reference[],
  verificationReport: VerificationReport
}> {
  try {
    console.log('Direct integration: Processing document', file.name);
    
    // In browser environment, we need to send the document to our local API endpoint
    // that bridges to the backend verification code
    console.log('Using local backend server bridge');
    
    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append('file', file);
    
    // Call our local Express.js server endpoint
    const response = await fetch('/api/process-document-local', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Local API error: ${response.status} ${response.statusText}. ${errorText}`);
    }
    
    const results = await response.json();
    return convertBackendResultsToFrontend(results, file.name);
  } catch (error) {
    console.error('Direct integration error:', error);
    throw error;
  }
}

/**
 * Convert backend processing results to frontend format
 */
function convertBackendResultsToFrontend(backendResults: any, filename: string): {
  references: Reference[],
  verificationReport: VerificationReport
} {
  console.log('Converting backend results to frontend format', backendResults);
  console.log('Backend verification report:', backendResults.verificationReport);
  
  // Extract reference data from backend results
  const references: Reference[] = (backendResults.references || []).map((ref: any, index: number) => {
    // If we have a verification report, look up the citation status
    let status = 'uncertain';
    
    // Check if we have a verification report with results array (correct structure)
    if (backendResults.verificationReport && Array.isArray(backendResults.verificationReport.results)) {
      console.log(`Looking for verification result for reference ${index} with title "${ref.title}"`);
      
      // Match by reference title instead of index
      const result = backendResults.verificationReport.results.find((r: any) => 
        r.referenceTitle === ref.title);
      
      if (result) {
        console.log(`Found verification result:`, result);
        status = result.isVerified === true ? 'valid' : 
                (result.isVerified === false ? 'invalid' : 'uncertain');
        console.log(`Mapped status: ${status}`);
      } else {
        console.log(`No verification result found for reference "${ref.title}"`);
      }
    } 
    // Legacy format - check if the report has a citations array
    else if (backendResults.verificationReport && Array.isArray(backendResults.verificationReport.citations)) {
      console.log(`Checking citation status for reference index ${index}`);
      const citation = backendResults.verificationReport.citations.find((c: any) => c.referenceIndex === index);
      if (citation) {
        console.log(`Found citation for reference ${index}:`, citation);
        status = citation.verified === true ? 'valid' : 
                (citation.verified === false ? 'invalid' : 'uncertain');
        console.log(`Mapped status: ${status}`);
      } else {
        console.log(`No citation found for reference ${index}`);
      }
    } 
    // Direct property on the reference object
    else if (ref.verified !== undefined) {
      console.log(`Using reference verified property for ${index}: ${ref.verified}`);
      status = ref.verified === true ? 'valid' : 
              (ref.verified === false ? 'invalid' : 'uncertain');
      console.log(`Mapped status: ${status}`);
    } else {
      console.log(`No verification info found for reference ${index}, using default status: ${status}`);
    }
    
    return {
      id: String(index + 1),
      title: ref.title || 'Unknown Title',
      authors: Array.isArray(ref.authors) ? ref.authors.join(', ') : (ref.authors || 'Unknown Authors'),
      year: ref.year || 'Unknown Year',
      link: ref.doi ? `https://doi.org/${ref.doi}` : (ref.url || '#'),
      status: status,
      context: Array.isArray(ref.contexts) ? 
        ref.contexts.map((ctx: any) => ctx.text || ctx).join(' [...] ') : 
        (ref.context || ''),
      details: ref.details || []
    };
  });
  
  // Use the verification report from the backend or create a default one
  const verificationReport: VerificationReport = backendResults.verificationReport || {
    documentTitle: filename.replace('.pdf', ''),
    totalCitationsChecked: references.length,
    verifiedCitations: 0,
    unverifiedCitations: 0,
    inconclusiveCitations: references.length,
    missingReferences: 0,
    citations: []
  };
  
  return { references, verificationReport };
}

/**
 * Load the sample paper for testing
 */
export async function loadSamplePaper(): Promise<File> {
  try {
    console.log('Loading sample paper');
    
    // Try to load the sample paper from our server
    const response = await fetch('/sample-paper.pdf');
    if (!response.ok) {
      // If we can't find the sample paper, create a blank one
      console.warn('Sample paper not found, creating a blank one');
      const blob = new Blob(['Sample paper content'], { type: 'application/pdf' });
      return new File([blob], 'sample-paper.pdf', { type: 'application/pdf' });
    }
    
    const blob = await response.blob();
    return new File([blob], 'sample-paper.pdf', { type: 'application/pdf' });
  } catch (error) {
    console.error('Error loading sample paper:', error);
    // Fallback to a blank sample paper
    const blob = new Blob(['Sample paper content'], { type: 'application/pdf' });
    return new File([blob], 'sample-paper.pdf', { type: 'application/pdf' });
  }
}
