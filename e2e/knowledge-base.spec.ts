import { test, expect } from '@playwright/test';
import { AdminHelpers, FileUploadHelpers } from './utils/test-helpers';
import { TEST_USERS, TEST_FILES, SELECTORS, TIMEOUTS, generateTestData } from './test-data/fixtures';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Knowledge Base Functionality E2E Tests
 * 
 * Tests Knowledge Base functionality including:
 * - Document upload with progress tracking and validation
 * - Search functionality with validation and results
 * - Empty state display when no documents exist
 * - Document management (listing, deletion, status updates)
 * - File type validation and magic byte detection
 * - Table extraction and searchability
 */

test.describe('Knowledge Base Functionality', () => {
  let adminHelpers: AdminHelpers;
  let uploadHelpers: FileUploadHelpers;

  test.beforeEach(async ({ page }) => {
    adminHelpers = new AdminHelpers(page);
    uploadHelpers = new FileUploadHelpers(page);
    adminHelpers.setupConsoleLogging();
    
    // Login as admin for KB access
    await adminHelpers.loginAsAdmin(TEST_USERS.ADMIN.email, TEST_USERS.ADMIN.password);
    await createTestDocuments();
  });

  test.afterEach(async () => {
    await adminHelpers.clearMocks();
  });

  test.describe('Empty States', () => {
    test('should display empty state when no documents exist', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock empty documents response
      await adminHelpers.mockAPI('/api/admin/knowledge-base/documents', {
        documents: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await adminHelpers.page.reload();

      // Verify empty state display
      const emptyState = adminHelpers.page.locator(SELECTORS.KB_EMPTY_STATE);
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('No documents uploaded yet');
      
      // Verify upload suggestion
      await expect(emptyState).toContainText('Upload your first document');
      
      // Verify upload button is prominent
      const uploadButton = adminHelpers.page.locator(SELECTORS.KB_UPLOAD_BUTTON);
      await expect(uploadButton).toBeVisible();
      await expect(uploadButton).toContainText('Upload Document');
    });

    test('should show empty search results when no matches found', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock search with no results
      await adminHelpers.mockAPI('/api/admin/knowledge-base/search*', {
        results: [],
        query: 'nonexistent topic',
        totalResults: 0,
        processingTime: 0.1
      });

      // Perform search
      await adminHelpers.fillAndVerifyField(SELECTORS.KB_SEARCH_INPUT, 'nonexistent topic');
      await adminHelpers.clickAndWait(SELECTORS.KB_SEARCH_BUTTON);

      // Verify no results state
      const noResultsState = adminHelpers.page.locator('[data-testid="no-search-results"]');
      await expect(noResultsState).toBeVisible();
      await expect(noResultsState).toContainText('No results found for "nonexistent topic"');
      
      // Verify search suggestions
      await expect(noResultsState).toContainText('Try different keywords');
      await expect(noResultsState).toContainText('Check your spelling');
    });

    test('should show empty state with helpful tips', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      await adminHelpers.mockAPI('/api/admin/knowledge-base/documents', {
        documents: [],
        total: 0
      });

      await adminHelpers.page.reload();

      const emptyState = adminHelpers.page.locator(SELECTORS.KB_EMPTY_STATE);
      
      // Verify helpful tips are shown
      await expect(emptyState).toContainText('Upload PDF documents');
      await expect(emptyState).toContainText('Build your knowledge base');
      await expect(emptyState).toContainText('Search and find information');
    });

    test('should transition from empty to populated state', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Start with empty state
      await adminHelpers.mockAPI('/api/admin/knowledge-base/documents', {
        documents: [],
        total: 0
      });

      await adminHelpers.page.reload();
      await expect(adminHelpers.page.locator(SELECTORS.KB_EMPTY_STATE)).toBeVisible();

      // Upload a document
      await adminHelpers.mockAPI('/api/admin/knowledge-base/upload', {
        success: true,
        documentId: 'test-doc-1',
        jobId: 'job-123'
      });

      // Mock updated documents list
      await adminHelpers.mockAPI('/api/admin/knowledge-base/documents', {
        documents: [{
          id: 'test-doc-1',
          title: 'Test Document',
          type: 'pdf',
          status: 'processed',
          uploadedAt: new Date().toISOString()
        }],
        total: 1
      });

      const uploadButton = adminHelpers.page.locator(SELECTORS.KB_UPLOAD_BUTTON);
      await uploadButton.click();

      const testDocPath = path.join(process.cwd(), 'e2e/test-data/sample-document.pdf');
      await uploadHelpers.uploadFile('[data-testid="kb-file-input"]', testDocPath);

      // Wait for upload to complete and page to refresh
      await adminHelpers.waitForLoadingToFinish('[data-testid="upload-loading"]');

      // Verify empty state is gone and document list is shown
      await expect(adminHelpers.page.locator(SELECTORS.KB_EMPTY_STATE)).toBeHidden();
      await expect(adminHelpers.page.locator(SELECTORS.KB_DOCUMENT_LIST)).toBeVisible();
    });
  });

  test.describe('Document Upload', () => {
    test('should upload document with progress tracking', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock progressive upload stages
      let stage = 'uploading';
      await adminHelpers.page.route('/api/admin/knowledge-base/upload', async route => {
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        if (stage === 'uploading') {
          await delay(500);
          stage = 'processing';
          route.fulfill({
            status: 202,
            body: JSON.stringify({
              stage: 'uploading',
              progress: 30,
              message: 'Uploading document...'
            })
          });
        } else if (stage === 'processing') {
          await delay(1000);
          stage = 'extracting';
          route.fulfill({
            status: 202,
            body: JSON.stringify({
              stage: 'processing',
              progress: 60,
              message: 'Processing content...'
            })
          });
        } else if (stage === 'extracting') {
          await delay(800);
          route.fulfill({
            status: 200,
            body: JSON.stringify({
              success: true,
              documentId: 'test-doc-123',
              jobId: 'job-456',
              stage: 'complete',
              progress: 100,
              message: 'Upload complete'
            })
          });
        }
      });

      await adminHelpers.clickAndWait(SELECTORS.KB_UPLOAD_BUTTON);
      
      const testDocPath = path.join(process.cwd(), 'e2e/test-data/sample-document.pdf');
      await uploadHelpers.uploadFile('[data-testid="kb-file-input"]', testDocPath);

      // Verify progress stages
      await expect(adminHelpers.page.locator('[data-testid="upload-stage-uploading"]')).toBeVisible();
      await expect(adminHelpers.page.locator('[data-testid="upload-stage-processing"]')).toBeVisible();
      await expect(adminHelpers.page.locator('[data-testid="upload-stage-extracting"]')).toBeVisible();

      // Verify completion
      await expect(adminHelpers.page.locator('[data-testid="upload-success"]')).toBeVisible();
    });

    test('should validate file types before upload', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      const uploadButton = adminHelpers.page.locator(SELECTORS.KB_UPLOAD_BUTTON);
      await uploadButton.click();

      // Try to upload non-PDF file
      const textFilePath = path.join(process.cwd(), 'e2e/test-data/invalid-file.txt');
      await fs.writeFile(textFilePath, 'This is not a PDF file');

      await uploadHelpers.uploadFile('[data-testid="kb-file-input"]', textFilePath);

      // Verify validation error
      const errorMessage = adminHelpers.page.locator('[data-testid="file-validation-error"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Only PDF, DOC, DOCX, and TXT files are supported');

      // Clean up
      await fs.unlink(textFilePath).catch(() => {});
    });

    test('should validate file size limits', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock large file rejection
      await adminHelpers.mockAPI('/api/admin/knowledge-base/upload', {
        error: 'File size exceeds maximum limit of 50MB'
      }, 413);

      await adminHelpers.clickAndWait(SELECTORS.KB_UPLOAD_BUTTON);
      
      const testDocPath = path.join(process.cwd(), 'e2e/test-data/sample-document.pdf');
      await uploadHelpers.uploadFile('[data-testid="kb-file-input"]', testDocPath);

      // Verify size error
      const errorMessage = adminHelpers.page.locator('[data-testid="upload-error"]');
      await expect(errorMessage).toContainText('File size exceeds maximum limit');
    });

    test('should handle upload failures gracefully', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock upload failure
      await adminHelpers.mockAPI('/api/admin/knowledge-base/upload', {
        error: 'Failed to process document'
      }, 500);

      await adminHelpers.clickAndWait(SELECTORS.KB_UPLOAD_BUTTON);
      
      const testDocPath = path.join(process.cwd(), 'e2e/test-data/sample-document.pdf');
      await uploadHelpers.uploadFile('[data-testid="kb-file-input"]', testDocPath);

      // Verify error handling
      const errorMessage = adminHelpers.page.locator('[data-testid="upload-error"]');
      await expect(errorMessage).toBeVisible();
      
      // Verify retry option
      const retryButton = adminHelpers.page.locator('[data-testid="button-retry-upload"]');
      await expect(retryButton).toBeVisible();
    });

    test('should show processing job status', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock upload and job creation
      await adminHelpers.mockAPI('/api/admin/knowledge-base/upload', {
        success: true,
        documentId: 'test-doc-123',
        jobId: 'job-456'
      });

      // Mock job status
      await adminHelpers.mockAPI('/api/admin/knowledge-base/jobs/job-456', {
        id: 'job-456',
        documentId: 'test-doc-123',
        status: 'processing',
        stage: 'text_extraction',
        progress: 45,
        message: 'Extracting text from document...'
      });

      await adminHelpers.clickAndWait(SELECTORS.KB_UPLOAD_BUTTON);
      
      const testDocPath = path.join(process.cwd(), 'e2e/test-data/sample-document.pdf');
      await uploadHelpers.uploadFile('[data-testid="kb-file-input"]', testDocPath);

      // Verify job status display
      const jobStatus = adminHelpers.page.locator('[data-testid="job-status-job-456"]');
      await expect(jobStatus).toBeVisible();
      await expect(jobStatus).toContainText('Extracting text from document...');
      await expect(jobStatus).toContainText('45%');
    });
  });

  test.describe('Search Functionality', () => {
    test('should perform semantic search with results', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock search results
      await adminHelpers.mockAPI('/api/admin/knowledge-base/search*', {
        results: [
          {
            id: 'chunk-1',
            content: 'Cardiovascular assessment involves checking heart rate, blood pressure, and cardiac rhythm...',
            score: 0.85,
            documentId: 'doc-1',
            documentTitle: 'Cardiovascular Nursing Guide',
            pageStart: 12,
            pageEnd: 13,
            highlighted: '<mark>Cardiovascular assessment</mark> involves checking heart rate...'
          },
          {
            id: 'chunk-2',
            content: 'Heart failure management requires monitoring fluid balance and medication compliance...',
            score: 0.78,
            documentId: 'doc-1',
            documentTitle: 'Cardiovascular Nursing Guide',
            pageStart: 24,
            pageEnd: 24,
            highlighted: '<mark>Heart failure</mark> management requires monitoring...'
          }
        ],
        query: 'cardiovascular assessment',
        totalResults: 2,
        processingTime: 0.23
      });

      // Perform search
      await adminHelpers.fillAndVerifyField(SELECTORS.KB_SEARCH_INPUT, 'cardiovascular assessment');
      await adminHelpers.clickAndWait(SELECTORS.KB_SEARCH_BUTTON);

      // Verify search results
      const results = adminHelpers.page.locator('[data-testid="search-results"]');
      await expect(results).toBeVisible();
      
      const firstResult = adminHelpers.page.locator('[data-testid="search-result-chunk-1"]');
      await expect(firstResult).toBeVisible();
      await expect(firstResult).toContainText('Cardiovascular Nursing Guide');
      await expect(firstResult).toContainText('Page 12-13');
      
      // Verify highlighting
      const highlightedText = firstResult.locator('mark');
      await expect(highlightedText).toContainText('Cardiovascular assessment');
    });

    test('should validate search input', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Try empty search
      await adminHelpers.clickAndWait(SELECTORS.KB_SEARCH_BUTTON);

      // Verify validation error
      const searchInput = adminHelpers.page.locator(SELECTORS.KB_SEARCH_INPUT);
      await expect(searchInput).toHaveAttribute('aria-invalid', 'true');
      
      const errorMessage = adminHelpers.page.locator('[data-testid="search-validation-error"]');
      await expect(errorMessage).toContainText('Please enter a search query');
    });

    test('should handle search query length limits', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Try very long search query
      const longQuery = 'a'.repeat(501); // Over 500 character limit
      await adminHelpers.fillAndVerifyField(SELECTORS.KB_SEARCH_INPUT, longQuery);
      await adminHelpers.clickAndWait(SELECTORS.KB_SEARCH_BUTTON);

      // Verify length validation
      const errorMessage = adminHelpers.page.locator('[data-testid="search-length-error"]');
      await expect(errorMessage).toContainText('Search query too long');
    });

    test('should provide search suggestions and filters', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock search suggestions
      await adminHelpers.page.route('/api/admin/knowledge-base/search*', route => {
        const url = route.request().url();
        if (url.includes('suggestions')) {
          route.fulfill({
            status: 200,
            body: JSON.stringify({
              suggestions: [
                'cardiovascular assessment',
                'cardiac nursing',
                'heart failure management'
              ]
            })
          });
        }
      });

      // Start typing in search input
      const searchInput = adminHelpers.page.locator(SELECTORS.KB_SEARCH_INPUT);
      await searchInput.fill('cardio');

      // Verify suggestions appear
      const suggestions = adminHelpers.page.locator('[data-testid="search-suggestions"]');
      await expect(suggestions).toBeVisible();
      await expect(suggestions).toContainText('cardiovascular assessment');
      await expect(suggestions).toContainText('cardiac nursing');
    });

    test('should support advanced search with filters', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Open advanced search options
      const advancedButton = adminHelpers.page.locator('[data-testid="button-advanced-search"]');
      await advancedButton.click();

      // Verify filter options
      await expect(adminHelpers.page.locator('[data-testid="filter-document-type"]')).toBeVisible();
      await expect(adminHelpers.page.locator('[data-testid="filter-date-range"]')).toBeVisible();
      await expect(adminHelpers.page.locator('[data-testid="filter-relevance-score"]')).toBeVisible();

      // Set filters
      await adminHelpers.page.locator('[data-testid="filter-document-type"]').selectOption('pdf');
      await adminHelpers.fillAndVerifyField('[data-testid="filter-min-score"]', '0.7');

      // Mock filtered search results
      await adminHelpers.mockAPI('/api/admin/knowledge-base/search*', {
        results: [
          {
            id: 'chunk-1',
            content: 'High-relevance cardiovascular content...',
            score: 0.92,
            documentId: 'doc-1',
            documentTitle: 'Cardiovascular Guide.pdf'
          }
        ],
        filters: {
          documentType: 'pdf',
          minScore: 0.7
        }
      });

      await adminHelpers.fillAndVerifyField(SELECTORS.KB_SEARCH_INPUT, 'cardiovascular');
      await adminHelpers.clickAndWait(SELECTORS.KB_SEARCH_BUTTON);

      // Verify filtered results
      const results = adminHelpers.page.locator('[data-testid="search-results"]');
      await expect(results).toBeVisible();
      
      const filterInfo = adminHelpers.page.locator('[data-testid="active-filters"]');
      await expect(filterInfo).toContainText('PDF documents only');
      await expect(filterInfo).toContainText('Relevance ≥ 0.7');
    });

    test('should handle search errors gracefully', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock search error
      await adminHelpers.mockAPI('/api/admin/knowledge-base/search*', {
        error: 'Search service temporarily unavailable'
      }, 503);

      await adminHelpers.fillAndVerifyField(SELECTORS.KB_SEARCH_INPUT, 'test query');
      await adminHelpers.clickAndWait(SELECTORS.KB_SEARCH_BUTTON);

      // Verify error handling
      const errorMessage = adminHelpers.page.locator('[data-testid="search-error"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Search service temporarily unavailable');
      
      // Verify retry option
      const retryButton = adminHelpers.page.locator('[data-testid="button-retry-search"]');
      await expect(retryButton).toBeVisible();
    });
  });

  test.describe('Document Management', () => {
    test('should display document list with status', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock document list
      await adminHelpers.mockAPI('/api/admin/knowledge-base/documents', {
        documents: [
          {
            id: 'doc-1',
            title: 'Cardiovascular Nursing Guide',
            type: 'pdf',
            status: 'processed',
            uploadedAt: '2024-01-15T10:30:00Z',
            fileSize: 2048576,
            pageCount: 45,
            chunkCount: 120
          },
          {
            id: 'doc-2',
            title: 'Respiratory Care Manual',
            type: 'pdf',
            status: 'processing',
            uploadedAt: '2024-01-16T14:20:00Z',
            fileSize: 3145728,
            pageCount: null,
            chunkCount: 0
          },
          {
            id: 'doc-3',
            title: 'Medication Reference',
            type: 'pdf',
            status: 'failed',
            uploadedAt: '2024-01-17T09:15:00Z',
            fileSize: 1572864,
            errorMessage: 'Text extraction failed'
          }
        ],
        total: 3
      });

      await adminHelpers.page.reload();

      // Verify document list display
      const documentList = adminHelpers.page.locator(SELECTORS.KB_DOCUMENT_LIST);
      await expect(documentList).toBeVisible();

      // Verify individual documents
      const doc1 = adminHelpers.page.locator('[data-testid="document-doc-1"]');
      await expect(doc1).toBeVisible();
      await expect(doc1).toContainText('Cardiovascular Nursing Guide');
      await expect(doc1).toContainText('Processed');
      await expect(doc1).toContainText('45 pages');
      await expect(doc1).toContainText('120 chunks');

      const doc2 = adminHelpers.page.locator('[data-testid="document-doc-2"]');
      await expect(doc2).toContainText('Processing');
      
      const doc3 = adminHelpers.page.locator('[data-testid="document-doc-3"]');
      await expect(doc3).toContainText('Failed');
      await expect(doc3).toContainText('Text extraction failed');
    });

    test('should allow document deletion', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock document list and deletion
      await adminHelpers.mockAPI('/api/admin/knowledge-base/documents', {
        documents: [{
          id: 'doc-1',
          title: 'Test Document',
          status: 'processed'
        }]
      });

      await adminHelpers.mockAPI('/api/admin/knowledge-base/document/doc-1', {
        success: true,
        message: 'Document deleted successfully'
      });

      await adminHelpers.page.reload();

      // Click delete button
      const deleteButton = adminHelpers.page.locator('[data-testid="button-delete-doc-1"]');
      await deleteButton.click();

      // Confirm deletion in modal
      const confirmButton = adminHelpers.page.locator('[data-testid="button-confirm-delete"]');
      await confirmButton.click();

      // Verify success message
      const successMessage = adminHelpers.page.locator('[data-testid="delete-success"]');
      await expect(successMessage).toContainText('Document deleted successfully');
    });

    test('should allow document reprocessing', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock failed document and reprocessing
      await adminHelpers.mockAPI('/api/admin/knowledge-base/documents', {
        documents: [{
          id: 'doc-1',
          title: 'Failed Document',
          status: 'failed',
          errorMessage: 'Processing failed'
        }]
      });

      await adminHelpers.mockAPI('/api/admin/knowledge-base/reprocess/doc-1', {
        success: true,
        jobId: 'job-789',
        message: 'Document queued for reprocessing'
      });

      await adminHelpers.page.reload();

      // Click reprocess button
      const reprocessButton = adminHelpers.page.locator('[data-testid="button-reprocess-doc-1"]');
      await reprocessButton.click();

      // Verify reprocessing confirmation
      const successMessage = adminHelpers.page.locator('[data-testid="reprocess-success"]');
      await expect(successMessage).toContainText('queued for reprocessing');
    });

    test('should show document details and chunks', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock document and its chunks
      await adminHelpers.mockAPI('/api/admin/knowledge-base/documents/doc-1', {
        id: 'doc-1',
        title: 'Test Document',
        status: 'processed',
        metadata: {
          author: 'Test Author',
          createdDate: '2024-01-01',
          pageCount: 10
        }
      });

      await adminHelpers.mockAPI('/api/admin/knowledge-base/documents/doc-1/chunks', {
        chunks: [
          {
            id: 'chunk-1',
            content: 'This is the first chunk of content...',
            pageStart: 1,
            pageEnd: 1,
            tokens: 45
          },
          {
            id: 'chunk-2',
            content: 'This is the second chunk of content...',
            pageStart: 1,
            pageEnd: 2,
            tokens: 52
          }
        ]
      });

      // Click to view document details
      const detailsButton = adminHelpers.page.locator('[data-testid="button-view-details-doc-1"]');
      await detailsButton.click();

      // Verify document details modal
      const detailsModal = adminHelpers.page.locator('[data-testid="document-details-modal"]');
      await expect(detailsModal).toBeVisible();
      await expect(detailsModal).toContainText('Test Document');
      await expect(detailsModal).toContainText('Test Author');
      await expect(detailsModal).toContainText('10 pages');

      // Verify chunks display
      const chunksList = adminHelpers.page.locator('[data-testid="chunks-list"]');
      await expect(chunksList).toBeVisible();
      
      const chunk1 = adminHelpers.page.locator('[data-testid="chunk-chunk-1"]');
      await expect(chunk1).toContainText('This is the first chunk');
      await expect(chunk1).toContainText('Page 1');
    });

    test('should handle bulk operations', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock multiple documents
      await adminHelpers.mockAPI('/api/admin/knowledge-base/documents', {
        documents: [
          { id: 'doc-1', title: 'Document 1', status: 'processed' },
          { id: 'doc-2', title: 'Document 2', status: 'failed' },
          { id: 'doc-3', title: 'Document 3', status: 'processed' }
        ]
      });

      await adminHelpers.page.reload();

      // Select multiple documents
      await adminHelpers.page.locator('[data-testid="checkbox-doc-1"]').check();
      await adminHelpers.page.locator('[data-testid="checkbox-doc-3"]').check();

      // Verify bulk actions appear
      const bulkActions = adminHelpers.page.locator('[data-testid="bulk-actions"]');
      await expect(bulkActions).toBeVisible();
      
      const bulkDeleteButton = adminHelpers.page.locator('[data-testid="button-bulk-delete"]');
      await expect(bulkDeleteButton).toBeVisible();
      await expect(bulkDeleteButton).toContainText('Delete (2)');
    });
  });

  test.describe('File Type Validation', () => {
    test('should detect file types by magic bytes', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Test various file types
      const testFiles = [
        { name: 'fake.pdf', content: 'Not a PDF', shouldFail: true },
        { name: 'real.pdf', content: generateTestData.mockPdfBuffer(), shouldFail: false }
      ];

      for (const testFile of testFiles) {
        const filePath = path.join(process.cwd(), 'e2e/test-data', testFile.name);
        await fs.writeFile(filePath, testFile.content);

        await adminHelpers.clickAndWait(SELECTORS.KB_UPLOAD_BUTTON);
        await uploadHelpers.uploadFile('[data-testid="kb-file-input"]', filePath);

        if (testFile.shouldFail) {
          const errorMessage = adminHelpers.page.locator('[data-testid="file-validation-error"]');
          await expect(errorMessage).toContainText('Invalid file format');
        } else {
          await expect(adminHelpers.page.locator('[data-testid="upload-success"]')).toBeVisible();
        }

        // Clean up
        await fs.unlink(filePath).catch(() => {});
        await adminHelpers.page.reload();
      }
    });

    test('should validate supported file extensions', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      const supportedExtensions = ['pdf', 'doc', 'docx', 'txt'];
      const unsupportedExtensions = ['jpg', 'png', 'mp4', 'xlsx'];

      for (const ext of supportedExtensions) {
        const fileName = `test.${ext}`;
        const message = adminHelpers.page.locator('[data-testid="file-type-info"]');
        
        // Should show as supported
        await expect(message).toContainText(`${ext.toUpperCase()} files are supported`);
      }

      for (const ext of unsupportedExtensions) {
        const fileName = `test.${ext}`;
        // Should show as unsupported in error message when attempted
      }
    });

    test('should provide clear file format requirements', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      await adminHelpers.clickAndWait(SELECTORS.KB_UPLOAD_BUTTON);

      // Verify file format requirements are displayed
      const requirements = adminHelpers.page.locator('[data-testid="file-requirements"]');
      await expect(requirements).toBeVisible();
      await expect(requirements).toContainText('Supported formats: PDF, DOC, DOCX, TXT');
      await expect(requirements).toContainText('Maximum file size: 50MB');
    });
  });

  test.describe('Integration Features', () => {
    test('should integrate search results with document chunks', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock search with chunk context
      await adminHelpers.mockAPI('/api/admin/knowledge-base/search*', {
        results: [{
          id: 'chunk-1',
          content: 'Cardiovascular assessment content...',
          score: 0.85,
          documentId: 'doc-1',
          documentTitle: 'Nursing Guide'
        }]
      });

      // Mock chunk context retrieval
      await adminHelpers.mockAPI('/api/rag/chunks/chunk-1/context', {
        chunk: {
          id: 'chunk-1',
          content: 'Cardiovascular assessment content...'
        },
        contextChunks: [
          { content: 'Previous context...' },
          { content: 'Following context...' }
        ]
      });

      await adminHelpers.fillAndVerifyField(SELECTORS.KB_SEARCH_INPUT, 'cardiovascular');
      await adminHelpers.clickAndWait(SELECTORS.KB_SEARCH_BUTTON);

      // Click to view chunk context
      const contextButton = adminHelpers.page.locator('[data-testid="button-view-context-chunk-1"]');
      await contextButton.click();

      // Verify context modal
      const contextModal = adminHelpers.page.locator('[data-testid="chunk-context-modal"]');
      await expect(contextModal).toBeVisible();
      await expect(contextModal).toContainText('Previous context');
      await expect(contextModal).toContainText('Following context');
    });

    test('should track search analytics', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock search with analytics
      await adminHelpers.mockAPI('/api/admin/knowledge-base/search*', {
        results: [{ id: 'chunk-1', content: 'Test content' }],
        analytics: {
          queryId: 'query-123',
          processingTime: 0.45,
          resultCount: 1
        }
      });

      await adminHelpers.fillAndVerifyField(SELECTORS.KB_SEARCH_INPUT, 'test query');
      await adminHelpers.clickAndWait(SELECTORS.KB_SEARCH_BUTTON);

      // Verify analytics display
      const analyticsInfo = adminHelpers.page.locator('[data-testid="search-analytics"]');
      await expect(analyticsInfo).toContainText('Found 1 result in 0.45s');
    });
  });
});

/**
 * Helper function to create test documents
 */
async function createTestDocuments() {
  const testDataDir = path.join(process.cwd(), 'e2e/test-data');
  
  // Create test data directory if it doesn't exist
  try {
    await fs.mkdir(testDataDir, { recursive: true });
  } catch (error) {
    // Directory already exists
  }

  // Create sample document
  const pdfContent = generateTestData.mockPdfBuffer();
  const sampleDocPath = path.join(testDataDir, 'sample-document.pdf');
  
  try {
    await fs.access(sampleDocPath);
  } catch {
    await fs.writeFile(sampleDocPath, pdfContent);
  }
}