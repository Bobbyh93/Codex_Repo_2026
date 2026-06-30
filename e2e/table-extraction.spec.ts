import { test, expect } from '@playwright/test';
import { AdminHelpers, FileUploadHelpers } from './utils/test-helpers';
import { TEST_USERS, TEST_FILES, SELECTORS, TIMEOUTS, generateTestData } from './test-data/fixtures';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * PDF Table Extraction E2E Tests
 * 
 * Tests PDF table extraction functionality including:
 * - Automatic table detection from uploaded PDFs
 * - Admin review process and approval workflows
 * - Table content searchability in knowledge base
 * - Bulk operations for table management
 * - Error handling for extraction failures and quality validation
 */

test.describe('PDF Table Extraction', () => {
  let adminHelpers: AdminHelpers;
  let uploadHelpers: FileUploadHelpers;

  test.beforeEach(async ({ page }) => {
    adminHelpers = new AdminHelpers(page);
    uploadHelpers = new FileUploadHelpers(page);
    adminHelpers.setupConsoleLogging();
    
    // Login as admin for table management access
    await adminHelpers.loginAsAdmin(TEST_USERS.ADMIN.email, TEST_USERS.ADMIN.password);
    await createTestPDFsWithTables();
  });

  test.afterEach(async () => {
    await adminHelpers.clearMocks();
  });

  test.describe('Table Detection', () => {
    test('should automatically detect tables in uploaded PDF', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock upload with table detection
      await adminHelpers.mockAPI('/api/admin/knowledge-base/upload', {
        success: true,
        documentId: 'doc-with-tables-123',
        jobId: 'job-456',
        tablesDetected: 3,
        extractedTables: [
          {
            id: 'table-1',
            title: 'Medication Dosage Chart',
            rowCount: 15,
            columnCount: 5,
            pageNumber: 2,
            confidence: 0.95
          },
          {
            id: 'table-2',
            title: 'Lab Values Reference',
            rowCount: 8,
            columnCount: 4,
            pageNumber: 5,
            confidence: 0.87
          }
        ]
      });

      // Upload PDF with tables
      await adminHelpers.clickAndWait('[data-testid="button-kb-upload"]');
      
      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/pdf-with-tables.pdf');
      await uploadHelpers.uploadFile('[data-testid="kb-file-input"]', testPdfPath);

      // Wait for upload completion
      await adminHelpers.waitForVisible('[data-testid="upload-success"]');

      // Verify table detection results
      const tableDetection = adminHelpers.page.locator('[data-testid="tables-detected"]');
      await expect(tableDetection).toBeVisible();
      await expect(tableDetection).toContainText('3 tables detected');

      // Verify individual table information
      const table1Info = adminHelpers.page.locator('[data-testid="detected-table-table-1"]');
      await expect(table1Info).toContainText('Medication Dosage Chart');
      await expect(table1Info).toContainText('15 rows × 5 columns');
      await expect(table1Info).toContainText('Page 2');
      await expect(table1Info).toContainText('95% confidence');
    });

    test('should handle PDFs without tables', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock upload with no tables detected
      await adminHelpers.mockAPI('/api/admin/knowledge-base/upload', {
        success: true,
        documentId: 'doc-no-tables-123',
        jobId: 'job-456',
        tablesDetected: 0,
        message: 'Document processed successfully. No tables detected.'
      });

      await adminHelpers.clickAndWait('[data-testid="button-kb-upload"]');
      
      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/pdf-no-tables.pdf');
      await uploadHelpers.uploadFile('[data-testid="kb-file-input"]', testPdfPath);

      // Verify no tables message
      const noTablesMessage = adminHelpers.page.locator('[data-testid="no-tables-detected"]');
      await expect(noTablesMessage).toBeVisible();
      await expect(noTablesMessage).toContainText('No tables detected in this document');
    });

    test('should detect tables with varying confidence levels', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock upload with tables of different confidence levels
      await adminHelpers.mockAPI('/api/admin/knowledge-base/upload', {
        success: true,
        documentId: 'doc-mixed-confidence',
        tablesDetected: 3,
        extractedTables: [
          { id: 'table-1', title: 'High Confidence Table', confidence: 0.95, needsReview: false },
          { id: 'table-2', title: 'Medium Confidence Table', confidence: 0.75, needsReview: true },
          { id: 'table-3', title: 'Low Confidence Table', confidence: 0.45, needsReview: true }
        ]
      });

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/pdf-mixed-tables.pdf');
      await uploadHelpers.uploadFile('[data-testid="kb-file-input"]', testPdfPath);

      // Verify confidence indicators
      const highConfTable = adminHelpers.page.locator('[data-testid="table-table-1"]');
      await expect(highConfTable).toHaveClass(/confidence-high/);
      
      const mediumConfTable = adminHelpers.page.locator('[data-testid="table-table-2"]');
      await expect(mediumConfTable).toHaveClass(/confidence-medium/);
      await expect(mediumConfTable).toContainText('Needs Review');
      
      const lowConfTable = adminHelpers.page.locator('[data-testid="table-table-3"]');
      await expect(lowConfTable).toHaveClass(/confidence-low/);
      await expect(lowConfTable).toContainText('Low Confidence');
    });

    test('should handle table extraction errors', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock upload with extraction error
      await adminHelpers.mockAPI('/api/admin/knowledge-base/upload', {
        success: true,
        documentId: 'doc-extraction-error',
        tablesDetected: 0,
        extractionErrors: [
          {
            page: 3,
            error: 'Table structure too complex to extract',
            severity: 'warning'
          },
          {
            page: 7,
            error: 'Image-based table detected but OCR failed',
            severity: 'error'
          }
        ]
      });

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/pdf-complex-tables.pdf');
      await uploadHelpers.uploadFile('[data-testid="kb-file-input"]', testPdfPath);

      // Verify extraction errors display
      const extractionErrors = adminHelpers.page.locator('[data-testid="extraction-errors"]');
      await expect(extractionErrors).toBeVisible();
      
      const warningError = adminHelpers.page.locator('[data-testid="error-warning"]');
      await expect(warningError).toContainText('Table structure too complex');
      
      const criticalError = adminHelpers.page.locator('[data-testid="error-critical"]');
      await expect(criticalError).toContainText('OCR failed');
    });

    test('should provide table preview during detection', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock upload with table preview data
      await adminHelpers.mockAPI('/api/admin/knowledge-base/upload', {
        success: true,
        documentId: 'doc-preview-tables',
        extractedTables: [{
          id: 'table-1',
          title: 'Sample Table',
          preview: {
            headers: ['Medication', 'Dosage', 'Frequency', 'Route'],
            sampleRows: [
              ['Aspirin', '325mg', 'Daily', 'PO'],
              ['Metformin', '500mg', 'BID', 'PO'],
              ['Lisinopril', '10mg', 'Daily', 'PO']
            ],
            totalRows: 25
          }
        }]
      });

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/pdf-medication-table.pdf');
      await uploadHelpers.uploadFile('[data-testid="kb-file-input"]', testPdfPath);

      // Click to view table preview
      const previewButton = adminHelpers.page.locator('[data-testid="button-preview-table-1"]');
      await previewButton.click();

      // Verify preview modal
      const previewModal = adminHelpers.page.locator('[data-testid="table-preview-modal"]');
      await expect(previewModal).toBeVisible();
      await expect(previewModal).toContainText('Sample Table');
      
      // Verify table structure
      const tableHeaders = adminHelpers.page.locator('[data-testid="preview-headers"]');
      await expect(tableHeaders).toContainText('Medication');
      await expect(tableHeaders).toContainText('Dosage');
      
      const sampleData = adminHelpers.page.locator('[data-testid="preview-data"]');
      await expect(sampleData).toContainText('Aspirin');
      await expect(sampleData).toContainText('325mg');
      
      const totalRows = adminHelpers.page.locator('[data-testid="total-rows"]');
      await expect(totalRows).toContainText('25 total rows');
    });
  });

  test.describe('Admin Review Process', () => {
    test.beforeEach(async () => {
      // Mock extracted tables waiting for review
      await adminHelpers.mockAPI('/api/admin/tables', {
        tables: [
          {
            id: 'table-1',
            title: 'Medication Reference',
            documentTitle: 'Nursing Drug Guide',
            status: 'pending_review',
            confidence: 0.85,
            rowCount: 50,
            columnCount: 6,
            extractedAt: '2024-01-15T10:30:00Z'
          },
          {
            id: 'table-2',
            title: 'Lab Values Chart',
            documentTitle: 'Laboratory Reference',
            status: 'needs_revision',
            confidence: 0.65,
            rowCount: 30,
            columnCount: 4,
            extractedAt: '2024-01-14T15:20:00Z'
          }
        ],
        total: 2
      });
    });

    test('should display tables pending review', async () => {
      await adminHelpers.navigateToAdminSection('tables');

      // Verify tables list
      const tablesTable = adminHelpers.page.locator('[data-testid="tables-review-list"]');
      await expect(tablesTable).toBeVisible();

      // Verify individual table entries
      const pendingTable = adminHelpers.page.locator('[data-testid="table-row-table-1"]');
      await expect(pendingTable).toBeVisible();
      await expect(pendingTable).toContainText('Medication Reference');
      await expect(pendingTable).toContainText('Pending Review');
      await expect(pendingTable).toContainText('85% confidence');
      await expect(pendingTable).toContainText('50 rows');

      const revisionTable = adminHelpers.page.locator('[data-testid="table-row-table-2"]');
      await expect(revisionTable).toContainText('Needs Revision');
      await expect(revisionTable).toHaveClass(/needs-attention/);
    });

    test('should allow detailed table review', async () => {
      await adminHelpers.navigateToAdminSection('tables');

      // Mock detailed table data
      await adminHelpers.mockAPI('/api/admin/tables/table-1/cells', {
        tableId: 'table-1',
        table: {
          id: 'table-1',
          title: 'Medication Reference',
          documentTitle: 'Nursing Drug Guide'
        },
        cells: [
          // Header row
          [
            { content: 'Medication', rowIndex: 0, columnIndex: 0, isHeader: true },
            { content: 'Dosage', rowIndex: 0, columnIndex: 1, isHeader: true },
            { content: 'Frequency', rowIndex: 0, columnIndex: 2, isHeader: true }
          ],
          // Data rows
          [
            { content: 'Aspirin', rowIndex: 1, columnIndex: 0 },
            { content: '325mg', rowIndex: 1, columnIndex: 1 },
            { content: 'Daily', rowIndex: 1, columnIndex: 2 }
          ],
          [
            { content: 'Metformin', rowIndex: 2, columnIndex: 0 },
            { content: '500mg', rowIndex: 2, columnIndex: 1 },
            { content: 'BID', rowIndex: 2, columnIndex: 2 }
          ]
        ],
        totalCells: 9
      });

      // Click review button
      const reviewButton = adminHelpers.page.locator('[data-testid="button-review-table-1"]');
      await reviewButton.click();

      // Verify detailed review interface
      const reviewInterface = adminHelpers.page.locator('[data-testid="table-review-interface"]');
      await expect(reviewInterface).toBeVisible();
      
      // Verify table content display
      const tableDisplay = adminHelpers.page.locator('[data-testid="table-content-display"]');
      await expect(tableDisplay).toBeVisible();
      
      // Check table headers
      const headers = adminHelpers.page.locator('[data-testid="table-headers"]');
      await expect(headers).toContainText('Medication');
      await expect(headers).toContainText('Dosage');
      
      // Check table data
      const tableData = adminHelpers.page.locator('[data-testid="table-data"]');
      await expect(tableData).toContainText('Aspirin');
      await expect(tableData).toContainText('325mg');
    });

    test('should allow editing table content', async () => {
      await adminHelpers.navigateToAdminSection('tables');
      
      // Mock table for editing
      await adminHelpers.mockAPI('/api/admin/tables/table-1/cells', {
        tableId: 'table-1',
        cells: [[
          { content: 'Wrong Content', rowIndex: 0, columnIndex: 0, id: 'cell-1' }
        ]]
      });

      const reviewButton = adminHelpers.page.locator('[data-testid="button-review-table-1"]');
      await reviewButton.click();

      // Enable edit mode
      const editModeButton = adminHelpers.page.locator('[data-testid="button-enable-edit"]');
      await editModeButton.click();

      // Edit cell content
      const editableCell = adminHelpers.page.locator('[data-testid="editable-cell-cell-1"]');
      await editableCell.click();
      await editableCell.fill('Corrected Content');

      // Save changes
      const saveButton = adminHelpers.page.locator('[data-testid="button-save-changes"]');
      
      // Mock successful edit
      await adminHelpers.mockAPI('/api/admin/tables/table-1/edit', {
        success: true,
        message: 'Table updated successfully'
      });
      
      await saveButton.click();

      // Verify success message
      const successMessage = adminHelpers.page.locator('[data-testid="edit-success"]');
      await expect(successMessage).toContainText('Table updated successfully');
    });

    test('should approve tables with topic mapping', async () => {
      await adminHelpers.navigateToAdminSection('tables');

      const reviewButton = adminHelpers.page.locator('[data-testid="button-review-table-1"]');
      await reviewButton.click();

      // Add approval notes
      await adminHelpers.fillAndVerifyField('[data-testid="textarea-approval-notes"]', 'Table content verified and accurate');

      // Map to topics
      await adminHelpers.page.locator('[data-testid="select-topic-mapping"]').selectOption('pharmacology');
      await adminHelpers.page.locator('[data-testid="select-secondary-topic"]').selectOption('medication-administration');

      // Mock approval
      await adminHelpers.mockAPI('/api/admin/tables/approve', {
        success: true,
        message: 'Table approved and made searchable'
      });

      // Submit approval
      const approveButton = adminHelpers.page.locator('[data-testid="button-approve-table"]');
      await approveButton.click();

      // Verify success
      const approvalSuccess = adminHelpers.page.locator('[data-testid="approval-success"]');
      await expect(approvalSuccess).toContainText('Table approved and made searchable');
    });

    test('should reject tables with feedback', async () => {
      await adminHelpers.navigateToAdminSection('tables');

      const reviewButton = adminHelpers.page.locator('[data-testid="button-review-table-1"]');
      await reviewButton.click();

      // Add rejection feedback
      await adminHelpers.fillAndVerifyField('[data-testid="textarea-rejection-notes"]', 'Table structure is incorrect and needs re-extraction');

      // Select rejection reason
      await adminHelpers.page.locator('[data-testid="select-rejection-reason"]').selectOption('extraction_error');

      // Mock rejection
      await adminHelpers.mockAPI('/api/admin/tables/approve', {
        success: true,
        message: 'Table rejected and marked for re-extraction'
      });

      // Submit rejection
      const rejectButton = adminHelpers.page.locator('[data-testid="button-reject-table"]');
      await rejectButton.click();

      // Verify rejection
      const rejectionSuccess = adminHelpers.page.locator('[data-testid="rejection-success"]');
      await expect(rejectionSuccess).toContainText('Table rejected and marked for re-extraction');
    });

    test('should handle table review workflow states', async () => {
      await adminHelpers.navigateToAdminSection('tables');

      // Test different workflow states
      const workflowStates = [
        { status: 'pending_review', className: 'status-pending', text: 'Pending Review' },
        { status: 'in_review', className: 'status-reviewing', text: 'Under Review' },
        { status: 'needs_revision', className: 'status-revision', text: 'Needs Revision' },
        { status: 'approved', className: 'status-approved', text: 'Approved' },
        { status: 'rejected', className: 'status-rejected', text: 'Rejected' }
      ];

      for (const state of workflowStates) {
        // Mock table with specific status
        await adminHelpers.mockAPI('/api/admin/tables', {
          tables: [{
            id: 'test-table',
            title: 'Test Table',
            status: state.status
          }]
        });

        await adminHelpers.page.reload();

        // Verify status display
        const tableRow = adminHelpers.page.locator('[data-testid="table-row-test-table"]');
        await expect(tableRow).toHaveClass(new RegExp(state.className));
        await expect(tableRow).toContainText(state.text);
      }
    });
  });

  test.describe('Search Integration', () => {
    test('should make approved table content searchable', async () => {
      // Navigate to knowledge base search
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock search that includes table content
      await adminHelpers.mockAPI('/api/admin/knowledge-base/search*', {
        results: [
          {
            id: 'chunk-from-table',
            content: 'Aspirin 325mg Daily PO - Anti-inflammatory medication for pain relief',
            score: 0.92,
            documentId: 'nursing-drug-guide',
            documentTitle: 'Nursing Drug Guide',
            sourceType: 'extracted_table',
            tableId: 'medication-table-1',
            tableTitle: 'Common Medications',
            highlighted: '<mark>Aspirin</mark> 325mg Daily PO'
          },
          {
            id: 'regular-content',
            content: 'Standard text content about medications...',
            score: 0.75,
            sourceType: 'document_text'
          }
        ],
        query: 'aspirin medication',
        totalResults: 2
      });

      // Perform search
      await adminHelpers.fillAndVerifyField(SELECTORS.KB_SEARCH_INPUT, 'aspirin medication');
      await adminHelpers.clickAndWait(SELECTORS.KB_SEARCH_BUTTON);

      // Verify table content in results
      const tableResult = adminHelpers.page.locator('[data-testid="search-result-chunk-from-table"]');
      await expect(tableResult).toBeVisible();
      await expect(tableResult).toContainText('Common Medications');
      await expect(tableResult).toContainText('From Table:');
      
      // Verify table result has distinct styling
      await expect(tableResult).toHaveClass(/result-from-table/);
      
      // Verify highlighted content
      const highlightedContent = tableResult.locator('mark');
      await expect(highlightedContent).toContainText('Aspirin');
    });

    test('should allow filtering search results by content type', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock search with mixed content types
      await adminHelpers.mockAPI('/api/admin/knowledge-base/search*', {
        results: [
          { id: '1', sourceType: 'document_text', content: 'Text content...' },
          { id: '2', sourceType: 'extracted_table', content: 'Table content...', tableTitle: 'Lab Values' },
          { id: '3', sourceType: 'document_text', content: 'More text...' }
        ],
        filters: {
          sourceType: 'extracted_table'
        }
      });

      // Open advanced search
      await adminHelpers.clickAndWait('[data-testid="button-advanced-search"]');

      // Set source type filter
      await adminHelpers.page.locator('[data-testid="filter-source-type"]').selectOption('extracted_table');

      await adminHelpers.fillAndVerifyField(SELECTORS.KB_SEARCH_INPUT, 'lab values');
      await adminHelpers.clickAndWait(SELECTORS.KB_SEARCH_BUTTON);

      // Verify only table results shown
      const results = adminHelpers.page.locator('[data-testid="search-results"]');
      await expect(results).toContainText('Lab Values');
      await expect(results).not.toContainText('Text content');

      // Verify filter indicator
      const activeFilter = adminHelpers.page.locator('[data-testid="active-filter-source-type"]');
      await expect(activeFilter).toContainText('Tables only');
    });

    test('should display table context in search results', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock search result with table context
      await adminHelpers.mockAPI('/api/admin/knowledge-base/search*', {
        results: [{
          id: 'table-result',
          content: 'Normal: 120-140 mmol/L',
          sourceType: 'extracted_table',
          tableContext: {
            tableTitle: 'Electrolyte Reference Values',
            rowContext: ['Parameter', 'Normal Range', 'Critical Low', 'Critical High'],
            columnHeaders: ['Sodium', 'Normal: 120-140 mmol/L', '<120 mmol/L', '>150 mmol/L'],
            surroundingCells: [
              'Potassium: 3.5-5.0 mmol/L',
              'Chloride: 96-106 mmol/L'
            ]
          }
        }]
      });

      await adminHelpers.fillAndVerifyField(SELECTORS.KB_SEARCH_INPUT, 'sodium levels');
      await adminHelpers.clickAndWait(SELECTORS.KB_SEARCH_BUTTON);

      // Click to view table context
      const contextButton = adminHelpers.page.locator('[data-testid="button-view-table-context"]');
      await contextButton.click();

      // Verify context modal
      const contextModal = adminHelpers.page.locator('[data-testid="table-context-modal"]');
      await expect(contextModal).toBeVisible();
      await expect(contextModal).toContainText('Electrolyte Reference Values');
      await expect(contextModal).toContainText('Normal Range');
      await expect(contextModal).toContainText('Critical Low');
      
      // Verify surrounding context
      const surroundingContext = adminHelpers.page.locator('[data-testid="surrounding-context"]');
      await expect(surroundingContext).toContainText('Potassium: 3.5-5.0');
    });

    test('should track table search analytics', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock search analytics including table-specific metrics
      await adminHelpers.mockAPI('/api/admin/knowledge-base/search*', {
        results: [{ id: 'result-1', sourceType: 'extracted_table' }],
        analytics: {
          queryId: 'query-123',
          tableResultsCount: 1,
          textResultsCount: 0,
          avgTableRelevance: 0.89,
          tablesSearched: 15
        }
      });

      await adminHelpers.fillAndVerifyField(SELECTORS.KB_SEARCH_INPUT, 'medication dosage');
      await adminHelpers.clickAndWait(SELECTORS.KB_SEARCH_BUTTON);

      // Verify analytics display
      const analyticsInfo = adminHelpers.page.locator('[data-testid="search-analytics"]');
      await expect(analyticsInfo).toContainText('Searched 15 tables');
      await expect(analyticsInfo).toContainText('1 table result');
    });
  });

  test.describe('Bulk Operations', () => {
    test.beforeEach(async () => {
      // Mock multiple tables for bulk operations
      await adminHelpers.mockAPI('/api/admin/tables', {
        tables: [
          { id: 'table-1', title: 'Table 1', status: 'pending_review' },
          { id: 'table-2', title: 'Table 2', status: 'pending_review' },
          { id: 'table-3', title: 'Table 3', status: 'needs_revision' },
          { id: 'table-4', title: 'Table 4', status: 'approved' }
        ]
      });

      await adminHelpers.navigateToAdminSection('tables');
    });

    test('should allow bulk approval of tables', async () => {
      // Select multiple pending tables
      await adminHelpers.page.locator('[data-testid="checkbox-table-1"]').check();
      await adminHelpers.page.locator('[data-testid="checkbox-table-2"]').check();

      // Verify bulk actions panel
      const bulkActions = adminHelpers.page.locator('[data-testid="bulk-actions"]');
      await expect(bulkActions).toBeVisible();
      await expect(bulkActions).toContainText('2 tables selected');

      // Click bulk approve
      const bulkApproveButton = adminHelpers.page.locator('[data-testid="button-bulk-approve"]');
      await bulkApproveButton.click();

      // Fill bulk approval form
      await adminHelpers.fillAndVerifyField('[data-testid="textarea-bulk-approval-notes"]', 'Bulk approval of medication tables');
      await adminHelpers.page.locator('[data-testid="select-bulk-topic"]').selectOption('pharmacology');

      // Mock bulk approval
      await adminHelpers.mockAPI('/api/admin/tables/bulk-approve', {
        success: true,
        approved: 2,
        message: '2 tables approved successfully'
      });

      await adminHelpers.clickAndWait('[data-testid="button-confirm-bulk-approve"]');

      // Verify success
      const successMessage = adminHelpers.page.locator('[data-testid="bulk-approval-success"]');
      await expect(successMessage).toContainText('2 tables approved successfully');
    });

    test('should allow bulk rejection of tables', async () => {
      // Select tables needing revision
      await adminHelpers.page.locator('[data-testid="checkbox-table-3"]').check();

      const bulkRejectButton = adminHelpers.page.locator('[data-testid="button-bulk-reject"]');
      await bulkRejectButton.click();

      // Fill rejection reason
      await adminHelpers.fillAndVerifyField('[data-testid="textarea-bulk-rejection-notes"]', 'Tables need re-extraction due to poor quality');
      await adminHelpers.page.locator('[data-testid="select-bulk-rejection-reason"]').selectOption('quality_issues');

      // Mock bulk rejection
      await adminHelpers.mockAPI('/api/admin/tables/bulk-reject', {
        success: true,
        rejected: 1,
        message: '1 table rejected'
      });

      await adminHelpers.clickAndWait('[data-testid="button-confirm-bulk-reject"]');

      const successMessage = adminHelpers.page.locator('[data-testid="bulk-rejection-success"]');
      await expect(successMessage).toContainText('1 table rejected');
    });

    test('should allow bulk topic mapping', async () => {
      // Select approved tables
      await adminHelpers.page.locator('[data-testid="checkbox-table-4"]').check();

      const bulkTopicButton = adminHelpers.page.locator('[data-testid="button-bulk-topic-mapping"]');
      await bulkTopicButton.click();

      // Set topic mappings
      await adminHelpers.page.locator('[data-testid="select-primary-topic"]').selectOption('laboratory-values');
      await adminHelpers.page.locator('[data-testid="select-secondary-topic"]').selectOption('diagnostic-procedures');

      // Mock bulk topic mapping
      await adminHelpers.mockAPI('/api/admin/tables/bulk-topic-mapping', {
        success: true,
        mapped: 1,
        message: 'Topic mappings updated for 1 table'
      });

      await adminHelpers.clickAndWait('[data-testid="button-apply-topic-mapping"]');

      const successMessage = adminHelpers.page.locator('[data-testid="topic-mapping-success"]');
      await expect(successMessage).toContainText('Topic mappings updated for 1 table');
    });

    test('should filter tables for bulk operations', async () => {
      // Apply status filter
      await adminHelpers.page.locator('[data-testid="filter-table-status"]').selectOption('pending_review');

      // Verify filtered results
      await expect(adminHelpers.page.locator('[data-testid="table-row-table-1"]')).toBeVisible();
      await expect(adminHelpers.page.locator('[data-testid="table-row-table-2"]')).toBeVisible();
      await expect(adminHelpers.page.locator('[data-testid="table-row-table-3"]')).toBeHidden();

      // Select all filtered tables
      const selectAllButton = adminHelpers.page.locator('[data-testid="button-select-all-filtered"]');
      await selectAllButton.click();

      // Verify selection count
      const bulkActions = adminHelpers.page.locator('[data-testid="bulk-actions"]');
      await expect(bulkActions).toContainText('2 tables selected');
    });

    test('should handle bulk operation errors', async () => {
      await adminHelpers.page.locator('[data-testid="checkbox-table-1"]').check();

      const bulkApproveButton = adminHelpers.page.locator('[data-testid="button-bulk-approve"]');
      await bulkApproveButton.click();

      // Mock partial failure
      await adminHelpers.mockAPI('/api/admin/tables/bulk-approve', {
        success: false,
        error: 'Some tables could not be approved',
        details: {
          approved: 0,
          failed: 1,
          errors: ['Table 1: Missing required topic mapping']
        }
      }, 400);

      await adminHelpers.clickAndWait('[data-testid="button-confirm-bulk-approve"]');

      // Verify error handling
      const errorMessage = adminHelpers.page.locator('[data-testid="bulk-operation-error"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Some tables could not be approved');
      await expect(errorMessage).toContainText('Missing required topic mapping');
    });
  });

  test.describe('Error Handling and Quality Validation', () => {
    test('should handle extraction failure gracefully', async () => {
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock upload with extraction failure
      await adminHelpers.mockAPI('/api/admin/knowledge-base/upload', {
        success: false,
        error: 'Table extraction failed',
        details: {
          stage: 'table_extraction',
          reason: 'PDF contains only image-based tables without text layer',
          suggestions: [
            'Try OCR preprocessing',
            'Use a different extraction method',
            'Manual table entry may be required'
          ]
        }
      }, 422);

      await adminHelpers.clickAndWait('[data-testid="button-kb-upload"]');
      
      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/image-only-tables.pdf');
      await uploadHelpers.uploadFile('[data-testid="kb-file-input"]', testPdfPath);

      // Verify error handling
      const extractionError = adminHelpers.page.locator('[data-testid="extraction-failure"]');
      await expect(extractionError).toBeVisible();
      await expect(extractionError).toContainText('Table extraction failed');
      await expect(extractionError).toContainText('image-based tables without text layer');

      // Verify suggestions
      const suggestions = adminHelpers.page.locator('[data-testid="extraction-suggestions"]');
      await expect(suggestions).toContainText('Try OCR preprocessing');
      await expect(suggestions).toContainText('Manual table entry may be required');
    });

    test('should validate table quality before approval', async () => {
      await adminHelpers.navigateToAdminSection('tables');

      // Mock table with quality issues
      await adminHelpers.mockAPI('/api/admin/tables/table-1/cells', {
        tableId: 'table-1',
        qualityIssues: [
          {
            type: 'missing_headers',
            severity: 'high',
            message: 'Table appears to be missing column headers'
          },
          {
            type: 'inconsistent_data',
            severity: 'medium',
            message: 'Some cells contain mixed data types'
          },
          {
            type: 'empty_cells',
            severity: 'low',
            message: '15% of cells are empty or contain no data'
          }
        ]
      });

      const reviewButton = adminHelpers.page.locator('[data-testid="button-review-table-1"]');
      await reviewButton.click();

      // Verify quality warnings
      const qualityWarnings = adminHelpers.page.locator('[data-testid="quality-warnings"]');
      await expect(qualityWarnings).toBeVisible();

      const highSeverityWarning = adminHelpers.page.locator('[data-testid="quality-high-severity"]');
      await expect(highSeverityWarning).toContainText('missing column headers');
      await expect(highSeverityWarning).toHaveClass(/severity-high/);

      const mediumWarning = adminHelpers.page.locator('[data-testid="quality-medium-severity"]');
      await expect(mediumWarning).toContainText('mixed data types');

      // Try to approve table with quality issues
      const approveButton = adminHelpers.page.locator('[data-testid="button-approve-table"]');
      await approveButton.click();

      // Should show confirmation for quality issues
      const qualityConfirmModal = adminHelpers.page.locator('[data-testid="quality-confirm-modal"]');
      await expect(qualityConfirmModal).toBeVisible();
      await expect(qualityConfirmModal).toContainText('This table has quality issues');
    });

    test('should retry failed extractions', async () => {
      await adminHelpers.navigateToAdminSection('tables');

      // Mock failed extraction
      await adminHelpers.mockAPI('/api/admin/tables', {
        tables: [{
          id: 'failed-table',
          title: 'Failed Extraction',
          status: 'extraction_failed',
          errorMessage: 'Extraction timeout'
        }]
      });

      await adminHelpers.page.reload();

      // Click retry extraction
      const retryButton = adminHelpers.page.locator('[data-testid="button-retry-extraction-failed-table"]');
      await retryButton.click();

      // Mock successful retry
      await adminHelpers.mockAPI('/api/admin/tables/failed-table/retry-extraction', {
        success: true,
        jobId: 'retry-job-123',
        message: 'Extraction retry queued'
      });

      // Confirm retry
      const confirmRetryButton = adminHelpers.page.locator('[data-testid="button-confirm-retry"]');
      await confirmRetryButton.click();

      // Verify retry success
      const retrySuccess = adminHelpers.page.locator('[data-testid="retry-success"]');
      await expect(retrySuccess).toContainText('Extraction retry queued');
    });

    test('should provide extraction statistics and insights', async () => {
      await adminHelpers.navigateToAdminSection('tables');

      // Mock extraction statistics
      await adminHelpers.mockAPI('/api/admin/tables/stats', {
        totalTables: 150,
        byStatus: {
          pending_review: 25,
          approved: 100,
          rejected: 15,
          extraction_failed: 10
        },
        qualityMetrics: {
          averageConfidence: 0.82,
          tablesWithIssues: 30,
          commonIssues: [
            { issue: 'missing_headers', count: 12 },
            { issue: 'empty_cells', count: 8 },
            { issue: 'formatting_issues', count: 10 }
          ]
        },
        extractionTrends: {
          successRate: 0.87,
          averageProcessingTime: 45.2,
          improvementSuggestions: [
            'Consider preprocessing PDFs with OCR',
            'Implement better table boundary detection'
          ]
        }
      });

      // Navigate to statistics view
      const statsButton = adminHelpers.page.locator('[data-testid="button-view-stats"]');
      await statsButton.click();

      // Verify statistics display
      const statsPanel = adminHelpers.page.locator('[data-testid="extraction-stats"]');
      await expect(statsPanel).toBeVisible();
      await expect(statsPanel).toContainText('150 total tables');
      await expect(statsPanel).toContainText('87% success rate');
      await expect(statsPanel).toContainText('82% average confidence');

      // Verify quality insights
      const qualityInsights = adminHelpers.page.locator('[data-testid="quality-insights"]');
      await expect(qualityInsights).toContainText('30 tables have quality issues');
      await expect(qualityInsights).toContainText('missing_headers (12)');

      // Verify improvement suggestions
      const suggestions = adminHelpers.page.locator('[data-testid="improvement-suggestions"]');
      await expect(suggestions).toContainText('Consider preprocessing PDFs with OCR');
    });
  });
});

/**
 * Helper function to create test PDFs with tables
 */
async function createTestPDFsWithTables() {
  const testDataDir = path.join(process.cwd(), 'e2e/test-data');
  
  try {
    await fs.mkdir(testDataDir, { recursive: true });
  } catch {
    // Directory already exists
  }

  // Create various test PDF files
  const testFiles = [
    'pdf-with-tables.pdf',
    'pdf-no-tables.pdf',
    'pdf-mixed-tables.pdf',
    'pdf-complex-tables.pdf',
    'pdf-medication-table.pdf',
    'image-only-tables.pdf'
  ];

  for (const fileName of testFiles) {
    const filePath = path.join(testDataDir, fileName);
    try {
      await fs.access(filePath);
    } catch {
      // File doesn't exist, create mock PDF
      const pdfContent = generateTestData.mockPdfBuffer();
      await fs.writeFile(filePath, pdfContent);
    }
  }
}