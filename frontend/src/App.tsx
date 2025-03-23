import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileCheck, CheckCircle2, Loader2, Link as LinkIcon, Bot, ArrowRight, AlertTriangle, Beaker, Database, Activity } from 'lucide-react';
import { AnalysisStep, Reference, Summary } from './types';
import { uploadDocument, verifyReferences, uploadReferenceDocument, checkGrobidStatus } from './api';
import { processDocumentDirect, loadSamplePaper } from './direct-integration';

function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [extractedReferences, setExtractedReferences] = useState<Reference[]>([]);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [analysisStartTime, setAnalysisStartTime] = useState<Date | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [testingMode, setTestingMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([
    {
      id: 1,
      name: 'Document Parsing',
      status: 'pending',
      details: [
        'Analyzing document structure',
        'Extracting text content',
        'Processing document metadata'
      ],
      currentDetail: 0
    },
    {
      id: 2,
      name: 'Reference Extraction',
      status: 'pending',
      details: [
        'Identifying citation patterns',
        'Extracting reference metadata',
        'Validating reference formats'
      ],
      currentDetail: 0
    },
    {
      id: 3,
      name: 'Cross-Reference Validation',
      status: 'pending',
      details: [
        'Checking citation validity',
        'Verifying reference links',
        'Analyzing citation context'
      ],
      currentDetail: 0
    },
    {
      id: 4,
      name: 'Integrity Check',
      status: 'pending',
      details: [
        'Validating reference integrity',
        'Checking for missing citations',
        'Generating final report'
      ],
      currentDetail: 0
    }
  ]);

  const analysisRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLDivElement>(null);

  const [grobidStatus, setGrobidStatus] = useState<{ checked: boolean, running: boolean, message: string }>({
    checked: false,
    running: false,
    message: ''
  });
  const [isCheckingGrobid, setIsCheckingGrobid] = useState(false);

  const resetAnalysis = () => {
    setIsResetting(true);
    setTimeout(() => {
      setFile(null);
      setExtractedReferences([]);
      setCurrentStep(null);
      setSummary(null);
      setShowResults(false);
      setIsMinimized(false);
      setAnalysisStartTime(null);
      setIsError(false);
      setErrorMessage('');
      setAnalysisSteps(prev => prev.map((step: AnalysisStep) => ({
        ...step,
        status: 'pending',
        currentDetail: 0
      })));
      uploadRef.current?.scrollIntoView({ behavior: 'smooth' });
      setIsResetting(false);
    }, 300);
  };

  useEffect(() => {
    if (file) {
      setTimeout(() => {
        setIsMinimized(true);
        analysisRef.current?.scrollIntoView({ behavior: 'smooth' });
        startAnalysis();
      }, 500);
    }
  }, [file]);

  // Auto-load sample paper when testing mode is enabled
  useEffect(() => {
    const loadSample = async () => {
      if (testingMode && !file && !isLoading) {
        try {
          setIsLoading(true);
          console.log('Loading sample paper for testing...');
          const sampleFile = await loadSamplePaper();
          setFile(sampleFile);
          setIsLoading(false);
        } catch (error) {
          console.error('Failed to load sample paper:', error);
          setIsError(true);
          setErrorMessage('Failed to load sample paper. Check console for details.');
          setIsLoading(false);
        }
      }
    };

    loadSample();
  }, [testingMode]);

  useEffect(() => {
    if (showResults && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, [showResults]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'application/pdf' || droppedFile.type === 'application/msword')) {
      setFile(droppedFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const generateSummary = (references: Reference[]) => {
    const validRefs = references.filter(ref => ref.status === 'valid').length;
    const invalidRefs = references.filter(ref => ref.status === 'invalid').length;
    const uncertainRefs = references.filter(ref => ref.status === 'uncertain').length;
    const missingRefs = references.filter(ref => ref.status === 'missing').length;
    const completionTime = analysisStartTime ? 
      Math.round((new Date().getTime() - analysisStartTime.getTime()) / 1000) :
      0;

    const issues = [];
    if (invalidRefs > 0) {
      issues.push(`${invalidRefs} references failed validation`);
    }
    if (uncertainRefs > 0) {
      issues.push(`${uncertainRefs} references couldn't be conclusively validated`);
    }
    if (missingRefs > 0) {
      issues.push(`${missingRefs} references are missing from the database`);
    }

    return {
      totalReferences: references.length,
      validReferences: validRefs,
      invalidReferences: invalidRefs,
      uncertainReferences: uncertainRefs,
      missingReferences: missingRefs,
      completionTime: `${completionTime} seconds`,
      issues
    };
  };

  const updateStepProgress = async (stepId: number) => {
    const step = analysisSteps.find(s => s.id === stepId);
    if (!step) return;
    
    setCurrentStep(stepId);
    setAnalysisSteps(prev => prev.map((s: AnalysisStep) => 
      s.id === stepId ? { ...s, status: 'processing', currentDetail: -1 } : s
    ));

    const POINT_INTERVAL = 1500;
    // Show each detail point with a delay
    for (let i = 0; i < step.details.length; i++) {
      await new Promise(resolve => setTimeout(resolve, POINT_INTERVAL));
      setAnalysisSteps(prev => prev.map((s: AnalysisStep) =>
        s.id === stepId ? { ...s, currentDetail: i } : s
      ));
    }

    await new Promise(resolve => setTimeout(resolve, POINT_INTERVAL / 2));
    setAnalysisSteps(prev => prev.map((s: AnalysisStep) => 
      s.id === stepId ? { ...s, status: 'completed' } : s
    ));
  };

  const startAnalysis = async () => {
    if (!file) return;
    
    setExtractedReferences([]);
    setCurrentStep(null);
    setSummary(null);
    setShowResults(false);
    setAnalysisStartTime(new Date());
    setIsError(false);
    setErrorMessage('');

    try {
      // Step 1: Document Parsing & Step 2: Reference Extraction
      await updateStepProgress(1);
      await updateStepProgress(2);
      
      let extractedRefs: Reference[];
      
      if (testingMode) {
        // Use direct integration with backend code
        console.log('Using direct integration for testing mode');
        const result = await processDocumentDirect(file);
        extractedRefs = result.references;
      } else {
        // Upload document and extract references via API
        const uploadResponse = await uploadDocument(file);
        
        if (!uploadResponse.success) {
          throw new Error(uploadResponse.message || 'Failed to upload document');
        }
        
        extractedRefs = uploadResponse.data.references.map((ref: any) => ({
          id: ref.id || crypto.randomUUID(),
          title: ref.title || 'Unknown Title',
          link: ref.link || '#',
          status: 'validating'
        }));
      }
      
      setExtractedReferences(extractedRefs);
      
      // Step 3: Cross-Reference Validation
      await updateStepProgress(3);
      
      let verifiedRefs: Reference[];
      
      if (testingMode) {
        // In testing mode, references are already verified by processDocumentDirect
        verifiedRefs = extractedRefs;
      } else {
        // Verify the references via API
        const verifyResponse = await verifyReferences(extractedRefs);
        
        if (!verifyResponse.success) {
          throw new Error(verifyResponse.message || 'Failed to verify references');
        }
        
        verifiedRefs = verifyResponse.data.references.map((ref: any) => ({
          ...extractedRefs.find(r => r.id === ref.id) || {},
          status: ref.status || 'uncertain'
        }));
      }
      
      setExtractedReferences(verifiedRefs);
      
      // Step 4: Integrity Check
      await updateStepProgress(4);
      
      // Generate summary
      const summaryData = generateSummary(verifiedRefs);
      setSummary(summaryData);
      
      // Show results
      setTimeout(() => setShowResults(true), 1500);
      
    } catch (error) {
      console.error('Analysis failed:', error);
      setIsError(true);
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred');
      
      // Reset the current step
      setAnalysisSteps(prev => prev.map((s: AnalysisStep) => 
        s.status === 'processing' ? { ...s, status: 'pending', currentDetail: 0 } : s
      ));
    }
  };

  const getReferenceStatusColor = (status: string) => {
    switch (status) {
      case 'validating':
        return 'text-blue-500';
      case 'valid':
        return 'text-green-500';
      case 'invalid':
        return 'text-red-500';
      case 'uncertain':
        return 'text-yellow-500';
      case 'missing':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  const handleReferenceUpload = async (referenceId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    
    // Update reference state to show uploading
    setExtractedReferences(refs => 
      refs.map(ref => 
        ref.id === referenceId 
          ? { ...ref, uploading: true, uploadSuccess: false, uploadError: undefined } 
          : ref
      )
    );
    
    try {
      const result = await uploadReferenceDocument(file, referenceId);
      
      if (result.success) {
        // Update reference state to show success
        setExtractedReferences(refs => 
          refs.map(ref => 
            ref.id === referenceId 
              ? { 
                  ...ref, 
                  uploading: false, 
                  uploadSuccess: true, 
                  inDatabase: true,
                  status: ref.status === 'missing' ? 'valid' : ref.status // Update status if it was missing
                } 
              : ref
          )
        );
        
        // Update summary if a reference was previously missing
        if (summary && extractedReferences.find(ref => ref.id === referenceId)?.status === 'missing') {
          setSummary(prevSummary => {
            if (!prevSummary) return null;
            
            return {
              ...prevSummary,
              missingReferences: prevSummary.missingReferences - 1,
              validReferences: prevSummary.validReferences + 1,
              issues: prevSummary.issues.filter(issue => !issue.includes(`${prevSummary.missingReferences} references are missing`))
                .concat(prevSummary.missingReferences - 1 > 0 ? [`${prevSummary.missingReferences - 1} references are missing from the database`] : [])
            };
          });
        }
      } else {
        // Update reference state to show error
        setExtractedReferences(refs => 
          refs.map(ref => 
            ref.id === referenceId 
              ? { ...ref, uploading: false, uploadSuccess: false, uploadError: result.message } 
              : ref
          )
        );
      }
    } catch (error) {
      console.error('Error uploading reference document:', error);
      
      // Update reference state to show error
      setExtractedReferences(refs => 
        refs.map(ref => 
          ref.id === referenceId 
            ? { 
                ...ref, 
                uploading: false, 
                uploadSuccess: false, 
                uploadError: error instanceof Error ? error.message : 'Unknown error' 
              } 
            : ref
        )
      );
    }
  };

  // Function to check GROBID status
  const handleCheckGrobidStatus = async () => {
    setIsCheckingGrobid(true);
    try {
      const response = await checkGrobidStatus();
      if (response.success && response.data) {
        setGrobidStatus({
          checked: true,
          running: response.data.status === 'connected',
          message: response.data.message
        });
      } else {
        setGrobidStatus({
          checked: true,
          running: false,
          message: response.message || 'Failed to check GROBID status'
        });
      }
    } catch (error) {
      console.error('Error checking GROBID status:', error);
      setGrobidStatus({
        checked: true,
        running: false,
        message: error instanceof Error ? error.message : 'Unknown error checking GROBID status'
      });
    } finally {
      setIsCheckingGrobid(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper-50">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={resetAnalysis}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 bg-gradient-to-r from-ink-light to-ink rounded-lg flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-paper-50" />
            </div>
            <span className="text-lg font-semibold text-ink">TruthSource</span>
          </button>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <button
                onClick={handleCheckGrobidStatus}
                className={`
                  flex items-center text-sm px-3 py-2 rounded-lg 
                  ${isCheckingGrobid ? 'bg-gray-100 text-gray-500' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}
                  ${grobidStatus.checked && grobidStatus.running ? 'bg-green-50 text-green-700' : ''}
                  ${grobidStatus.checked && !grobidStatus.running ? 'bg-red-50 text-red-700' : ''}
                  transition-colors
                `}
                disabled={isCheckingGrobid}
              >
                {isCheckingGrobid ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4 mr-1.5" />
                    {grobidStatus.checked 
                      ? (grobidStatus.running ? 'GROBID Connected' : 'GROBID Disconnected') 
                      : 'GROBID Status'}
                  </>
                )}
              </button>
            </div>
            <button 
              className={`
                flex items-center text-sm px-3 py-2 rounded-lg 
                ${testingMode ? 'bg-purple-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}
              `}
              onClick={() => setTestingMode(!testingMode)}
            >
              <Beaker className="h-4 w-4 mr-1.5" />
              {testingMode ? 'Testing: On' : 'Testing: Off'}
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-3xl mx-auto">
          <div 
            ref={uploadRef}
            className={
              `upload-section transition-all duration-500 w-full
                ${isMinimized ? 'minimized' : 'min-h-[80vh]'}
                flex items-center justify-center
                ${isResetting ? 'page-reset page-reset-exit' : ''}
              `
            }
          >
            <div className="w-full">
              {!file ? (
                <>
                  <div className="text-center mb-8">
                    <h1 className="text-4xl font-semibold text-ink mb-3">
                    Don't trust, verify
                    </h1>
                    <p className="text-lg text-ink-light">
                      Upload your document to verify citations and references
                    </p>
                  </div>

                  <div
                    className={`
                      w-full bg-white/80 backdrop-blur-sm rounded-xl border-2 border-dashed transition-all duration-300 
                      ${isDragging ? 'border-ink-light bg-paper-100/50' : 'border-paper-200'}
                    `}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="p-8">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-paper-100 flex items-center justify-center">
                          <Upload className="w-6 h-6 text-ink-light" />
                        </div>
                        
                        <div className="text-center">
                          <p className="text-ink font-medium mb-1">
                            Drop your document here
                          </p>
                          <p className="text-sm text-ink-light">
                            Supported formats: PDF, DOC, DOCX
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx"
                              onChange={handleFileInput}
                            />
                            <span className="inline-flex items-center px-4 py-2 bg-paper-100 hover:bg-paper-200 text-ink text-sm font-medium rounded-lg transition-colors duration-200">
                              Choose File
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3 mb-4 w-full justify-start mt-4">
                  <Bot className="w-8 h-8 text-ink-light" />
                  <div>
                    <h2 className="text-lg font-semibold text-ink">Reference Analysis Assistant</h2>
                    <p className="text-sm text-ink-light">Analyzing your document...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div ref={analysisRef} className="w-full">
            {file && (
              <div className={`bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-6 mb-4 fade-in ${isResetting ? 'page-reset page-reset-exit' : ''}`}>
                <div className="analysis-container">
                  <div className="space-y-2">
                    {analysisSteps.map((step) => (
                      <div 
                        key={step.id}
                        className={`chat-message opacity-0 ${step.id <= (currentStep || 0) ? 'show' : ''}`}
                      >
                        <div className="bg-paper-50 rounded-lg p-4 relative group border border-paper-100">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`status-icon ${step.status}`}>
                              {step.status === 'processing' ? (
                                <Loader2 className="w-4 h-4 text-ink-light animate-spin" />
                              ) : step.status === 'completed' ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-paper-300" />
                              )}
                            </div>
                            <span className="font-medium text-ink">{step.name}</span>
                          </div>

                          {step.status === 'processing' && (
                            <div className="pl-6">
                              <div className="step-details">
                                {step.details.map((detail, index) => (
                                  <div
                                    key={index}
                                    className={`text-sm text-ink-light analysis-point ${
                                      index <= step.currentDetail ? 'show' : ''
                                    }`}
                                  >
                                    • {detail}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {step.status === 'completed' && (
                            <div className="pl-6">
                              <div className="step-details">
                                <div className="text-sm text-ink-light completed-point">
                                  • Task completed successfully
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {isError && (
                      <div className="chat-message opacity-0 show">
                        <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <span className="font-medium text-red-800">Analysis Error</span>
                          </div>
                          <p className="text-sm text-red-700 pl-6">{errorMessage || 'An error occurred during analysis. Please try again.'}</p>
                        </div>
                      </div>
                    )}

                    {summary && !showResults && (
                      <div className="chat-message opacity-0 show">
                        <div className="bg-ink/5 rounded-lg p-4 flex items-center justify-between">
                          <span className="text-ink font-medium">Analysis Complete</span>
                          <ArrowRight className="w-5 h-5 text-ink animate-pulse" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div 
            ref={resultsRef}
            className={`w-full transition-all duration-500 transform ${
              showResults ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            } ${isResetting ? 'page-reset page-reset-exit' : ''}`}
          >
            {summary && (
              <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-2 mb-6 border-b border-paper-100 pb-4">
                  <FileCheck className="w-6 h-6 text-ink-light" />
                  <h2 className="text-lg font-semibold text-ink">Analysis Results</h2>
                </div>

                <div className="space-y-6">
                  <div className="bg-paper-50 rounded-lg p-4 border border-paper-100">
                    <h3 className="font-medium text-ink mb-3">Summary</h3>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="results-grid-item text-center">
                        <div className="text-2xl font-bold text-ink">{summary.totalReferences}</div>
                        <div className="text-sm text-ink-light">Total References</div>
                      </div>
                      <div className="results-grid-item text-center">
                        <div className="text-2xl font-bold text-green-500">{summary.validReferences}</div>
                        <div className="text-sm text-ink-light">Valid Citations</div>
                      </div>
                      <div className="results-grid-item text-center">
                        <div className="text-2xl font-bold text-yellow-500">{summary.uncertainReferences}</div>
                        <div className="text-sm text-ink-light">Uncertain Citations</div>
                      </div>
                      <div className="results-grid-item text-center">
                        <div className="text-2xl font-bold text-red-500">{summary.invalidReferences}</div>
                        <div className="text-sm text-ink-light">Invalid Citations</div>
                      </div>
                      <div className="results-grid-item text-center">
                        <div className="text-2xl font-bold text-gray-500">{summary.missingReferences}</div>
                        <div className="text-sm text-ink-light">Missing Citations</div>
                      </div>
                    </div>
                    <div className="text-sm text-ink-light">
                      Analysis completed in <span className="font-medium">{summary.completionTime}</span>
                    </div>
                  </div>

                  {summary.issues.length > 0 && (
                    <div className="bg-red-50/50 rounded-lg p-4 border border-red-100">
                      <h3 className="font-medium text-red-900 mb-2">Issues Found</h3>
                      <ul className="space-y-2">
                        {summary.issues.map((issue, index) => (
                          <li 
                            key={index}
                            className="issues-list-item text-sm text-red-700 flex items-center gap-2"
                          >
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h3 className="font-medium text-ink mb-3">References</h3>
                    <div className="space-y-3">
                      {extractedReferences.map((reference) => (
                        <div 
                          key={reference.id}
                          className="reference-item bg-paper-50 rounded-lg p-4 hover:shadow-md transition-all duration-200 border border-paper-100"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-ink">{reference.title}</h4>
                              <div className="flex items-center mt-1 text-sm text-ink-light">
                                <LinkIcon className="w-4 h-4 mr-1 flex-shrink-0" />
                                <a 
                                  href={reference.link} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="hover:text-ink truncate"
                                >
                                  {reference.link}
                                </a>
                              </div>
                              {reference.status === 'missing' && (
                                <div className="mt-3 flex items-center">
                                  <div className="text-sm text-gray-700 italic">
                                    This paper is missing from the database
                                  </div>
                                  <label className="ml-3 cursor-pointer inline-flex items-center justify-center px-3 py-1 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors">
                                    <Database className="mr-1 w-3 h-3" />
                                    Upload Paper
                                    <input
                                      type="file"
                                      accept="application/pdf"
                                      onChange={(e) => handleReferenceUpload(reference.id, e)}
                                      className="hidden"
                                    />
                                  </label>
                                </div>
                              )}
                              {reference.uploading && (
                                <div className="mt-2 text-sm text-blue-500 flex items-center">
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  Uploading paper to database...
                                </div>
                              )}
                              {reference.uploadSuccess && (
                                <div className="mt-2 text-sm text-green-600 flex items-center">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Successfully added to database
                                </div>
                              )}
                              {reference.uploadError && (
                                <div className="mt-2 text-sm text-red-600 flex items-center">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Error: {reference.uploadError}
                                </div>
                              )}
                            </div>
                            <div className={`ml-4 ${getReferenceStatusColor(reference.status)}`}>
                              {reference.status === 'validating' && <Loader2 className="w-5 h-5 animate-spin" />}
                              {reference.status === 'valid' && <CheckCircle2 className="w-5 h-5" />}
                              {reference.status === 'invalid' && <div className="w-5 h-5 rounded-full border-2 border-red-500 flex items-center justify-center">!</div>}
                              {reference.status === 'uncertain' && <AlertTriangle className="w-5 h-5" />}
                              {reference.status === 'missing' && <div className="w-5 h-5 rounded-full border-2 border-gray-500 flex items-center justify-center">?</div>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;