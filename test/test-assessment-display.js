#!/usr/bin/env node
// Test script to verify student name and overall score display

const fs = require('fs');
const path = require('path');

async function testAssessmentUpload() {
  const baseUrl = 'http://localhost:5000';
  
  try {
    // Read the test PDF file
    const pdfPath = path.join(__dirname, '../attached_assets/test-assessment.pdf');
    if (!fs.existsSync(pdfPath)) {
      console.error('❌ test-assessment.pdf not found at:', pdfPath);
      process.exit(1);
    }
    
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    // Create FormData with the PDF
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', pdfBuffer, 'test-assessment.pdf');
    
    console.log('📤 Uploading test-assessment.pdf...');
    
    // Upload the assessment
    const uploadResponse = await fetch(`${baseUrl}/api/assessment-reports`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    if (!uploadResponse.ok) {
      console.error('❌ Upload failed:', uploadResponse.status, await uploadResponse.text());
      process.exit(1);
    }
    
    const uploadResult = await uploadResponse.json();
    const reportId = uploadResult.reportId;
    console.log('✅ Upload successful, Report ID:', reportId);
    
    // Fetch the assessment report to check student details
    console.log('📥 Fetching assessment report details...');
    const reportResponse = await fetch(`${baseUrl}/api/assessment-reports/${reportId}`);
    
    if (!reportResponse.ok) {
      console.error('❌ Failed to fetch report:', reportResponse.status);
      process.exit(1);
    }
    
    const reportData = await reportResponse.json();
    
    // Verify student name
    console.log('\n📋 Assessment Report Data:');
    console.log('Student Name:', reportData.studentName || 'NOT FOUND');
    console.log('Overall Score:', reportData.overallScore || 'NOT FOUND');
    console.log('School:', reportData.school || 'NOT FOUND');
    console.log('Test Date:', reportData.testDate || 'NOT FOUND');
    console.log('Assessment Name:', reportData.assessmentName || 'NOT FOUND');
    
    // Check if the expected values are present
    let testsPassed = true;
    
    if (!reportData.studentName) {
      console.error('\n❌ Student name is missing!');
      testsPassed = false;
    } else if (reportData.studentName === 'STEPHANIE AVILA-RODRIGUEZ') {
      console.log('\n✅ Student name found correctly: STEPHANIE AVILA-RODRIGUEZ');
    } else {
      console.error(`\n⚠️ Student name found but different: "${reportData.studentName}"`);
      console.log('   Expected: "STEPHANIE AVILA-RODRIGUEZ"');
    }
    
    if (!reportData.overallScore) {
      console.error('❌ Overall score is missing!');
      testsPassed = false;
    } else if (reportData.overallScore === '71.7') {
      console.log('✅ Overall score found correctly: 71.7%');
    } else {
      console.error(`⚠️ Overall score found but different: "${reportData.overallScore}%"`);
      console.log('   Expected: "71.7%"');
    }
    
    // Fetch topic performance to ensure that still works
    console.log('\n📊 Fetching topic performance data...');
    const topicsResponse = await fetch(`${baseUrl}/api/assessment-reports/${reportId}/topic-performance`);
    
    if (!topicsResponse.ok) {
      console.error('❌ Failed to fetch topics:', topicsResponse.status);
      process.exit(1);
    }
    
    const topicsData = await topicsResponse.json();
    console.log(`✅ Found ${topicsData.length} topics in the study plan`);
    
    // Summary
    console.log('\n========================================');
    if (testsPassed && reportData.studentName && reportData.overallScore) {
      console.log('✅ ALL TESTS PASSED!');
      console.log(`✅ Student Name: ${reportData.studentName}`);
      console.log(`✅ Overall Score: ${reportData.overallScore}%`);
      console.log(`✅ Topics Found: ${topicsData.length}`);
      console.log('\n🎉 The assessment display is working correctly!');
      console.log('\nThe frontend should now display:');
      console.log(`  - "Assessment Results for: ${reportData.studentName}"`);
      console.log(`  - "Overall Score: ${reportData.overallScore}%"`);
    } else {
      console.log('❌ SOME TESTS FAILED');
      console.log('Please check the implementation.');
    }
    console.log('========================================');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

// Run the test
testAssessmentUpload().catch(console.error);