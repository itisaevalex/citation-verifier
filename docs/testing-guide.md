# Citation Verification System: Testing Guide

## Prerequisites
1. GROBID service running (`http://localhost:8070`)
2. Node.js v18+ installed
3. Project dependencies installed (`npm install`)

## Core Test Cases

### 1. GROBID Service Check
```bash
node src/utils/check-grobid.js
```
**Expected Output:**  
`GROBID service is available at http://localhost:8070`

### 2. Basic PDF Processing Test
```bash
ts-node src/utils/basic-test.js samples/sample-paper.pdf
```
**Verification Steps:**
1. Check console for successful XML output
2. Verify created `output/` directory contains TEI XML file

### 3. Full Verification Workflow
```bash
ts-node src/utils/demo-verification.ts
```
**Expected Behavior:**
1. Processes sample PDF
2. Adds sample documents to database
3. Generates verification report
4. Outputs report to `samples/sample-verification-report.json`

### 4. Citation Verification Test
```bash
ts-node verify-citations.ts verify samples/sample-paper-references.json
```
**Key Metrics to Check:**
- Verification rate > 70%
- Error rate < 5%
- Proper handling of inconclusive citations

## Test Automation

### Unit Tests
```bash
npm test
```
**Key Test Files:**
- `src/tests/test-citation-parser.ts` - Citation parsing logic
- `src/tests/test-gemma3.ts` - AI verification component

### Integration Tests
```bash
ts-node src/utils/demo-verification.ts --full
```
Tests complete workflow including:
1. PDF processing
2. Reference extraction
3. Document database interaction
4. Citation verification

## Error Scenario Testing

### 1. Missing PDF Test
```bash
ts-node verify-citations.ts extract missing.pdf
```
**Expected Result:**  
Clear error message about missing file

### 2. Invalid GROBID Connection
```bash
GROBID_URL=http://localhost:9999 ts-node src/utils/basic-test.js samples/sample-paper.pdf
```
**Expected Behavior:**  
Graceful error handling with recovery suggestions

### 3. Database Corruption Test
```bash
ts-node src/utils/test-database-integrity.ts
```
Verifies database index consistency and recovery mechanisms

## Performance Benchmarks

### Reference Extraction Speed
```bash
ts-node src/utils/performance-test.ts --operation extract --file samples/sample-paper.pdf
```
**Acceptable Threshold:** < 30s for 20-page PDF

### Verification Throughput
```bash
ts-node src/utils/performance-test.ts --operation verify --file samples/sample-references-large.json
```
**Success Criteria:** 100 citations/minute minimum

## Sample Test Data
Located in `samples/` directory:
- `sample-paper.pdf` - Test document
- `sample-paper-references.json` - Pre-extracted references
- `sample-verification-report.json` - Expected output format

## Troubleshooting Checklist

| Symptom | First Check | Secondary Check |
|---------|-------------|------------------|
| GROBID connection failed | Verify GROBID service status | Check firewall settings |
| Low verification rate | Review citation matching thresholds | Validate document database contents |
| Processing timeouts | Check GROBID heap allocation | Verify PDF file integrity |
| Database errors | Run index integrity check | Verify filesystem permissions |
