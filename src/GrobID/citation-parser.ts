import { DOMParser } from '@xmldom/xmldom';
import * as xpath from 'xpath';

/**
 * Interface representing a citation context (in-text citation)
 */
export interface CitationContext {
  id: string;
  text: string;
  surroundingText: string;
  position: {
    page: number;
    coords?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  referenceIds: string[];
}

/**
 * Interface representing a bibliographic reference
 */
export interface BibReference {
  id: string;
  title?: string;
  authors: Array<{
    firstName?: string;
    middleName?: string;
    lastName?: string;
    rawName?: string;
  }>;
  date?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: {
    start?: string;
    end?: string;
  };
  doi?: string;
  rawText?: string;
}

// Adding proper typings for the xpath select function results
type XPathResult = string | number | boolean | Node | Node[];

// Define a more specific type for the xmldom Document
type XmlDocument = ReturnType<DOMParser['parseFromString']>;

/**
 * Class for parsing TEI XML from GROBID to extract citation information
 */
export class CitationParser {
  private doc: XmlDocument;
  private select: xpath.XPathSelect;
  private ns: { [key: string]: string } = {
    tei: 'http://www.tei-c.org/ns/1.0',
  };

  /**
   * Creates a new CitationParser
   * @param xmlString The TEI XML string to parse
   */
  constructor(xmlString: string) {
    const parser = new DOMParser();
    this.doc = parser.parseFromString(xmlString, 'text/xml') as XmlDocument;
    
    // Create a selector function that uses our namespace
    this.select = xpath.useNamespaces(this.ns);
  }

  /**
   * Extract all bibliographic references from the document
   * @returns Array of bibliographic references
   */
  extractReferences(): BibReference[] {
    const references: BibReference[] = [];
    
    try {
      // Cast the document to any to avoid TypeScript errors
      const bibl = this.select('//tei:listBibl/tei:biblStruct', this.doc as any) as Node[];
      
      if (!bibl || !Array.isArray(bibl) || bibl.length === 0) {
        return references;
      }
      
      // Process each bibliographic reference
      for (let i = 0; i < bibl.length; i++) {
        const biblNode = bibl[i];
        
        // Generate a synthetic ID if missing
        let id = this.getAttributeValue(biblNode, '@xml:id') || '';
        if (!id) {
          id = `b${i}`; // Use index-based ID if no ID present
        }
        
        // Extract title
        const title = this.getTextContent(biblNode, './/tei:title[@level="a" or @level="m"]');
        
        // Extract authors
        const authors = this.extractAuthors(biblNode);
        
        // Extract publication date
        const date = this.getTextContent(biblNode, './/tei:date[@type="published"]/@when');
        
        // Extract journal/conference
        const journal = this.getTextContent(biblNode, './/tei:title[@level="j"]');
        
        // Extract volume, issue, pages
        const volume = this.getTextContent(biblNode, './/tei:biblScope[@unit="volume"]');
        const issue = this.getTextContent(biblNode, './/tei:biblScope[@unit="issue"]');
        const pageStart = this.getTextContent(biblNode, './/tei:biblScope[@unit="page"]/@from');
        const pageEnd = this.getTextContent(biblNode, './/tei:biblScope[@unit="page"]/@to');
        
        // Extract DOI
        const doi = this.getTextContent(biblNode, './/tei:idno[@type="DOI"]');
        
        // Extract raw text if available
        const rawText = this.getTextContent(biblNode, './/tei:note[@type="raw_reference"]');
        
        references.push({
          id,
          title,
          authors,
          date,
          journal,
          volume,
          issue,
          pages: {
            start: pageStart,
            end: pageEnd,
          },
          doi,
          rawText,
        });
      }
    } catch (error) {
      console.error('Error in extractReferences:', error);
    }
    
    return references;
  }

  /**
   * Extract all citation contexts (in-text citations) from the document
   * @returns Array of citation contexts
   */
  extractCitationContexts(): CitationContext[] {
    const contexts: CitationContext[] = [];
    
    try {
      // Cast the document to any to avoid TypeScript errors
      const citations = this.select('//tei:ref[@type="bibr"]', this.doc as any) as Node[];
      
      if (!citations || !Array.isArray(citations) || citations.length === 0) {
        return contexts;
      }
      
      for (const citation of citations) {
        try {
          const id = this.getAttributeValue(citation, '@xml:id');
          const text = this.getNodeText(citation);
          
          // Get the target reference(s)
          const targetAttr = this.getAttributeValue(citation, '@target');
          const referenceIds = targetAttr ? 
            targetAttr.split(' ')
              .map(id => id.startsWith('#') ? id.substring(1) : id) : 
            [];
          
          // Try to get coordinates if available
          const coords = this.extractCoordinates(citation);
          
          // Extract surrounding text
          const surroundingText = this.getSurroundingText(citation);
          
          contexts.push({
            id,
            text,
            surroundingText,
            position: {
              page: coords?.page || 1,
              coords: coords?.bbox,
            },
            referenceIds,
          });
        } catch (error) {
          console.error('Error extracting citation context:', error);
        }
      }
    } catch (error) {
      console.error('Error in extractCitationContexts:', error);
    }
    
    return contexts;
  }

  /**
   * Extract the full text content of the document
   * @returns The full text of the document
   */
  extractFullText(): string {
    try {
      // Find all paragraph elements in the document
      const paragraphs = this.select('//tei:body//tei:p', this.doc as any) as Node[];
      
      if (!paragraphs || !Array.isArray(paragraphs) || paragraphs.length === 0) {
        return '';
      }
      
      // Join all paragraph texts
      const textParts = paragraphs.map(p => this.getNodeText(p));
      return textParts.join('\n\n');
    } catch (error) {
      console.error('Error extracting full text:', error);
      return '';
    }
  }

  /**
   * Extract the document authors
   * @returns Array of author information
   */
  extractDocumentAuthors(): Array<{firstName?: string, middleName?: string, lastName?: string, rawName?: string}> {
    try {
      // Get authors from the teiHeader
      const authorNodes = this.select('//tei:teiHeader//tei:titleStmt//tei:author', this.doc as any) as Node[];
      
      if (!authorNodes || !Array.isArray(authorNodes) || authorNodes.length === 0) {
        return [];
      }
      
      return authorNodes.map(authorNode => {
        const firstName = this.getTextContent(authorNode, './/tei:forename[@type="first"]');
        const middleName = this.getTextContent(authorNode, './/tei:forename[@type="middle"]');
        const lastName = this.getTextContent(authorNode, './/tei:surname');
        const rawName = this.getNodeText(authorNode);
        
        return {
          firstName, 
          middleName,
          lastName,
          rawName: rawName || `${firstName} ${lastName}`.trim()
        };
      });
    } catch (error) {
      console.error('Error extracting document authors:', error);
      return [];
    }
  }

  /**
   * Private helper methods
   */
  private extractAuthors(ref: Node): Array<{firstName?: string, middleName?: string, lastName?: string, rawName?: string}> {
    const authors: Array<{firstName?: string, middleName?: string, lastName?: string, rawName?: string}> = [];
    
    try {
      const authorNodes = this.select('.//tei:author', ref) as Node[];
      
      if (!authorNodes || !Array.isArray(authorNodes) || authorNodes.length === 0) {
        return authors;
      }
      
      for (const authorNode of authorNodes) {
        try {
          const persNameNodes = this.select('./tei:persName', authorNode) as Node[];
          
          if (persNameNodes && Array.isArray(persNameNodes) && persNameNodes.length > 0) {
            const persNameNode = persNameNodes[0];
            
            if (persNameNode) {
              const firstName = this.getTextContent(persNameNode, './tei:forename[@type="first"]');
              const middleName = this.getTextContent(persNameNode, './tei:forename[@type="middle"]');
              const lastName = this.getTextContent(persNameNode, './tei:surname');
              
              authors.push({
                firstName,
                middleName,
                lastName,
                rawName: this.getNodeText(persNameNode),
              });
            }
          } else {
            // If no structured name is available, try to get the raw name
            authors.push({
              rawName: this.getNodeText(authorNode),
            });
          }
        } catch (error) {
          console.error('Error processing author:', error);
        }
      }
    } catch (error) {
      console.error('Error in extractAuthors:', error);
    }
    
    return authors;
  }

  private extractCoordinates(node: Node): { page: number, bbox: { x: number, y: number, width: number, height: number } } | null {
    try {
      // Look for coordinates in attributes like @coords
      const coords = this.getAttributeValue(node, '@coords');
      if (!coords) return null;
      
      const parts = coords.split(';');
      if (parts.length < 2) return null;
      
      const pagePart = parts[0].split(':');
      if (pagePart.length < 2) return null;
      
      const page = parseInt(pagePart[1], 10);
      if (isNaN(page)) return null;
      
      const bboxPart = parts[1].split(':');
      if (bboxPart.length < 2) return null;
      
      const bboxValues = bboxPart[1].split(',').map(v => parseFloat(v));
      if (bboxValues.length < 4 || bboxValues.some(v => isNaN(v))) return null;
      
      return {
        page,
        bbox: {
          x: bboxValues[0],
          y: bboxValues[1],
          width: bboxValues[2] - bboxValues[0],
          height: bboxValues[3] - bboxValues[1],
        },
      };
    } catch (error) {
      console.error('Error extracting coordinates:', error);
      return null;
    }
  }

  private getAttributeValue(node: Node, attr: string): string {
    try {
      // Check if we're dealing with an xml:id attribute, which requires namespace handling
      if (attr === '@xml:id') {
        // Use local-name() to bypass namespace issues
        const matches = this.select(`.//@*[local-name()='id']`, node as any) as Node[];
        if (matches && matches.length > 0) {
          return (matches[0] as any).nodeValue || '';
        }
        return '';
      }
      
      // For other attributes, proceed normally
      const matches = this.select(attr, node as any) as Node[];
      if (matches && matches.length > 0) {
        return (matches[0] as any).nodeValue || '';
      }
      return '';
    } catch (error) {
      console.error('Error in getAttributeValue:', error);
      return '';
    }
  }

  private getTextContent(node: Node, xpathExpr: string): string {
    try {
      const result = this.select(xpathExpr, node) as XPathResult;
      
      if (!result) return '';
      
      if (Array.isArray(result)) {
        if (result.length === 0) return '';
        
        const firstNode = result[0] as Node;
        if (firstNode) {
          return this.getNodeText(firstNode);
        }
      } else if (typeof result === 'string') {
        return result;
      } else if (typeof result === 'number') {
        return result.toString();
      } else if (result) {
        return this.getNodeText(result as Node);
      }
    } catch (error) {
      console.error('Error in getTextContent:', error);
    }
    
    return '';
  }

  private getNodeText(node: Node): string {
    if (!node) return '';
    
    try {
      if (node.nodeType === 3) return node.nodeValue || ''; // Text node
      
      let text = '';
      const childNodes = node.childNodes;
      
      if (childNodes) {
        for (let i = 0; i < childNodes.length; i++) {
          const childNode = childNodes[i];
          if (childNode) {
            text += this.getNodeText(childNode);
          }
        }
      }
      
      return text.trim();
    } catch (error) {
      console.error('Error in getNodeText:', error);
      return '';
    }
  }

  private getSurroundingText(node: Node): string {
    try {
      // Find the closest paragraph parent
      let paragraphNode = node.parentNode;
      while (paragraphNode && paragraphNode.nodeName !== 'p') {
        paragraphNode = paragraphNode.parentNode;
      }
      
      if (!paragraphNode) {
        // Fallback to immediate parent if no paragraph found
        paragraphNode = node.parentNode;
        if (!paragraphNode) return '';
      }

      // Get all text content of the paragraph
      const paragraphText = this.getNodeText(paragraphNode);
      
      // Get the citation text
      const citationText = this.getNodeText(node);
      
      // Try to extract just the sentence containing the citation
      // This is a simple approach using period as sentence delimiter
      const sentences = paragraphText.split(/(?<=[.!?])\s+/);
      let sentenceWithCitation = '';
      
      for (const sentence of sentences) {
        if (sentence.includes(citationText)) {
          sentenceWithCitation = sentence.trim();
          break;
        }
      }
      
      // If we couldn't find a specific sentence, return a window of text around the citation
      if (!sentenceWithCitation) {
        const citationIndex = paragraphText.indexOf(citationText);
        if (citationIndex >= 0) {
          // Get text window of about 200 characters before and after the citation
          const startIndex = Math.max(0, citationIndex - 200);
          const endIndex = Math.min(paragraphText.length, citationIndex + citationText.length + 200);
          sentenceWithCitation = paragraphText.substring(startIndex, endIndex).trim();
        } else {
          sentenceWithCitation = paragraphText.trim();
        }
      }
      
      return sentenceWithCitation;
    } catch (error) {
      console.error('Error in getSurroundingText:', error);
      return '';
    }
  }
}