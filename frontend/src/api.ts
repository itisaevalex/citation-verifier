import type { Reference } from './types';

const API_BASE_URL = '/api'; // Use relative path for the proxy configuration

export interface ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
}

/**
 * Upload a document for citation verification
 */
export async function uploadDocument(file: File): Promise<ApiResponse> {
  try {
    // First read the file as ArrayBuffer to preserve binary data
    const arrayBuffer = await file.arrayBuffer();
    console.log('Read file as ArrayBuffer, size:', arrayBuffer.byteLength);
    
    // Convert to Blob with correct mime type
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    console.log('Created Blob, size:', blob.size);
    
    // Create FormData with the blob
    const formData = new FormData();
    formData.append('pdf', blob, file.name);
    
    const response = await fetch(`${API_BASE_URL}/extract-references`, {
      method: 'POST',
      body: formData,
    });
    
    // Check if response is valid before parsing JSON
    if (!response.ok) {
      return { 
        success: false, 
        message: `Server error: ${response.status} ${response.statusText}` 
      };
    }
    
    // Check if response is empty
    const text = await response.text();
    if (!text) {
      return {
        success: false,
        message: 'Server returned an empty response'
      };
    }
    
    // Parse JSON safely
    try {
      const data = JSON.parse(text);
      return { success: true, data };
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Response text:', text);
      return {
        success: false,
        message: 'Failed to parse server response'
      };
    }
  } catch (error) {
    console.error('Error uploading document:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Verify extracted references
 */
export async function verifyReferences(references: Reference[]): Promise<ApiResponse> {
  // Use real API
  try {
    const response = await fetch(`${API_BASE_URL}/verify-references`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ references }),
    });
    
    // Check if response is valid before parsing JSON
    if (!response.ok) {
      return { 
        success: false, 
        message: `Server error: ${response.status} ${response.statusText}` 
      };
    }
    
    // Check if response is empty
    const text = await response.text();
    if (!text) {
      return {
        success: false,
        message: 'Server returned an empty response'
      };
    }
    
    // Parse JSON safely
    try {
      const data = JSON.parse(text);
      return { success: true, data };
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Response text:', text);
      return {
        success: false,
        message: 'Failed to parse server response'
      };
    }
  } catch (error) {
    console.error('Error verifying references:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Get verification report
 */
export async function getVerificationReport(documentId: string): Promise<ApiResponse> {
  // Use real API
  try {
    const response = await fetch(`${API_BASE_URL}/verification-report/${documentId}`);
    
    // Check if response is valid before parsing JSON
    if (!response.ok) {
      return { 
        success: false, 
        message: `Server error: ${response.status} ${response.statusText}` 
      };
    }
    
    // Check if response is empty
    const text = await response.text();
    if (!text) {
      return {
        success: false,
        message: 'Server returned an empty response'
      };
    }
    
    // Parse JSON safely
    try {
      const data = JSON.parse(text);
      return { success: true, data };
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Response text:', text);
      return {
        success: false,
        message: 'Failed to parse server response'
      };
    }
  } catch (error) {
    console.error('Error getting verification report:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Upload a reference document to the database
 */
export async function uploadReferenceDocument(file: File, referenceId: string): Promise<ApiResponse> {
  try {
    // First read the file as ArrayBuffer to preserve binary data
    const arrayBuffer = await file.arrayBuffer();
    console.log('Read file as ArrayBuffer, size:', arrayBuffer.byteLength);
    
    // Convert to Blob with correct mime type
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    console.log('Created Blob, size:', blob.size);
    
    // Create FormData with the blob
    const formData = new FormData();
    formData.append('pdf', blob, file.name);
    formData.append('referenceId', referenceId);
    
    const response = await fetch(`${API_BASE_URL}/upload-reference-document`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      return { 
        success: false, 
        message: `Server error: ${response.status} ${response.statusText}` 
      };
    }
    
    const text = await response.text();
    if (!text) {
      return {
        success: false,
        message: 'Server returned an empty response'
      };
    }
    
    try {
      const data = JSON.parse(text);
      return { success: true, data };
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Response text:', text);
      return {
        success: false,
        message: 'Failed to parse server response'
      };
    }
  } catch (error) {
    console.error('API error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
}

/**
 * Check if the GROBID service is running
 */
export async function checkGrobidStatus(): Promise<ApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/check-grobid`, {
      method: 'GET',
    });
    
    // Check if response is valid before parsing JSON
    if (!response.ok) {
      return { 
        success: false, 
        message: `Server error: ${response.status} ${response.statusText}` 
      };
    }
    
    // Parse JSON safely
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return { success: true, data };
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Response text:', text);
      return {
        success: false,
        message: 'Failed to parse server response'
      };
    }
  } catch (error) {
    console.error('Error checking GROBID status:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Update the reference database
 */
export async function updateReferenceDatabase(): Promise<ApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/update-database`, {
      method: 'POST',
    });
    
    // Check if response is valid before parsing JSON
    if (!response.ok) {
      return { 
        success: false, 
        message: `Server error: ${response.status} ${response.statusText}` 
      };
    }
    
    // Parse JSON safely
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return { success: true, data };
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Response text:', text);
      return {
        success: false,
        message: 'Failed to parse server response'
      };
    }
  } catch (error) {
    console.error('Error updating database:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}
