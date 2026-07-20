// Test Knowledge Base upload functionality with CSRF token
// Run with: node test/test-kb-upload.js

const fs = require('fs');
const FormData = require('form-data');

async function testKnowledgeBaseUpload() {
  const baseUrl = 'http://localhost:5000';
  
  console.log('Testing Knowledge Base upload with CSRF token fix...\n');
  
  try {
    // Step 1: Login to get session and CSRF token
    console.log('1. Logging in as admin...');
    const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    const csrfToken = loginData.csrfToken;
    const cookies = loginResponse.headers.get('set-cookie');
    
    console.log('✓ Login successful');
    console.log('✓ CSRF Token received:', csrfToken ? 'Yes' : 'No');
    
    // Step 2: Prepare test file
    console.log('\n2. Preparing test file...');
    const testFilePath = 'test/knowledge-base-test.txt';
    if (!fs.existsSync(testFilePath)) {
      fs.writeFileSync(testFilePath, 'Test content for Knowledge Base upload');
    }
    
    // Step 3: Upload file with CSRF token
    console.log('\n3. Uploading file to Knowledge Base...');
    const form = new FormData();
    form.append('document', fs.createReadStream(testFilePath));
    
    const uploadResponse = await fetch(`${baseUrl}/api/admin/knowledge-base/upload`, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': csrfToken,
        'Cookie': cookies || ''
      },
      credentials: 'include',
      body: form
    });
    
    const uploadResponseText = await uploadResponse.text();
    
    if (!uploadResponse.ok) {
      console.error('✗ Upload failed:', uploadResponse.status);
      console.error('Response:', uploadResponseText);
      
      // Check if it's specifically a CSRF token error
      if (uploadResponseText.includes('CSRF') || uploadResponseText.includes('csrf')) {
        console.error('\n❌ CSRF TOKEN ISSUE DETECTED!');
        console.error('The upload is still failing with CSRF token errors.');
        return false;
      }
    } else {
      console.log('✓ Upload successful!');
      const uploadData = JSON.parse(uploadResponseText);
      console.log('Job ID:', uploadData.jobId);
      console.log('Document ID:', uploadData.documentId);
      console.log('\n✅ CSRF TOKEN FIX VERIFIED - Upload works correctly!');
      return true;
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    return false;
  }
}

// Run the test
testKnowledgeBaseUpload().then(success => {
  console.log('\n' + '='.repeat(60));
  if (success) {
    console.log('✅ TEST PASSED: Knowledge Base upload with CSRF token works!');
  } else {
    console.log('❌ TEST FAILED: Knowledge Base upload still has issues');
  }
  console.log('='.repeat(60));
  process.exit(success ? 0 : 1);
});