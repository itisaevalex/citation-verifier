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
  // Use real API
  const formData = new FormData();
  formData.append('pdf', file);
  
  try {
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
