import { test, expect } from '@playwright/test';
import { AuthHelpers, AdminHelpers, FileUploadHelpers } from './utils/test-helpers';
import { TEST_USERS, TEST_FILES, SELECTORS, TIMEOUTS, generateTestData } from './test-data/fixtures';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Integration and End-to-End Workflow E2E Tests
 * 
 * Tests complete user journeys and cross-feature integration:
 * - Complete User Journey: Upload assessment → view results → access resources → track progress
 * - Admin Workflow: Upload document → extract tables → review → approve → search
 * - Cross-Feature Integration: Test how different systems work together
 * - Performance: Test system responsiveness under load
 * - Error Recovery: Test system behavior during failures
 */

test.describe('Integration and End-to-End Workflows', () => {
  let authHelpers: AuthHelpers;
  let adminHelpers: AdminHelpers;
  let uploadHelpers: FileUploadHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    adminHelpers = new AdminHelpers(page);
    uploadHelpers = new FileUploadHelpers(page);
    authHelpers.setupConsoleLogging();
  });

  test.afterEach(async () => {
    await authHelpers.clearMocks();
  });

  test.describe('Complete User Journey', () => {
    test('should handle full student workflow from guest to results', async ({ page }) => {
      // Step 1: Start as guest user
      await authHelpers.navigateTo('/');
      
      // Verify homepage displays properly
      const welcomeMessage = authHelpers.page.locator('[data-testid="welcome-message"]');
      await expect(welcomeMessage).toBeVisible();

      // Step 2: Upload assessment as guest
      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/test-assessment.pdf');
      await fs.writeFile(testPdfPath, generateTestData.mockPdfBuffer());

      // Mock guest upload
      await authHelpers.mockAPI('/api/assessment-reports', {
        reportId: 'guest-report-123',
        studentName: 'Guest User',
        overallScore: 75.5,
        topics: [
          {
            name: 'Cardiovascular Nursing',
            score: 70,
            priority: 'high',
            studyTime: 60,
            resourcesAvailable: 8
          },
          {
            name: 'Respiratory Care',
            score: 82,
            priority: 'medium',
            studyTime: 45,
            resourcesAvailable: 5
          }
        ],
        guestSession: 'guest_session_123'
      });

      await uploadHelpers.uploadWithDragDrop(testPdfPath);
      
      // Wait for processing and redirect to results
      await authHelpers.page.waitForURL('**/mvp-action-plan/**');

      // Step 3: View results and discover registration benefits
      const resultsPage = authHelpers.page.locator('[data-testid="assessment-results"]');
      await expect(resultsPage).toBeVisible();
      await expect(resultsPage).toContainText('75.5%');

      // Verify guest limitations message
      const guestLimitations = authHelpers.page.locator('[data-testid="guest-limitations"]');
      await expect(guestLimitations).toContainText('Register to unlock additional features');

      // Step 4: Register to unlock features
      const registerButton = authHelpers.page.locator('[data-testid="button-register-unlock"]');
      await registerButton.click();

      // Complete registration flow
      const testUser = {
        email: generateTestData.randomEmail(),
        firstName: 'Test',
        lastName: 'Student',
        school: 'Test Nursing School'
      };

      await authHelpers.mockAPI('/api/auth/send-code', { message: 'Code sent' });
      await authHelpers.mockAPI('/api/auth/verify-code', {
        user: testUser,
        token: 'auth-token-123',
        migratedData: {
          assessmentResults: ['guest-report-123'],
          preservedProgress: true
        }
      });

      await authHelpers.fillAndVerifyField('[data-testid="input-register-email"]', testUser.email);
      await authHelpers.fillAndVerifyField('[data-testid="input-register-firstName"]', testUser.firstName);
      await authHelpers.fillAndVerifyField('[data-testid="input-register-lastName"]', testUser.lastName);
      await authHelpers.fillAndVerifyField('[data-testid="input-register-school"]', testUser.school);
      await authHelpers.clickAndWait('[data-testid="button-register-submit"]');

      // Enter verification code
      await authHelpers.fillAndVerifyField('[data-testid="input-verification-code"]', '123456');
      await authHelpers.clickAndWait('[data-testid="button-verify-code"]');

      // Should redirect to enhanced dashboard
      await authHelpers.page.waitForURL('**/dashboard');

      // Step 5: Access enhanced features as registered user
      const enhancedDashboard = authHelpers.page.locator('[data-testid="enhanced-dashboard"]');
      await expect(enhancedDashboard).toBeVisible();

      // Verify preserved assessment data
      const preservedAssessment = authHelpers.page.locator('[data-testid="assessment-guest-report-123"]');
      await expect(preservedAssessment).toBeVisible();
      await expect(preservedAssessment).toContainText('Cardiovascular Nursing');

      // Step 6: Access personalized study resources
      const studyResourcesSection = authHelpers.page.locator('[data-testid="study-resources"]');
      await expect(studyResourcesSection).toBeVisible();

      const cardiovascularResources = authHelpers.page.locator('[data-testid="resources-cardiovascular"]');
      await expect(cardiovascularResources).toContainText('8 resources available');

      // Step 7: Track progress over time
      const progressTracker = authHelpers.page.locator('[data-testid="progress-tracker"]');
      await expect(progressTracker).toBeVisible();
      await expect(progressTracker).toContainText('Study Time: 105 minutes recommended');

      // Clean up
      await fs.unlink(testPdfPath).catch(() => {});
    });

    test('should handle user journey with magic link authentication', async () => {
      // Step 1: Start at login page
      await authHelpers.navigateTo('/login');

      const email = generateTestData.randomEmail();

      // Step 2: Request magic link
      await authHelpers.loginWithMagicLink(email);

      // Step 3: Simulate clicking magic link in email
      const mockUser = {
        id: '1',
        email: email,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'student'
      };

      await authHelpers.verifyMagicLink('valid-token-123', mockUser);

      // Should be on dashboard
      expect(authHelpers.page.url()).toContain('/dashboard');

      // Step 4: Upload new assessment
      const uploadSection = authHelpers.page.locator('[data-testid="upload-section"]');
      await expect(uploadSection).toBeVisible();

      // Mock authenticated upload
      await authHelpers.mockAPI('/api/assessment-reports', {
        reportId: 'auth-report-456',
        studentName: `${mockUser.firstName} ${mockUser.lastName}`,
        userId: mockUser.id,
        overallScore: 88.2
      });

      const testPdfPath = path.join(process.cwd(), 'e2e/test-data/auth-assessment.pdf');
      await fs.writeFile(testPdfPath, generateTestData.mockPdfBuffer());

      await uploadHelpers.uploadWithDragDrop(testPdfPath);

      // Step 5: View comprehensive results
      await authHelpers.page.waitForURL('**/mvp-action-plan/**');

      const authResults = authHelpers.page.locator('[data-testid="authenticated-results"]');
      await expect(authResults).toBeVisible();
      await expect(authResults).toContainText('Test User'); // Shows real name
      await expect(authResults).toContainText('88.2%');

      // Should have access to all features without limitations
      const fullFeatureAccess = authHelpers.page.locator('[data-testid="full-feature-access"]');
      await expect(fullFeatureAccess).toBeVisible();

      await fs.unlink(testPdfPath).catch(() => {});
    });

    test('should handle cross-session data persistence', async () => {
      const email = generateTestData.randomEmail();
      const mockUser = {
        id: '1',
        email: email,
        firstName: 'Persistent',
        lastName: 'User'
      };

      // Session 1: Login and upload assessment
      await authHelpers.verifyMagicLink('session1-token', mockUser);
      
      await authHelpers.mockAPI('/api/assessment-reports', {
        reportId: 'persistent-report-1',
        userId: mockUser.id,
        topics: [{ name: 'Topic A', score: 75 }]
      });

      const testPdf1 = path.join(process.cwd(), 'e2e/test-data/session1.pdf');
      await fs.writeFile(testPdf1, generateTestData.mockPdfBuffer());
      await uploadHelpers.uploadWithDragDrop(testPdf1);

      // Simulate session end
      await authHelpers.logout();

      // Session 2: Login again and verify data persistence
      await authHelpers.verifyMagicLink('session2-token', mockUser);

      // Mock dashboard with historical data
      await authHelpers.mockAPI('/api/dashboard', {
        user: mockUser,
        assessmentHistory: [
          {
            id: 'persistent-report-1',
            date: '2024-01-15',
            overallScore: 75,
            topicsCount: 1
          }
        ],
        progressData: {
          totalStudyTime: 45,
          improvementTrend: 'positive'
        }
      });

      await authHelpers.navigateTo('/dashboard');

      // Verify historical data is displayed
      const historySection = authHelpers.page.locator('[data-testid="assessment-history"]');
      await expect(historySection).toContainText('persistent-report-1');
      await expect(historySection).toContainText('75%');

      const progressSection = authHelpers.page.locator('[data-testid="progress-overview"]');
      await expect(progressSection).toContainText('45 minutes');

      // Upload new assessment
      await authHelpers.mockAPI('/api/assessment-reports', {
        reportId: 'persistent-report-2',
        userId: mockUser.id,
        overallScore: 82,
        improvement: {
          compared_to: 'persistent-report-1',
          score_change: '+7',
          trend: 'improving'
        }
      });

      const testPdf2 = path.join(process.cwd(), 'e2e/test-data/session2.pdf');
      await fs.writeFile(testPdf2, generateTestData.mockPdfBuffer());
      await uploadHelpers.uploadWithDragDrop(testPdf2);

      // Verify improvement tracking
      await authHelpers.page.waitForURL('**/mvp-action-plan/**');
      const improvementIndicator = authHelpers.page.locator('[data-testid="improvement-indicator"]');
      await expect(improvementIndicator).toContainText('+7 points improvement');

      // Clean up
      await fs.unlink(testPdf1).catch(() => {});
      await fs.unlink(testPdf2).catch(() => {});
    });
  });

  test.describe('Admin Workflow Integration', () => {
    test('should handle complete admin document processing workflow', async () => {
      // Step 1: Admin login
      await adminHelpers.loginAsAdmin(TEST_USERS.ADMIN.email, TEST_USERS.ADMIN.password);

      // Step 2: Upload document with tables to Knowledge Base
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock document upload with table extraction
      await adminHelpers.mockAPI('/api/admin/knowledge-base/upload', {
        success: true,
        documentId: 'admin-doc-123',
        jobId: 'extract-job-456',
        tablesDetected: 2,
        extractedTables: [
          {
            id: 'table-1',
            title: 'Lab Reference Values',
            confidence: 0.92,
            status: 'pending_review'
          },
          {
            id: 'table-2', 
            title: 'Medication Interactions',
            confidence: 0.88,
            status: 'pending_review'
          }
        ]
      });

      const testDocPath = path.join(process.cwd(), 'e2e/test-data/admin-upload.pdf');
      await fs.writeFile(testDocPath, generateTestData.mockPdfBuffer());

      await adminHelpers.clickAndWait('[data-testid="button-kb-upload"]');
      await uploadHelpers.uploadFile('[data-testid="kb-file-input"]', testDocPath);

      // Wait for processing completion
      await adminHelpers.waitForVisible('[data-testid="upload-success"]');

      // Verify tables detected
      const tablesDetected = adminHelpers.page.locator('[data-testid="tables-detected"]');
      await expect(tablesDetected).toContainText('2 tables detected');

      // Step 3: Navigate to table review
      await adminHelpers.navigateToAdminSection('tables');

      // Mock pending tables
      await adminHelpers.mockAPI('/api/admin/tables', {
        tables: [
          {
            id: 'table-1',
            title: 'Lab Reference Values',
            status: 'pending_review',
            confidence: 0.92,
            documentTitle: 'Admin Document'
          }
        ]
      });

      await adminHelpers.page.reload();

      // Step 4: Review and approve table
      const reviewButton = adminHelpers.page.locator('[data-testid="button-review-table-1"]');
      await reviewButton.click();

      // Mock table content
      await adminHelpers.mockAPI('/api/admin/tables/table-1/cells', {
        tableId: 'table-1',
        cells: [
          [
            { content: 'Test', rowIndex: 0, columnIndex: 0, isHeader: true },
            { content: 'Normal Range', rowIndex: 0, columnIndex: 1, isHeader: true }
          ],
          [
            { content: 'Glucose', rowIndex: 1, columnIndex: 0 },
            { content: '70-100 mg/dL', rowIndex: 1, columnIndex: 1 }
          ]
        ]
      });

      // Approve table with topic mapping
      await adminHelpers.fillAndVerifyField('[data-testid="textarea-approval-notes"]', 'Lab values verified as accurate');
      await adminHelpers.page.locator('[data-testid="select-topic-mapping"]').selectOption('laboratory-values');

      await adminHelpers.mockAPI('/api/admin/tables/approve', {
        success: true,
        message: 'Table approved and indexed for search'
      });

      await adminHelpers.clickAndWait('[data-testid="button-approve-table"]');

      // Verify approval success
      const approvalSuccess = adminHelpers.page.locator('[data-testid="approval-success"]');
      await expect(approvalSuccess).toContainText('Table approved and indexed for search');

      // Step 5: Test searchability in Knowledge Base
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Mock search including approved table content
      await adminHelpers.mockAPI('/api/admin/knowledge-base/search*', {
        results: [
          {
            id: 'table-result-1',
            content: 'Glucose Normal Range: 70-100 mg/dL',
            score: 0.95,
            sourceType: 'extracted_table',
            tableId: 'table-1',
            tableTitle: 'Lab Reference Values',
            highlighted: '<mark>Glucose</mark> Normal Range: 70-100 mg/dL'
          }
        ],
        query: 'glucose normal range'
      });

      await adminHelpers.fillAndVerifyField('[data-testid="input-kb-search"]', 'glucose normal range');
      await adminHelpers.clickAndWait('[data-testid="button-kb-search"]');

      // Verify table content appears in search results
      const searchResults = adminHelpers.page.locator('[data-testid="search-results"]');
      await expect(searchResults).toBeVisible();
      await expect(searchResults).toContainText('Lab Reference Values');
      await expect(searchResults).toContainText('70-100 mg/dL');

      // Step 6: Verify end-to-end workflow completion
      const workflowComplete = adminHelpers.page.locator('[data-testid="search-result-table-result-1"]');
      await expect(workflowComplete).toHaveClass(/result-from-table/);

      await fs.unlink(testDocPath).catch(() => {});
    });

    test('should handle admin resource management to student access workflow', async () => {
      // Step 1: Admin creates resources
      await adminHelpers.loginAsAdmin(TEST_USERS.ADMIN.email, TEST_USERS.ADMIN.password);
      await adminHelpers.navigateToAdminSection('resources');

      // Create resource linked to topic
      await adminHelpers.mockAPI('/api/admin/resources', {
        success: true,
        resourceId: 'resource-cardiovascular-123'
      });

      await adminHelpers.clickAndWait('[data-testid="button-create-resource"]');
      await adminHelpers.fillAndVerifyField('[data-testid="input-resource-title"]', 'Advanced Cardiac Assessment Video');
      await adminHelpers.fillAndVerifyField('[data-testid="input-resource-url"]', 'https://example.com/cardiac-video');
      await adminHelpers.page.locator('[data-testid="select-resource-type"]').selectOption('video');
      await adminHelpers.page.locator('[data-testid="select-topic"]').selectOption('cardiovascular');
      await adminHelpers.clickAndWait('[data-testid="button-submit-resource"]');

      // Step 2: Simulate student workflow that would surface this resource
      await authHelpers.logout();

      // Student uploads assessment
      const mockUser = { 
        id: '2',
        email: 'student@example.com', 
        firstName: 'Student',
        lastName: 'User' 
      };

      await authHelpers.verifyMagicLink('student-token', mockUser);

      // Mock assessment results that trigger cardiovascular recommendations
      await authHelpers.mockAPI('/api/assessment-reports', {
        reportId: 'student-assessment-123',
        userId: mockUser.id,
        topics: [
          {
            name: 'Cardiovascular Nursing',
            score: 65,
            priority: 'high',
            recommendedResources: [
              {
                id: 'resource-cardiovascular-123',
                title: 'Advanced Cardiac Assessment Video',
                type: 'video',
                relevanceScore: 0.95,
                url: 'https://example.com/cardiac-video'
              }
            ]
          }
        ]
      });

      const studentPdf = path.join(process.cwd(), 'e2e/test-data/student-cardiac.pdf');
      await fs.writeFile(studentPdf, generateTestData.mockPdfBuffer());
      await uploadHelpers.uploadWithDragDrop(studentPdf);

      // Step 3: Verify resource appears in student results
      await authHelpers.page.waitForURL('**/mvp-action-plan/**');

      const recommendedResources = authHelpers.page.locator('[data-testid="recommended-resources-cardiovascular"]');
      await expect(recommendedResources).toBeVisible();
      await expect(recommendedResources).toContainText('Advanced Cardiac Assessment Video');
      await expect(recommendedResources).toContainText('95% match');

      // Student can access the resource
      const resourceLink = authHelpers.page.locator('[data-testid="resource-link-resource-cardiovascular-123"]');
      await expect(resourceLink).toHaveAttribute('href', 'https://example.com/cardiac-video');

      await fs.unlink(studentPdf).catch(() => {});
    });

    test('should handle topics queue resolution workflow', async () => {
      // Step 1: System identifies topics needing resources
      await adminHelpers.loginAsAdmin(TEST_USERS.ADMIN.email, TEST_USERS.ADMIN.password);
      await adminHelpers.navigateToAdminSection('topics-queue');

      // Mock high-demand topic
      await adminHelpers.mockAPI('/api/admin/topics-queue', {
        topics: [
          {
            id: 'topic-respiratory-care',
            name: 'Respiratory Care Techniques',
            priority: 'high',
            status: 'pending',
            demandScore: 92,
            studentRequests: 15,
            resourceGap: 'simulation_exercises'
          }
        ]
      });

      await adminHelpers.page.reload();

      // Step 2: Admin reviews topic details
      await adminHelpers.mockAPI('/api/admin/topics-queue/topic-respiratory-care/details', {
        id: 'topic-respiratory-care',
        name: 'Respiratory Care Techniques',
        studentQuestions: [
          'How to perform chest physiotherapy?',
          'When to use different oxygen delivery methods?',
          'Ventilator troubleshooting procedures?'
        ],
        gapAnalysis: {
          missingResourceTypes: ['interactive_simulation', 'video_demonstration'],
          currentResources: 3,
          recommendedResources: 8
        }
      });

      const viewDetailsButton = adminHelpers.page.locator('[data-testid="button-view-details-topic-respiratory-care"]');
      await viewDetailsButton.click();

      // Verify gap analysis
      const gapAnalysis = adminHelpers.page.locator('[data-testid="gap-analysis"]');
      await expect(gapAnalysis).toContainText('interactive_simulation');
      await expect(gapAnalysis).toContainText('Current: 3 resources');
      await expect(gapAnalysis).toContainText('Recommended: 8 resources');

      // Step 3: Admin creates resources to fill gap
      const createResourceFromTopicButton = adminHelpers.page.locator('[data-testid="button-create-resource-from-topic"]');
      await createResourceFromTopicButton.click();

      // Pre-filled form based on topic analysis
      const resourceForm = adminHelpers.page.locator('[data-testid="resource-form-from-topic"]');
      await expect(resourceForm).toBeVisible();
      
      const titleInput = adminHelpers.page.locator('[data-testid="input-resource-title"]');
      await expect(titleInput).toHaveValue('Respiratory Care Techniques');

      const topicSelect = adminHelpers.page.locator('[data-testid="select-topic"]');
      await expect(topicSelect).toHaveValue('respiratory-care');

      // Step 4: Bulk create multiple resources
      await adminHelpers.mockAPI('/api/admin/resources/bulk-create-from-topic', {
        success: true,
        created: 5,
        resources: [
          { id: 'resp-1', title: 'Chest Physiotherapy Simulation', type: 'simulation' },
          { id: 'resp-2', title: 'Oxygen Delivery Methods Video', type: 'video' },
          { id: 'resp-3', title: 'Ventilator Troubleshooting Guide', type: 'guide' }
        ]
      });

      const bulkCreateButton = adminHelpers.page.locator('[data-testid="button-bulk-create-resources"]');
      await bulkCreateButton.click();

      // Verify bulk creation success
      const bulkSuccess = adminHelpers.page.locator('[data-testid="bulk-creation-success"]');
      await expect(bulkSuccess).toContainText('5 resources created');

      // Step 5: Mark topic as resolved
      await adminHelpers.mockAPI('/api/admin/topics-queue/topic-respiratory-care/resolve', {
        success: true,
        message: 'Topic marked as resolved'
      });

      const resolveButton = adminHelpers.page.locator('[data-testid="button-resolve-topic"]');
      await resolveButton.click();

      await adminHelpers.fillAndVerifyField('[data-testid="textarea-resolution-notes"]', 'Added 5 new resources including simulations and video demonstrations');
      await adminHelpers.clickAndWait('[data-testid="button-confirm-resolve"]');

      // Step 6: Verify resources are now available to students
      await authHelpers.logout();
      
      const studentUser = { id: '3', email: 'student2@example.com' };
      await authHelpers.verifyMagicLink('student2-token', studentUser);

      await authHelpers.mockAPI('/api/assessment-reports', {
        topics: [{
          name: 'Respiratory Care',
          score: 70,
          priority: 'high',
          recommendedResources: [
            { title: 'Chest Physiotherapy Simulation', type: 'simulation' },
            { title: 'Oxygen Delivery Methods Video', type: 'video' }
          ]
        }]
      });

      const studentPdf = path.join(process.cwd(), 'e2e/test-data/resp-assessment.pdf');
      await fs.writeFile(studentPdf, generateTestData.mockPdfBuffer());
      await uploadHelpers.uploadWithDragDrop(studentPdf);

      await authHelpers.page.waitForURL('**/mvp-action-plan/**');

      // Verify new resources appear in recommendations
      const respiratoryResources = authHelpers.page.locator('[data-testid="recommended-resources-respiratory"]');
      await expect(respiratoryResources).toContainText('Chest Physiotherapy Simulation');
      await expect(respiratoryResources).toContainText('Oxygen Delivery Methods Video');

      await fs.unlink(studentPdf).catch(() => {});
    });
  });

  test.describe('Cross-Feature Integration', () => {
    test('should integrate authentication state across all features', async () => {
      const testUser = {
        id: '1',
        email: 'integration@example.com',
        firstName: 'Integration',
        lastName: 'User',
        role: 'student'
      };

      // Login once
      await authHelpers.verifyMagicLink('integration-token', testUser);

      // Test 1: Dashboard shows authenticated state
      await authHelpers.navigateTo('/dashboard');
      const userInfo = authHelpers.page.locator('[data-testid="user-info"]');
      await expect(userInfo).toContainText('Integration User');

      // Test 2: File upload preserves user context
      await authHelpers.mockAPI('/api/assessment-reports', {
        reportId: 'integrated-report',
        userId: testUser.id,
        studentName: `${testUser.firstName} ${testUser.lastName}`
      });

      const testPdf = path.join(process.cwd(), 'e2e/test-data/integrated.pdf');
      await fs.writeFile(testPdf, generateTestData.mockPdfBuffer());
      await uploadHelpers.uploadWithDragDrop(testPdf);

      await authHelpers.page.waitForURL('**/mvp-action-plan/**');
      const resultHeader = authHelpers.page.locator('[data-testid="result-header"]');
      await expect(resultHeader).toContainText('Integration User');

      // Test 3: Navigation maintains session
      await authHelpers.navigateTo('/dashboard');
      const navUser = authHelpers.page.locator('[data-testid="nav-user-name"]');
      await expect(navUser).toContainText('Integration User');

      // Test 4: Session persists across page refreshes
      await authHelpers.page.reload();
      await authHelpers.mockAPI('/api/auth/me', testUser);
      
      await expect(userInfo).toContainText('Integration User');

      await fs.unlink(testPdf).catch(() => {});
    });

    test('should integrate file upload with progress tracking and results', async () => {
      const testUser = { id: '1', email: 'test@example.com', firstName: 'Test' };
      await authHelpers.verifyMagicLink('test-token', testUser);

      // Mock multi-stage upload with detailed progress
      let uploadStage = 'validation';
      let progressValue = 0;

      await authHelpers.page.route('/api/assessment-reports', async (route) => {
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        switch (uploadStage) {
          case 'validation':
            await delay(500);
            uploadStage = 'upload';
            progressValue = 20;
            route.fulfill({
              status: 202,
              body: JSON.stringify({
                stage: 'validation',
                progress: progressValue,
                message: 'Validating file format...'
              })
            });
            break;
            
          case 'upload':
            await delay(1000);
            uploadStage = 'processing';
            progressValue = 60;
            route.fulfill({
              status: 202,
              body: JSON.stringify({
                stage: 'upload',
                progress: progressValue,
                message: 'Uploading PDF...'
              })
            });
            break;
            
          case 'processing':
            await delay(1500);
            uploadStage = 'analysis';
            progressValue = 85;
            route.fulfill({
              status: 202,
              body: JSON.stringify({
                stage: 'processing',
                progress: progressValue,
                message: 'Processing document...'
              })
            });
            break;
            
          case 'analysis':
            await delay(800);
            route.fulfill({
              status: 200,
              body: JSON.stringify({
                reportId: 'progress-test-123',
                userId: testUser.id,
                stage: 'complete',
                progress: 100,
                overallScore: 84.5,
                processingTime: 3.8,
                topics: [
                  { name: 'Topic A', score: 80, priority: 'high' },
                  { name: 'Topic B', score: 89, priority: 'medium' }
                ]
              })
            });
            break;
        }
      });

      // Upload file and monitor progress
      const testPdf = path.join(process.cwd(), 'e2e/test-data/progress-test.pdf');
      await fs.writeFile(testPdf, generateTestData.mockPdfBuffer());
      await uploadHelpers.uploadWithDragDrop(testPdf);

      // Verify progress stages
      const progressIndicator = authHelpers.page.locator('[data-testid="upload-progress"]');
      await expect(progressIndicator).toBeVisible();

      // Monitor progress updates
      const stageIndicators = [
        '[data-testid="stage-validation"]',
        '[data-testid="stage-upload"]', 
        '[data-testid="stage-processing"]',
        '[data-testid="stage-analysis"]'
      ];

      for (const stage of stageIndicators) {
        await authHelpers.waitForVisible(stage, TIMEOUTS.LONG);
      }

      // Verify completion and redirect
      await authHelpers.page.waitForURL('**/mvp-action-plan/**', { timeout: TIMEOUTS.LONG });
      
      // Verify results integration
      const finalResults = authHelpers.page.locator('[data-testid="assessment-results"]');
      await expect(finalResults).toContainText('84.5%');
      await expect(finalResults).toContainText('Processing completed in 3.8 seconds');

      await fs.unlink(testPdf).catch(() => {});
    });

    test('should integrate error handling across all systems', async () => {
      const testUser = { id: '1', email: 'error-test@example.com' };
      await authHelpers.verifyMagicLink('error-test-token', testUser);

      // Test cascading error handling
      
      // Step 1: Simulate network error during upload
      await authHelpers.simulateNetworkFailure('/api/assessment-reports');

      const testPdf = path.join(process.cwd(), 'e2e/test-data/error-test.pdf');
      await fs.writeFile(testPdf, generateTestData.mockPdfBuffer());
      await uploadHelpers.uploadWithDragDrop(testPdf);

      // Verify upload error handling
      const uploadError = authHelpers.page.locator('[data-testid="upload-error"]');
      await expect(uploadError).toBeVisible();
      await expect(uploadError).toContainText('Upload failed');

      // Verify retry functionality
      const retryButton = authHelpers.page.locator('[data-testid="button-retry-upload"]');
      await expect(retryButton).toBeVisible();

      // Step 2: Restore network and test successful retry
      await authHelpers.clearMocks();
      await authHelpers.mockAPI('/api/assessment-reports', {
        reportId: 'retry-success-123',
        message: 'Upload successful after retry'
      });

      await retryButton.click();

      // Verify retry success
      const retrySuccess = authHelpers.page.locator('[data-testid="retry-success"]');
      await expect(retrySuccess).toBeVisible();

      // Step 3: Test error recovery in search
      await adminHelpers.loginAsAdmin(TEST_USERS.ADMIN.email, TEST_USERS.ADMIN.password);
      await adminHelpers.navigateToAdminSection('knowledge-base');

      // Simulate search service error
      await adminHelpers.mockAPI('/api/admin/knowledge-base/search*', {
        error: 'Search service temporarily unavailable'
      }, 503);

      await adminHelpers.fillAndVerifyField('[data-testid="input-kb-search"]', 'test query');
      await adminHelpers.clickAndWait('[data-testid="button-kb-search"]');

      // Verify search error handling
      const searchError = authHelpers.page.locator('[data-testid="search-error"]');
      await expect(searchError).toContainText('Search service temporarily unavailable');

      // Verify graceful degradation
      const fallbackMessage = authHelpers.page.locator('[data-testid="search-fallback"]');
      await expect(fallbackMessage).toContainText('You can still browse documents');

      await fs.unlink(testPdf).catch(() => {});
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('should handle concurrent user uploads', async ({ context }) => {
      // Create multiple pages to simulate concurrent users
      const pages = await Promise.all([
        context.newPage(),
        context.newPage(),
        context.newPage()
      ]);

      const users = [
        { id: '1', email: 'user1@example.com', token: 'token1' },
        { id: '2', email: 'user2@example.com', token: 'token2' },
        { id: '3', email: 'user3@example.com', token: 'token3' }
      ];

      // Setup concurrent uploads
      const uploadPromises = pages.map(async (page, index) => {
        const userHelpers = new AuthHelpers(page);
        const userUploadHelpers = new FileUploadHelpers(page);
        
        // Mock user authentication
        await userHelpers.mockAPI('/api/auth/verify-magic-link', {
          user: users[index],
          token: `jwt-${users[index].token}`
        });

        await userHelpers.navigateTo(`/verify-magic-link?token=${users[index].token}`);
        await page.waitForURL('**/dashboard');

        // Mock concurrent upload responses
        await userHelpers.mockAPI('/api/assessment-reports', {
          reportId: `concurrent-report-${index + 1}`,
          userId: users[index].id,
          processingTime: Math.random() * 2 + 1, // 1-3 seconds
          overallScore: Math.random() * 30 + 70 // 70-100%
        });

        // Upload file
        const testPdf = path.join(process.cwd(), `e2e/test-data/concurrent-${index}.pdf`);
        await fs.writeFile(testPdf, generateTestData.mockPdfBuffer());
        
        const startTime = Date.now();
        await userUploadHelpers.uploadWithDragDrop(testPdf);
        
        // Wait for completion
        await page.waitForURL('**/mvp-action-plan/**', { timeout: TIMEOUTS.LONG });
        const endTime = Date.now();

        return {
          userId: users[index].id,
          processingTime: endTime - startTime,
          success: true
        };
      });

      // Execute concurrent uploads
      const results = await Promise.all(uploadPromises);

      // Verify all uploads completed successfully
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.processingTime).toBeLessThan(TIMEOUTS.LONG);
      });

      // Clean up
      for (let i = 0; i < 3; i++) {
        const testPdf = path.join(process.cwd(), `e2e/test-data/concurrent-${i}.pdf`);
        await fs.unlink(testPdf).catch(() => {});
      }

      await Promise.all(pages.map(page => page.close()));
    });

    test('should maintain responsiveness under load', async () => {
      const testUser = { id: '1', email: 'load-test@example.com' };
      await authHelpers.verifyMagicLink('load-token', testUser);

      // Simulate high server load with delayed responses
      await authHelpers.page.route('**/api/**', async (route) => {
        // Add random delay to simulate server load
        const delay = Math.random() * 1000 + 500; // 500-1500ms
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Continue with normal handling
        route.continue();
      });

      // Test UI responsiveness during load
      await authHelpers.navigateTo('/dashboard');

      const startTime = Date.now();

      // Test navigation responsiveness
      const navItems = [
        '[data-testid="nav-dashboard"]',
        '[data-testid="nav-upload"]',
        '[data-testid="nav-profile"]'
      ];

      for (const navItem of navItems) {
        const navStart = Date.now();
        await authHelpers.page.locator(navItem).click();
        const navEnd = Date.now();
        
        // Navigation should remain responsive (< 2 seconds)
        expect(navEnd - navStart).toBeLessThan(2000);
      }

      // Test form responsiveness
      const searchInput = authHelpers.page.locator('[data-testid="search-input"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('test query');
        
        // Input should be immediately responsive
        await expect(searchInput).toHaveValue('test query');
      }

      const totalTime = Date.now() - startTime;
      
      // Overall interaction should complete within reasonable time
      expect(totalTime).toBeLessThan(10000); // 10 seconds max
    });

    test('should handle large file uploads gracefully', async () => {
      const testUser = { id: '1', email: 'large-file@example.com' };
      await authHelpers.verifyMagicLink('large-file-token', testUser);

      // Create a larger mock PDF (simulate 5MB file)
      const largePdfContent = Buffer.concat([
        generateTestData.mockPdfBuffer(),
        Buffer.alloc(5 * 1024 * 1024, 'mock-content') // 5MB padding
      ]);

      const largePdfPath = path.join(process.cwd(), 'e2e/test-data/large-file.pdf');
      await fs.writeFile(largePdfPath, largePdfContent);

      // Mock upload with realistic processing times for large files
      await authHelpers.mockAPI('/api/assessment-reports', {
        reportId: 'large-file-123',
        processingTime: 8.5,
        fileSize: '5.2MB',
        message: 'Large file processed successfully'
      });

      // Test upload with progress monitoring
      const uploadStart = Date.now();
      await uploadHelpers.uploadWithDragDrop(largePdfPath);

      // Monitor upload progress for large file
      const progressBar = authHelpers.page.locator('[data-testid="upload-progress"]');
      await expect(progressBar).toBeVisible();

      // Verify progress updates for large file
      const progressText = authHelpers.page.locator('[data-testid="upload-progress-text"]');
      await expect(progressText).toContainText('5.2MB');

      // Wait for completion
      await authHelpers.page.waitForURL('**/mvp-action-plan/**', { timeout: TIMEOUTS.FILE_UPLOAD });
      const uploadEnd = Date.now();

      // Verify large file handling
      const processingInfo = authHelpers.page.locator('[data-testid="processing-info"]');
      await expect(processingInfo).toContainText('8.5 seconds');

      // Verify upload completed within timeout
      expect(uploadEnd - uploadStart).toBeLessThan(TIMEOUTS.FILE_UPLOAD);

      await fs.unlink(largePdfPath).catch(() => {});
    });
  });

  test.describe('Error Recovery and Resilience', () => {
    test('should recover from temporary service outages', async () => {
      const testUser = { id: '1', email: 'resilience@example.com' };
      await authHelpers.verifyMagicLink('resilience-token', testUser);

      // Simulate temporary service outage
      let serviceDown = true;
      let attemptCount = 0;

      await authHelpers.page.route('/api/assessment-reports', async (route) => {
        attemptCount++;
        
        if (serviceDown && attemptCount < 3) {
          // Simulate service down for first 2 attempts
          route.fulfill({
            status: 503,
            body: JSON.stringify({
              error: 'Service temporarily unavailable',
              retryAfter: '1s'
            })
          });
        } else {
          // Service recovers on 3rd attempt
          serviceDown = false;
          route.fulfill({
            status: 200,
            body: JSON.stringify({
              reportId: 'recovery-success-123',
              message: 'Service recovered - upload successful'
            })
          });
        }
      });

      const testPdf = path.join(process.cwd(), 'e2e/test-data/recovery-test.pdf');
      await fs.writeFile(testPdf, generateTestData.mockPdfBuffer());

      // Attempt upload
      await uploadHelpers.uploadWithDragDrop(testPdf);

      // Verify initial failure
      const serviceError = authHelpers.page.locator('[data-testid="service-error"]');
      await expect(serviceError).toBeVisible();
      await expect(serviceError).toContainText('Service temporarily unavailable');

      // Verify retry mechanism
      const retryNotification = authHelpers.page.locator('[data-testid="retry-notification"]');
      await expect(retryNotification).toContainText('Retrying in');

      // Wait for automatic recovery
      const recoverySuccess = authHelpers.page.locator('[data-testid="recovery-success"]');
      await expect(recoverySuccess).toBeVisible({ timeout: TIMEOUTS.LONG });
      await expect(recoverySuccess).toContainText('Service recovered');

      // Verify final success
      await authHelpers.page.waitForURL('**/mvp-action-plan/**');
      const successResults = authHelpers.page.locator('[data-testid="assessment-results"]');
      await expect(successResults).toBeVisible();

      await fs.unlink(testPdf).catch(() => {});
    });

    test('should handle partial system failures gracefully', async () => {
      const testUser = { id: '1', email: 'partial-failure@example.com' };
      await authHelpers.verifyMagicLink('partial-failure-token', testUser);

      // Upload succeeds but some post-processing fails
      await authHelpers.mockAPI('/api/assessment-reports', {
        reportId: 'partial-failure-123',
        overallScore: 78,
        topics: [
          { name: 'Topic A', score: 80, processed: true },
          { name: 'Topic B', score: 76, processed: false, error: 'Resource matching failed' }
        ],
        warnings: [
          'Some advanced features may be limited due to processing issues',
          'Resource recommendations may be incomplete'
        ]
      });

      const testPdf = path.join(process.cwd(), 'e2e/test-data/partial-failure.pdf');
      await fs.writeFile(testPdf, generateTestData.mockPdfBuffer());
      await uploadHelpers.uploadWithDragDrop(testPdf);

      await authHelpers.page.waitForURL('**/mvp-action-plan/**');

      // Verify partial success display
      const resultsPage = authHelpers.page.locator('[data-testid="assessment-results"]');
      await expect(resultsPage).toBeVisible();
      await expect(resultsPage).toContainText('78%');

      // Verify warnings about partial failure
      const warningSection = authHelpers.page.locator('[data-testid="processing-warnings"]');
      await expect(warningSection).toBeVisible();
      await expect(warningSection).toContainText('Some advanced features may be limited');

      // Verify successful topics still display
      const topicA = authHelpers.page.locator('[data-testid="topic-topic-a"]');
      await expect(topicA).toBeVisible();
      await expect(topicA).toContainText('80%');

      // Verify failed topics show error state
      const topicB = authHelpers.page.locator('[data-testid="topic-topic-b"]');
      await expect(topicB).toHaveClass(/topic-error/);
      await expect(topicB).toContainText('Resource matching failed');

      await fs.unlink(testPdf).catch(() => {});
    });

    test('should maintain data integrity during failures', async () => {
      const testUser = { id: '1', email: 'integrity@example.com' };
      await authHelpers.verifyMagicLink('integrity-token', testUser);

      // Mock database transaction failure during upload
      await authHelpers.mockAPI('/api/assessment-reports', {
        error: 'Database transaction failed',
        details: {
          stage: 'saving_results',
          dataIntegrity: 'maintained',
          rollback: 'successful',
          temporaryFiles: 'cleaned'
        }
      }, 500);

      const testPdf = path.join(process.cwd(), 'e2e/test-data/integrity-test.pdf');
      await fs.writeFile(testPdf, generateTestData.mockPdfBuffer());
      await uploadHelpers.uploadWithDragDrop(testPdf);

      // Verify error handling maintains integrity
      const integrityError = authHelpers.page.locator('[data-testid="database-error"]');
      await expect(integrityError).toBeVisible();
      await expect(integrityError).toContainText('Database transaction failed');

      // Verify data integrity message
      const integrityMessage = authHelpers.page.locator('[data-testid="data-integrity-message"]');
      await expect(integrityMessage).toContainText('Your data remains secure');
      await expect(integrityMessage).toContainText('No partial data was saved');

      // Verify user can retry safely
      const safeRetryButton = authHelpers.page.locator('[data-testid="button-safe-retry"]');
      await expect(safeRetryButton).toBeVisible();
      await expect(safeRetryButton).toContainText('Retry Upload');

      // Mock successful retry
      await authHelpers.mockAPI('/api/assessment-reports', {
        reportId: 'integrity-success-123',
        message: 'Upload completed successfully after retry'
      });

      await safeRetryButton.click();

      // Verify successful completion
      await authHelpers.page.waitForURL('**/mvp-action-plan/**');
      const successPage = authHelpers.page.locator('[data-testid="assessment-results"]');
      await expect(successPage).toBeVisible();

      await fs.unlink(testPdf).catch(() => {});
    });
  });
});