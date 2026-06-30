import { test, expect } from '@playwright/test';
import { FileUploadHelpers } from './utils/test-helpers';
import { TEST_FILES, SELECTORS, ERROR_MESSAGES, TIMEOUTS, generateTestData } from './test-data/fixtures';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * PDF Upload and Progress Tracking E2E Tests
 * 
 * Tests PDF upload functionality including:
 * - Upload progress tracking with multi-stage indicators
 * - File validation (type, size, format)
 * - Upload cancellation
 * - Results display with topic summaries
 * - Error handling for various failure scenarios
 */

test.describe('PDF Upload and Progress Tracking', () => {
  let uploadHelpers: FileUploadHelpers;

  test.beforeEach(async ({ page }) => {
    uploadHelpers = new FileUploadHelpers(page);
    uploadHelpers.setupConsoleLogging();
    
    // Create test PDF file if not exists
    await createTestPDFs();
  });

  test.afterEach(async () => {
    await uploadHelpers.clearMocks();
  });

  test.describe('File Upload Flow', () => {
    test('should upload PDF with multi-stage progress tracking', async () => {
      await uploadHelpers.navigateTo('/');
      
      // Mock successful upload with progress stages
      let uploadStage = 'validating';
      await uploadHelpers.page.route('/api/assessment-reports', async route => {
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        // Simulate different stages with delays
        if (uploadStage === 'validating') {
          await delay(500);
          uploadStage = 'uploading';
          route.fulfill({
            status: 202,
            contentType: 'application/json',
            body: JSON.stringify({
              stage: 'validating',
              progress: 10,
              message: 'Validating file...'
            })
          });
        } else if (uploadStage === 'uploading') {
          await delay(1000);
          uploadStage = 'processing';
          route.fulfill({
            status: 202,
            contentType: 'application/json',
            body: JSON.stringify({
              stage: 'uploading',
              progress: 50,
              message: 'Uploading PDF...'
            })
          });
        } else if (uploadStage === 'processing') {
          await delay(1500);
          uploadStage = 'complete';
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              stage: 'complete',
              progress: 100,
              message: 'Processing complete',
              reportId: 'test-report-123',
              topics: [
                { name: 'Cardiovascular', score: 75, priority: 'high' },
                { name: 'Respiratory', score: 85, priority: 'medium' }
              ]
            })
          });
        }
      });

      // Upload file
      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await uploadHelpers.uploadWithDragDrop(testPdfPath);

      // Verify progress stages
      await expect(uploadHelpers.page.locator('[data-testid="upload-stage-validating"]')).toBeVisible();
      await expect(uploadHelpers.page.locator('[data-testid="upload-stage-uploading"]')).toBeVisible();
      await expect(uploadHelpers.page.locator('[data-testid="upload-stage-processing"]')).toBeVisible();

      // Monitor progress bar updates
      const progressValues = await uploadHelpers.monitorUploadProgress();
      expect(progressValues.length).toBeGreaterThan(1);
      expect(progressValues[progressValues.length - 1]).toBe(100);

      // Verify completion
      await expect(uploadHelpers.page.locator(SELECTORS.UPLOAD_SUCCESS_MESSAGE)).toBeVisible();
    });

    test('should show upload progress with time estimation', async () => {
      await uploadHelpers.navigateTo('/');

      // Mock slow upload with time estimates
      await uploadHelpers.page.route('/api/assessment-reports', route => {
        route.fulfill({
          status: 202,
          body: JSON.stringify({
            stage: 'uploading',
            progress: 30,
            message: 'Uploading PDF...',
            estimatedTime: '45s remaining'
          })
        });
      });

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await uploadHelpers.uploadWithDragDrop(testPdfPath);

      // Verify time estimation display
      const timeEstimate = uploadHelpers.page.locator('[data-testid="upload-time-estimate"]');
      await expect(timeEstimate).toBeVisible();
      await expect(timeEstimate).toContainText('45s remaining');
    });

    test('should display file size and upload speed', async () => {
      await uploadHelpers.navigateTo('/');

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await uploadHelpers.uploadWithDragDrop(testPdfPath);

      // Verify file size display
      const fileSizeDisplay = uploadHelpers.page.locator('[data-testid="upload-file-size"]');
      await expect(fileSizeDisplay).toBeVisible();
      
      // Verify upload speed display during upload
      const uploadSpeedDisplay = uploadHelpers.page.locator('[data-testid="upload-speed"]');
      await expect(uploadSpeedDisplay).toBeVisible();
    });

    test('should handle drag and drop upload', async () => {
      await uploadHelpers.navigateTo('/');

      const dropzone = uploadHelpers.page.locator(SELECTORS.FILE_UPLOAD_DROPZONE);
      
      // Verify dropzone is visible and ready
      await expect(dropzone).toBeVisible();
      await expect(dropzone).toContainText('Drop your PDF here');

      // Test hover state
      await dropzone.hover();
      await expect(dropzone).toHaveClass(/drag-over/);
    });

    test('should handle file input upload', async () => {
      await uploadHelpers.navigateTo('/');

      const fileInput = uploadHelpers.page.locator(SELECTORS.FILE_UPLOAD_INPUT);
      
      // Verify file input is accessible
      await expect(fileInput).toBeAttached();

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await fileInput.setInputFiles(testPdfPath);

      // Verify file is selected
      const fileName = uploadHelpers.page.locator('[data-testid="selected-file-name"]');
      await expect(fileName).toContainText('test-assessment.pdf');
    });
  });

  test.describe('File Validation', () => {
    test('should reject non-PDF files', async () => {
      await uploadHelpers.navigateTo('/');

      // Create a fake text file
      const textFilePath = path.join(process.cwd(), 'e2e/test-data/invalid-file.txt');
      await fs.writeFile(textFilePath, 'This is not a PDF file');

      await uploadHelpers.uploadWithDragDrop(textFilePath);

      // Verify error message
      const errorMessage = uploadHelpers.page.locator(SELECTORS.UPLOAD_ERROR_MESSAGE);
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Please upload a PDF file');

      // Clean up
      await fs.unlink(textFilePath).catch(() => {});
    });

    test('should validate file size limits', async () => {
      await uploadHelpers.navigateTo('/');

      // Mock large file upload
      await uploadHelpers.page.route('/api/assessment-reports', route => {
        route.fulfill({
          status: 413,
          body: JSON.stringify({
            error: 'File size exceeds maximum limit of 10MB'
          })
        });
      });

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await uploadHelpers.uploadWithDragDrop(testPdfPath);

      // Verify size limit error
      const errorMessage = uploadHelpers.page.locator(SELECTORS.UPLOAD_ERROR_MESSAGE);
      await expect(errorMessage).toContainText('File size exceeds maximum limit');
    });

    test('should validate PDF file structure', async () => {
      await uploadHelpers.navigateTo('/');

      // Create invalid PDF file (wrong magic bytes)
      const invalidPdfPath = path.join(process.cwd(), 'e2e/test-data/invalid.pdf');
      await fs.writeFile(invalidPdfPath, 'Not a real PDF content');

      await uploadHelpers.uploadWithDragDrop(invalidPdfPath);

      // Verify validation error
      const errorMessage = uploadHelpers.page.locator(SELECTORS.UPLOAD_ERROR_MESSAGE);
      await expect(errorMessage).toContainText('Invalid PDF file format');

      // Clean up
      await fs.unlink(invalidPdfPath).catch(() => {});
    });

    test('should handle corrupted PDF files', async () => {
      await uploadHelpers.navigateTo('/');

      // Mock corrupted file response
      await uploadHelpers.page.route('/api/assessment-reports', route => {
        route.fulfill({
          status: 422,
          body: JSON.stringify({
            error: 'PDF file appears to be corrupted or unreadable'
          })
        });
      });

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await uploadHelpers.uploadWithDragDrop(testPdfPath);

      const errorMessage = uploadHelpers.page.locator(SELECTORS.UPLOAD_ERROR_MESSAGE);
      await expect(errorMessage).toContainText('corrupted or unreadable');
    });

    test('should validate password-protected PDFs', async () => {
      await uploadHelpers.navigateTo('/');

      await uploadHelpers.page.route('/api/assessment-reports', route => {
        route.fulfill({
          status: 422,
          body: JSON.stringify({
            error: 'Password-protected PDFs are not supported'
          })
        });
      });

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await uploadHelpers.uploadWithDragDrop(testPdfPath);

      const errorMessage = uploadHelpers.page.locator(SELECTORS.UPLOAD_ERROR_MESSAGE);
      await expect(errorMessage).toContainText('Password-protected PDFs are not supported');
    });
  });

  test.describe('Upload Cancellation', () => {
    test('should allow cancelling upload in progress', async () => {
      await uploadHelpers.navigateTo('/');

      // Mock slow upload
      await uploadHelpers.page.route('/api/assessment-reports', async route => {
        // Keep the request hanging to simulate slow upload
        await new Promise(resolve => setTimeout(resolve, 5000));
        route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true })
        });
      });

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await uploadHelpers.uploadWithDragDrop(testPdfPath);

      // Wait for upload to start
      await uploadHelpers.waitForVisible(SELECTORS.UPLOAD_PROGRESS_BAR);

      // Cancel upload
      await uploadHelpers.cancelUpload();

      // Verify upload was cancelled
      await expect(uploadHelpers.page.locator('[data-testid="upload-cancelled-message"]')).toBeVisible();
      await expect(uploadHelpers.page.locator(SELECTORS.UPLOAD_PROGRESS_BAR)).toBeHidden();
    });

    test('should reset form after cancellation', async () => {
      await uploadHelpers.navigateTo('/');

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await uploadHelpers.uploadWithDragDrop(testPdfPath);
      await uploadHelpers.cancelUpload();

      // Form should reset to initial state
      const dropzone = uploadHelpers.page.locator(SELECTORS.FILE_UPLOAD_DROPZONE);
      await expect(dropzone).toContainText('Drop your PDF here');
      
      const fileInput = uploadHelpers.page.locator(SELECTORS.FILE_UPLOAD_INPUT);
      await expect(fileInput).toHaveValue('');
    });

    test('should not allow cancelling completed upload', async () => {
      await uploadHelpers.navigateTo('/');

      // Mock quick successful upload
      await uploadHelpers.page.route('/api/assessment-reports', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            reportId: 'test-123',
            message: 'Upload successful'
          })
        });
      });

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await uploadHelpers.uploadWithDragDrop(testPdfPath);

      // Wait for completion
      await uploadHelpers.waitForVisible(SELECTORS.UPLOAD_SUCCESS_MESSAGE);

      // Cancel button should be hidden
      const cancelButton = uploadHelpers.page.locator(SELECTORS.UPLOAD_CANCEL_BUTTON);
      await expect(cancelButton).toBeHidden();
    });
  });

  test.describe('Results Display', () => {
    test('should display upload results with topic summaries', async () => {
      await uploadHelpers.navigateTo('/');

      // Mock successful upload with detailed results
      await uploadHelpers.page.route('/api/assessment-reports', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            reportId: 'test-report-123',
            studentName: 'Test Student',
            assessmentDate: '2024-01-15',
            overallScore: 78.5,
            topics: [
              {
                name: 'Cardiovascular Nursing',
                score: 75,
                totalQuestions: 20,
                correctAnswers: 15,
                priority: 'high',
                studyTime: 45
              },
              {
                name: 'Respiratory Care',
                score: 85,
                totalQuestions: 15,
                correctAnswers: 13,
                priority: 'medium',
                studyTime: 30
              }
            ],
            recommendations: [
              'Focus on cardiovascular assessment techniques',
              'Review respiratory medication administration'
            ]
          })
        });
      });

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await uploadHelpers.uploadWithDragDrop(testPdfPath);

      // Wait for results page
      await uploadHelpers.page.waitForURL('**/mvp-action-plan/**', { timeout: TIMEOUTS.LONG });

      // Verify results display
      await expect(uploadHelpers.page.locator('[data-testid="student-name"]')).toContainText('Test Student');
      await expect(uploadHelpers.page.locator('[data-testid="overall-score"]')).toContainText('78.5');
      
      // Verify topic summaries
      await expect(uploadHelpers.page.locator('[data-testid="topic-cardiovascular"]')).toBeVisible();
      await expect(uploadHelpers.page.locator('[data-testid="topic-respiratory"]')).toBeVisible();
      
      // Verify priority indicators
      await expect(uploadHelpers.page.locator('[data-testid="priority-high"]')).toBeVisible();
      await expect(uploadHelpers.page.locator('[data-testid="priority-medium"]')).toBeVisible();
    });

    test('should show progress to results page', async () => {
      await uploadHelpers.navigateTo('/');

      // Mock upload that redirects to results
      await uploadHelpers.page.route('/api/assessment-reports', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            reportId: 'test-123',
            redirect: '/mvp-action-plan/test-123'
          })
        });
      });

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await uploadHelpers.uploadWithDragDrop(testPdfPath);

      // Should show "View Results" button
      const viewResultsButton = uploadHelpers.page.locator('[data-testid="button-view-results"]');
      await expect(viewResultsButton).toBeVisible();
      
      // Click to view results
      await viewResultsButton.click();
      await uploadHelpers.page.waitForURL('**/mvp-action-plan/test-123');
    });

    test('should handle empty or invalid results gracefully', async () => {
      await uploadHelpers.navigateTo('/');

      // Mock upload with no extractable data
      await uploadHelpers.page.route('/api/assessment-reports', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            reportId: 'test-123',
            message: 'No assessment data could be extracted from this PDF',
            topics: []
          })
        });
      });

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await uploadHelpers.uploadWithDragDrop(testPdfPath);

      // Should show appropriate message for empty results
      const noDataMessage = uploadHelpers.page.locator('[data-testid="no-data-message"]');
      await expect(noDataMessage).toContainText('No assessment data could be extracted');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors during upload', async () => {
      await uploadHelpers.navigateTo('/');
      
      // Simulate network failure
      await uploadHelpers.simulateNetworkFailure('/api/assessment-reports');

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await uploadHelpers.uploadWithDragDrop(testPdfPath);

      // Verify error handling
      const errorMessage = uploadHelpers.page.locator(SELECTORS.UPLOAD_ERROR_MESSAGE);
      await expect(errorMessage).toContainText('Upload failed');
      
      // Should provide retry option
      const retryButton = uploadHelpers.page.locator('[data-testid="button-retry-upload"]');
      await expect(retryButton).toBeVisible();
    });

    test('should handle server errors gracefully', async () => {
      await uploadHelpers.navigateTo('/');

      // Mock server error
      await uploadHelpers.page.route('/api/assessment-reports', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({
            error: 'Internal server error during processing'
          })
        });
      });

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await uploadHelpers.uploadWithDragDrop(testPdfPath);

      const errorMessage = uploadHelpers.page.locator(SELECTORS.UPLOAD_ERROR_MESSAGE);
      await expect(errorMessage).toContainText('server error');
    });

    test('should handle timeout errors', async () => {
      await uploadHelpers.navigateTo('/');

      // Mock timeout by delaying response beyond timeout
      await uploadHelpers.page.route('/api/assessment-reports', async route => {
        await new Promise(resolve => setTimeout(resolve, 65000)); // Beyond 60s timeout
        route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true })
        });
      });

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await uploadHelpers.uploadWithDragDrop(testPdfPath);

      // Should show timeout error
      const errorMessage = uploadHelpers.page.locator(SELECTORS.UPLOAD_ERROR_MESSAGE);
      await expect(errorMessage).toContainText('timeout', { timeout: 70000 });
    });

    test('should provide helpful error messages', async () => {
      await uploadHelpers.navigateTo('/');

      const errorScenarios = [
        { status: 413, error: 'File too large', expectedText: 'File size exceeds' },
        { status: 415, error: 'Unsupported media type', expectedText: 'file format' },
        { status: 422, error: 'Unprocessable entity', expectedText: 'could not be processed' },
      ];

      for (const scenario of errorScenarios) {
        await uploadHelpers.page.route('/api/assessment-reports', route => {
          route.fulfill({
            status: scenario.status,
            body: JSON.stringify({ error: scenario.error })
          });
        });

        const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
        await uploadHelpers.uploadWithDragDrop(testPdfPath);

        const errorMessage = uploadHelpers.page.locator(SELECTORS.UPLOAD_ERROR_MESSAGE);
        await expect(errorMessage).toContainText(scenario.expectedText);
        
        // Reset for next scenario
        await uploadHelpers.page.reload();
      }
    });
  });

  test.describe('Multiple File Handling', () => {
    test('should handle multiple file selection gracefully', async () => {
      await uploadHelpers.navigateTo('/');

      const fileInput = uploadHelpers.page.locator(SELECTORS.FILE_UPLOAD_INPUT);
      
      // Try to select multiple files (should only accept first one)
      const testFiles = [
        path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf'),
        path.join(process.cwd(), 'e2e/test-data/test-assessment-2.pdf')
      ];
      
      await fileInput.setInputFiles(testFiles);

      // Should show message about single file limit
      const singleFileMessage = uploadHelpers.page.locator('[data-testid="single-file-only-message"]');
      await expect(singleFileMessage).toContainText('Please upload one PDF file at a time');
    });

    test('should allow sequential uploads', async () => {
      await uploadHelpers.navigateTo('/');

      // First upload
      await uploadHelpers.page.route('/api/assessment-reports', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            reportId: 'test-1',
            message: 'First upload successful'
          })
        });
      });

      const testPdfPath1 = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await uploadHelpers.uploadWithDragDrop(testPdfPath1);
      
      await uploadHelpers.waitForVisible(SELECTORS.UPLOAD_SUCCESS_MESSAGE);

      // Should allow uploading another file
      const uploadAnotherButton = uploadHelpers.page.locator('[data-testid="button-upload-another"]');
      await expect(uploadAnotherButton).toBeVisible();
    });
  });
});

/**
 * Helper function to create test PDF files
 */
async function createTestPDFs() {
  const testDataDir = path.join(process.cwd(), 'e2e/test-data');
  
  // Create test data directory if it doesn't exist
  try {
    await fs.mkdir(testDataDir, { recursive: true });
  } catch (error) {
    // Directory already exists
  }

  // Create a minimal valid PDF file
  const pdfContent = generateTestData.mockPdfBuffer();
  const testPdfPath = path.join(testDataDir, 'test-assessment.pdf');
  
  try {
    await fs.access(testPdfPath);
  } catch {
    // File doesn't exist, create it
    await fs.writeFile(testPdfPath, pdfContent);
  }
}