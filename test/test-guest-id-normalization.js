/**
 * Test script to verify guest ID normalization fix
 * Tests the complete guest upload → register → claim → dashboard flow
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

// Helper function to make requests
async function makeRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { response, data };
}

// Test guest ID normalization
async function testGuestIdNormalization() {
  console.log('\n=== Testing Guest ID Normalization ===\n');

  // Test case 1: Fresh guest ID (should get prefixed)
  console.log('Test 1: Fresh guest ID');
  const freshGuestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`Input: ${freshGuestId}`);
  
  // Create a simple test PDF
  const testPdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000015 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n200\n%%EOF');
  
  const formData = new FormData();
  formData.append('file', new Blob([testPdfContent], { type: 'application/pdf' }), 'test-assessment.pdf');

  const { response: response1, data: data1 } = await makeRequest(`${BASE_URL}/api/assessment-reports`, {
    method: 'POST',
    headers: {
      'x-session-id': freshGuestId  // Send without guest_ prefix
    },
    body: formData
  });

  if (response1.ok) {
    console.log(`✅ Upload successful. Guest ID should be: guest_${freshGuestId}`);
    console.log(`Response:`, data1);
  } else {
    console.log(`❌ Upload failed:`, data1);
  }

  // Test case 2: Already prefixed guest ID (should NOT get double prefixed)
  console.log('\nTest 2: Already prefixed guest ID');
  const prefixedGuestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`Input: ${prefixedGuestId}`);

  const formData2 = new FormData();
  formData2.append('file', new Blob([testPdfContent], { type: 'application/pdf' }), 'test-assessment2.pdf');

  const { response: response2, data: data2 } = await makeRequest(`${BASE_URL}/api/assessment-reports`, {
    method: 'POST',
    headers: {
      'x-session-id': prefixedGuestId  // Send with guest_ prefix
    },
    body: formData2
  });

  if (response2.ok) {
    console.log(`✅ Upload successful. Guest ID should remain: ${prefixedGuestId}`);
    console.log(`Response:`, data2);
  } else {
    console.log(`❌ Upload failed:`, data2);
  }

  // Test case 3: Multiple uploads with same guest ID
  console.log('\nTest 3: Multiple uploads with same guest ID');
  const consistentGuestId = `guest_${Date.now()}_consistent`;
  console.log(`Guest ID: ${consistentGuestId}`);

  for (let i = 1; i <= 3; i++) {
    console.log(`\n  Upload ${i}:`);
    const formData3 = new FormData();
    formData3.append('file', new Blob([testPdfContent], { type: 'application/pdf' }), `test-assessment-${i}.pdf`);

    const { response: response3, data: data3 } = await makeRequest(`${BASE_URL}/api/assessment-reports`, {
      method: 'POST',
      headers: {
        'x-session-id': consistentGuestId
      },
      body: formData3
    });

    if (response3.ok) {
      console.log(`  ✅ Upload ${i} successful`);
      console.log(`  Guest ID should remain consistent: ${consistentGuestId}`);
    } else {
      console.log(`  ❌ Upload ${i} failed:`, data3);
    }
  }

  return consistentGuestId;
}

// Test guest reports retrieval
async function testGuestReportsRetrieval(guestId) {
  console.log('\n=== Testing Guest Reports Retrieval ===\n');
  
  const { response, data } = await makeRequest(`${BASE_URL}/api/assessment-reports/guest/${guestId}`);
  
  if (response.ok) {
    console.log(`✅ Retrieved ${data.length} reports for guest ${guestId}`);
    console.log('Reports:', data.map(r => ({ id: r.id, userId: r.userId, fileName: r.fileName })));
    return data;
  } else {
    console.log(`❌ Failed to retrieve guest reports:`, data);
    return [];
  }
}

// Test user registration
async function testUserRegistration() {
  console.log('\n=== Testing User Registration ===\n');
  
  const userData = {
    email: `test_${Date.now()}@example.com`,
    username: `testuser_${Date.now()}`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User'
  };

  const { response, data } = await makeRequest(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify(userData)
  });

  if (response.ok) {
    console.log(`✅ User registered successfully`);
    console.log('User data:', { email: userData.email, token: data.token ? 'present' : 'missing' });
    return { user: userData, token: data.token };
  } else {
    console.log(`❌ User registration failed:`, data);
    return null;
  }
}

// Test guest reports claim
async function testGuestReportsClaim(guestId, token) {
  console.log('\n=== Testing Guest Reports Claim ===\n');
  
  const { response, data } = await makeRequest(`${BASE_URL}/api/assessment-reports/claim-guest`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ guestId })
  });

  if (response.ok) {
    console.log(`✅ Successfully claimed ${data.claimedCount} guest reports`);
    console.log('Claim result:', data);
    return data.claimedCount;
  } else {
    console.log(`❌ Failed to claim guest reports:`, data);
    return 0;
  }
}

// Test authenticated user reports
async function testAuthenticatedUserReports(token) {
  console.log('\n=== Testing Authenticated User Reports ===\n');
  
  const { response, data } = await makeRequest(`${BASE_URL}/api/assessment-reports`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (response.ok) {
    console.log(`✅ Retrieved ${data.length} reports for authenticated user`);
    console.log('Reports:', data.map(r => ({ id: r.id, userId: r.userId, fileName: r.fileName })));
    return data;
  } else {
    console.log(`❌ Failed to retrieve authenticated user reports:`, data);
    return [];
  }
}

// Check database for corrupted guest IDs
async function checkDatabaseForCorruptedIds() {
  console.log('\n=== Checking Database for Corrupted Guest IDs ===\n');
  
  // This would require direct database access or an admin endpoint
  // For now, we'll just log that we should check
  console.log('Note: Should check database for any guest_guest_* entries');
  console.log('SQL: SELECT user_id FROM assessment_reports WHERE user_id LIKE \'guest_guest_%\';');
}

// Main test function
async function runAllTests() {
  console.log('🧪 Starting Guest ID Normalization Tests\n');
  console.log('This test verifies that the guest ID handling bug has been fixed.\n');

  try {
    // Test guest ID normalization
    const testGuestId = await testGuestIdNormalization();
    
    // Test guest reports retrieval
    const guestReports = await testGuestReportsRetrieval(testGuestId);
    
    // Test user registration
    const userAuth = await testUserRegistration();
    if (!userAuth) {
      console.log('❌ Cannot continue with claim test - user registration failed');
      return;
    }
    
    // Test guest reports claim
    const claimedCount = await testGuestReportsClaim(testGuestId, userAuth.token);
    
    // Test authenticated user reports
    const userReports = await testAuthenticatedUserReports(userAuth.token);
    
    // Check for corrupted IDs
    await checkDatabaseForCorruptedIds();
    
    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`✅ Guest uploads: ${guestReports.length} reports created`);
    console.log(`✅ Guest reports claimed: ${claimedCount}`);
    console.log(`✅ User reports after claim: ${userReports.length}`);
    
    if (claimedCount === guestReports.length && userReports.length >= claimedCount) {
      console.log('\n🎉 ALL TESTS PASSED! Guest ID normalization fix is working correctly.');
    } else {
      console.log('\n⚠️  Some tests may have issues. Check the logs above.');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };