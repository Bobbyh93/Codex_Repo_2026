import { parseATIReport } from './ati-parser';
import fs from 'fs/promises';
import path from 'path';

async function testPDFHandling() {
  console.log('🧪 Testing PDF Handling...\n');
  
  const testCases = [
    {
      name: 'Empty string',
      input: '',
      shouldFail: false
    },
    {
      name: 'Invalid PDF content',
      input: 'This is not a PDF',
      shouldFail: false
    },
    {
      name: 'Null input',
      input: null as any,
      shouldFail: false
    },
    {
      name: 'Malformed ATI report',
      input: 'ATI Assessment\nStudent: John\nScore: not-a-number',
      shouldFail: false
    },
    {
      name: 'Valid-looking ATI content',
      input: `ATI Comprehensive Predictor
Student: Jane Doe
School: Test University
Date: January 1, 2024

Topics to Review:
Management of Care - 8 items
  - Assignment, Delegation and Supervision - 1 item
  - Legal Rights and Responsibilities - 2 items
  
Overall Score: 75%`,
      shouldFail: false
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    try {
      const result = parseATIReport(testCase.input);
      
      // Should always return something, even if empty
      if (result && typeof result === 'object') {
        console.log(`✅ ${testCase.name}: Handled gracefully`);
        passed++;
      } else {
        console.log(`❌ ${testCase.name}: Returned invalid result`);
        failed++;
      }
    } catch (error: any) {
      if (testCase.shouldFail) {
        console.log(`✅ ${testCase.name}: Failed as expected`);
        passed++;
      } else {
        console.log(`❌ ${testCase.name}: Unexpected error - ${error.message}`);
        failed++;
      }
    }
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testPDFHandling().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { testPDFHandling };