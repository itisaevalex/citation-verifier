import * as xpath from 'xpath';
import { DOMParser } from '@xmldom/xmldom';

// Types for document nodes
type Node = any;
type Document = any;

/**
 * Class for parsing TEI XML documents and extracting document metadata and content
 */
export class DocumentParser {
  private doc: Document;
  private namespaces: { [key: string]: string };

  /**
   * Constructor
   * @param teiXml The TEI XML string to parse
   */
  constructor(teiXml: string) {
    // Parse the XML string into a DOM document
    const parser = new DOMParser();
    
    // We'll handle errors manually by logging them to console
    this.doc = parser.parseFromString(teiXml, 'application/xml');
    
    // Define the TEI namespace for XPath queries
    this.namespaces = {
      tei: 'http://www.tei-c.org/ns/1.0'
    };
  }

  /**
   * Extract document title from the TEI XML
   * @returns The document title as a string
   */
  extractTitle(): string {
    try {
      // Try to get the title from the titleStmt
      let title = this.getTextContent(this.doc, '//tei:teiHeader//tei:titleStmt/tei:title');
      
      // If no title found, try alternative locations
      if (!title) {
        title = this.getTextContent(this.doc, '//tei:teiHeader//tei:sourceDesc//tei:title');
      }
      
      // If still no title found, use a generic placeholder
      return title || 'Untitled Document';
    } catch (error) {
      console.error('Error extracting document title:', error);
      return 'Untitled Document';
    }
  }

  /**
   * Extract authors from the TEI header
   * @returns Array of document authors
   */
  extractAuthors(): Array<{firstName?: string, middleName?: string, lastName?: string, rawName?: string}> {
    const authors: Array<{firstName?: string, middleName?: string, lastName?: string, rawName?: string}> = [];
    
    try {
      // Get all author nodes from the TEI header
      const authorNodes = this.select('//tei:teiHeader//tei:titleStmt//tei:author', this.doc);
      
      if (!authorNodes || !Array.isArray(authorNodes) || authorNodes.length === 0) {
        // Try alternative location in the TEI
        const altAuthorNodes = this.select('//tei:teiHeader//tei:sourceDesc//tei:biblStruct//tei:author', this.doc);
        if (!altAuthorNodes || !Array.isArray(altAuthorNodes) || altAuthorNodes.length === 0) {
          return authors;
        }
        
        // Process alternative author nodes
        for (const authorNode of altAuthorNodes) {
          const author = this.extractAuthorFromNode(authorNode);
          if (author) {
            authors.push(author);
          }
        }
        
        return authors;
      }
      
      // Process each author node
      for (const authorNode of authorNodes) {
        const author = this.extractAuthorFromNode(authorNode);
        if (author) {
          authors.push(author);
        }
      }
    } catch (error) {
      console.error('Error in extractAuthors:', error);
    }
    
    return authors;
  }

  /**
   * Extract document publication year from the TEI XML
   * @returns The publication year as a string
   */
  extractPublicationYear(): string {
    try {
      // Try to get the publication date from different potential locations
      let date = this.getTextContent(this.doc, '//tei:teiHeader//tei:publicationStmt/tei:date');
      
      if (!date) {
        date = this.getTextContent(this.doc, '//tei:teiHeader//tei:sourceDesc//tei:date');
      }
      
      if (!date) {
        date = this.getTextContent(this.doc, '//tei:teiHeader//tei:sourceDesc//tei:biblStruct//tei:date');
      }
      
      // Extract year from date string if it's in a complex format
      if (date) {
        // Match four-digit numbers (likely years)
        const yearMatch = date.match(/\b\d{4}\b/);
        if (yearMatch) {
          return yearMatch[0];
        }
        
        return date;
      }
      
      return '';
    } catch (error) {
      console.error('Error extracting publication year:', error);
      return '';
    }
  }

  /**
   * Extract journal or publication information
   * @returns The journal or venue name
   */
  extractJournal(): string {
    try {
      let journal = this.getTextContent(this.doc, '//tei:teiHeader//tei:sourceDesc//tei:biblStruct//tei:monogr//tei:title[@level="j"]');
      
      if (!journal) {
        journal = this.getTextContent(this.doc, '//tei:teiHeader//tei:sourceDesc//tei:biblStruct//tei:monogr//tei:title');
      }
      
      return journal || '';
    } catch (error) {
      console.error('Error extracting journal:', error);
      return '';
    }
  }

  /**
   * Extract DOI from the TEI XML
   * @returns The DOI as a string
   */
  extractDOI(): string {
    try {
      // Try to extract DOI from idno element with @type="DOI"
      let doi = this.getTextContent(this.doc, '//tei:teiHeader//tei:sourceDesc//tei:biblStruct//tei:idno[@type="DOI"]');
      
      if (!doi) {
        // Try to get from any other idno element
        const idnoEl = this.select('//tei:teiHeader//tei:sourceDesc//tei:biblStruct//tei:idno', this.doc);
        if (idnoEl && Array.isArray(idnoEl) && idnoEl.length > 0) {
          doi = this.getNodeText(idnoEl[0]);
        }
      }
      
      return doi || '';
    } catch (error) {
      console.error('Error extracting DOI:', error);
      return '';
    }
  }

  /**
   * Extract the full text content from the document
   * @returns The full text as a string
   */
  extractFullText(): string {
    let fullText = '';
    
    try {
      // Get all paragraph nodes from the body
      const paragraphNodes = this.select('//tei:body//tei:p', this.doc);
      
      if (!paragraphNodes || !Array.isArray(paragraphNodes) || paragraphNodes.length === 0) {
        // If no paragraphs found, try to get all text from the body
        return this.getTextContent(this.doc, '//tei:body') || '';
      }
      
      // Combine all paragraph texts
      for (const parNode of paragraphNodes) {
        const parText = this.getNodeText(parNode);
        if (parText && parText.trim()) {
          fullText += parText + ' ';
        }
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('Error extracting full text:', error);
      return '';
    }
  }

  /**
   * Extract author information from a single author node
   * @param authorNode The author node to process
   * @returns Author information object
   */
  private extractAuthorFromNode(authorNode: Node): {firstName?: string, middleName?: string, lastName?: string, rawName?: string} | null {
    try {
      const persNameNodes = this.select('./tei:persName', authorNode);
      
      if (persNameNodes && Array.isArray(persNameNodes) && persNameNodes.length > 0) {
        const persNameNode = persNameNodes[0];
        
        if (persNameNode) {
          // Extract structured name parts
          const forename = this.getTextContent(persNameNode, './tei:forename[@type="first"]');
          const middlename = this.getTextContent(persNameNode, './tei:forename[@type="middle"]');
          const surname = this.getTextContent(persNameNode, './tei:surname');
          
          // Full name as fallback
          const fullName = this.getNodeText(persNameNode);
          
          return {
            firstName: forename || undefined,
            middleName: middlename || undefined,
            lastName: surname || undefined,
            rawName: fullName || undefined,
          };
        }
      }
      
      // Use author string as fallback
      const authorString = this.getNodeText(authorNode);
      if (authorString) {
        return {
          rawName: authorString,
        };
      }
    } catch (error) {
      console.error('Error extracting author from node:', error);
    }
    
    return null;
  }

  /**
   * XPath utility functions
   */
  private select(xpathQuery: string, context: Node): Node[] {
    // Create a namespace resolver function for the XPath evaluator
    const select = xpath.useNamespaces(this.namespaces);
    
    // Execute the XPath query and ensure it returns an array
    const result = select(xpathQuery, context);
    
    // If the result is not an array, make it one
    return Array.isArray(result) ? result : (result ? [result] : []);
  }

  private getTextContent(context: Node, xpathQuery: string): string {
    const nodes = this.select(xpathQuery, context);
    
    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return '';
    }
    
    return this.getNodeText(nodes[0]);
  }

  private getNodeText(node: Node): string {
    // Recursively get all text content from a node and its children
    const getTextRecursive = (n: Node): string => {
      let text = '';
      
      // If this is a text node, add its value
      if (n.nodeType === 3) {
        text += n.nodeValue || '';
      }
      
      // Process child nodes
      if (n.childNodes) {
        for (let i = 0; i < n.childNodes.length; i++) {
          text += getTextRecursive(n.childNodes[i]);
        }
      }
      
      return text;
    };
    
    return getTextRecursive(node).trim();
  }

  private getAttributeValue(node: Node, attributeName: string): string | null {
    if (attributeName.startsWith('@')) {
      attributeName = attributeName.substring(1);
    }
    
    // Try to get the attribute directly
    if (node.attributes) {
      const attr = node.attributes.getNamedItem(attributeName);
      return attr ? attr.value : null;
    }
    
    return null;
  }
}
