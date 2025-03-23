import { DocumentLoader } from './src/reference-comparison/document-loader';

const runTest = async () => {
  console.log('=== Testing Document Loader ===');
  const loader = new DocumentLoader();
  
  // Test searching by DOI
  console.log('\nTest 1: Find document by DOI');
  const doiTest = '10.1039/c8sc04228d'; // A graph-convolutional neural network model...
  const doiResult = loader.findDocuments({ 
    id: 'test-id-1',
    title: '',
    authors: [],
    year: '',
    doi: doiTest 
  });
  console.log(`Found ${doiResult.length} document(s) by DOI: ${doiTest}`);
  if (doiResult.length > 0) {
    console.log(`Title: "${doiResult[0].title}"`);
  }
  
  // Test searching by exact title
  console.log('\nTest 2: Find document by exact title');
  const exactTitle = 'A graph-convolutional neural network model for the prediction of chemical reactivity †';
  const titleResults = await loader.findMatchingDocuments(exactTitle);
  console.log(`Found ${titleResults.length} document(s) by exact title: "${exactTitle}"`);
  if (titleResults.length > 0) {
    console.log(`Title: "${titleResults[0].title}"`);
  }
  
  // Test searching by partial title
  console.log('\nTest 3: Find document by partial title');
  const partialTitle = 'graph convolutional neural network model';
  const partialResults = await loader.findMatchingDocuments(partialTitle);
  console.log(`Found ${partialResults.length} document(s) by partial title: "${partialTitle}"`);
  partialResults.forEach((doc, i) => {
    console.log(`${i+1}. "${doc.title}"`);
  });
  
  // Test searching by a reference object (simulating citation verification)
  console.log('\nTest 4: Find document by reference');
  const reference = {
    id: 'test-id-2',
    title: 'Convolutional neural network models of V1 responses to complex patterns',
    authors: ['Kindel, W.F.', 'Christensen, E.D.', 'Zylberberg, J.'],
    year: '2019',
    doi: '10.1007/s10827-018-0687-7'
  };
  const refResults = loader.findDocuments(reference);
  console.log(`Found ${refResults.length} document(s) for reference: "${reference.title}"`);
  if (refResults.length > 0) {
    console.log(`Title: "${refResults[0].title}"`);
  }
};

runTest().catch(console.error);
