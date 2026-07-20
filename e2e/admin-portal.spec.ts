import { test, expect } from '@playwright/test';
import { AdminHelpers } from './utils/test-helpers';
import { TEST_USERS, SELECTORS, ERROR_MESSAGES, TIMEOUTS, generateTestData } from './test-data/fixtures';

/**
 * Admin Portal Features E2E Tests
 * 
 * Tests Admin Portal functionality including:
 * - Admin authentication and access control
 * - Resource management (creation, validation, URL verification)
 * - Topics Development Queue (View Details, Edit Topic, Mark as Resolved)
 * - Bulk operations and status updates
 * - Form validation and error messaging
 */

test.describe('Admin Portal Features', () => {
  let adminHelpers: AdminHelpers;

  test.beforeEach(async ({ page }) => {
    adminHelpers = new AdminHelpers(page);
    adminHelpers.setupConsoleLogging();
  });

  test.afterEach(async () => {
    await adminHelpers.clearMocks();
  });

  test.describe('Admin Authentication', () => {
    test('should login successfully with valid credentials', async () => {
      await adminHelpers.navigateTo('/admin/login');

      // Verify login form elements
      await expect(adminHelpers.page.locator(SELECTORS.ADMIN_EMAIL_INPUT)).toBeVisible();
      await expect(adminHelpers.page.locator(SELECTORS.ADMIN_PASSWORD_INPUT)).toBeVisible();
      await expect(adminHelpers.page.locator(SELECTORS.ADMIN_LOGIN_BUTTON)).toBeVisible();

      // Fill login form
      await adminHelpers.fillAndVerifyField(SELECTORS.ADMIN_EMAIL_INPUT, TEST_USERS.ADMIN.email);
      await adminHelpers.fillAndVerifyField(SELECTORS.ADMIN_PASSWORD_INPUT, TEST_USERS.ADMIN.password);

      // Mock successful login
      await adminHelpers.mockAPI('/api/admin/login', {
        token: 'admin-jwt-token',
        admin: {
          email: TEST_USERS.ADMIN.email,
          role: 'admin',
          permissions: ['manage_resources', 'manage_users', 'view_analytics']
        }
      });

      await adminHelpers.clickAndWait(SELECTORS.ADMIN_LOGIN_BUTTON);

      // Should redirect to admin dashboard
      await adminHelpers.page.waitForURL('**/admin/dashboard');
      expect(adminHelpers.page.url()).toContain('/admin/dashboard');
    });

    test('should show error for invalid credentials', async () => {
      await adminHelpers.navigateTo('/admin/login');

      await adminHelpers.fillAndVerifyField(SELECTORS.ADMIN_EMAIL_INPUT, 'invalid@example.com');
      await adminHelpers.fillAndVerifyField(SELECTORS.ADMIN_PASSWORD_INPUT, 'wrongpassword');

      // Mock authentication failure
      await adminHelpers.mockAPI('/api/admin/login', {
        error: 'Invalid administrator credentials'
      }, 401);

      await adminHelpers.clickAndWait(SELECTORS.ADMIN_LOGIN_BUTTON);

      // Should show error message
      const errorMessage = adminHelpers.page.locator('[data-testid="admin-login-error"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Invalid administrator credentials');
    });

    test('should validate required login fields', async () => {
      await adminHelpers.navigateTo('/admin/login');

      // Try to submit without filling fields
      await adminHelpers.clickAndWait(SELECTORS.ADMIN_LOGIN_BUTTON);

      // Check validation errors
      const emailInput = adminHelpers.page.locator(SELECTORS.ADMIN_EMAIL_INPUT);
      const passwordInput = adminHelpers.page.locator(SELECTORS.ADMIN_PASSWORD_INPUT);
      
      await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      await expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    });

    test('should handle session timeout', async () => {
      // Login first
      await adminHelpers.loginAsAdmin(TEST_USERS.ADMIN.email, TEST_USERS.ADMIN.password);
      
      // Navigate to protected route
      await adminHelpers.navigateToAdminSection('resources');

      // Mock session timeout
      await adminHelpers.mockAPI('/api/admin/session', {
        error: 'Session expired'
      }, 401);

      await adminHelpers.page.reload();

      // Should redirect to admin login
      await adminHelpers.page.waitForURL('**/admin/login');
      expect(adminHelpers.page.url()).toContain('/admin/login');
    });

    test('should prevent unauthorized access to admin routes', async () => {
      // Try to access admin dashboard without authentication
      await adminHelpers.navigateTo('/admin/dashboard');

      // Should redirect to admin login
      await adminHelpers.page.waitForURL('**/admin/login');
      expect(adminHelpers.page.url()).toContain('/admin/login');
    });

    test('should maintain admin session across page refreshes', async () => {
      await adminHelpers.loginAsAdmin(TEST_USERS.ADMIN.email, TEST_USERS.ADMIN.password);
      
      // Mock session validation
      await adminHelpers.mockAPI('/api/admin/session', {
        valid: true,
        admin: { email: TEST_USERS.ADMIN.email, role: 'admin' }
      });

      // Refresh page
      await adminHelpers.page.reload();

      // Should remain on admin dashboard
      expect(adminHelpers.page.url()).toContain('/admin/dashboard');
    });
  });

  test.describe('Resource Management', () => {
    test.beforeEach(async () => {
      await adminHelpers.loginAsAdmin(TEST_USERS.ADMIN.email, TEST_USERS.ADMIN.password);
      await adminHelpers.navigateToAdminSection('resources');
    });

    test('should create new resource with validation', async () => {
      // Mock existing resources
      await adminHelpers.mockAPI('/api/admin/resources', {
        resources: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      // Click create resource button
      const createButton = adminHelpers.page.locator('[data-testid="button-create-resource"]');
      await createButton.click();

      // Verify create resource modal
      const createModal = adminHelpers.page.locator('[data-testid="create-resource-modal"]');
      await expect(createModal).toBeVisible();

      // Fill resource form
      await adminHelpers.fillAndVerifyField('[data-testid="input-resource-title"]', 'Test Resource');
      await adminHelpers.fillAndVerifyField('[data-testid="input-resource-url"]', 'https://example.com/resource');
      await adminHelpers.fillAndVerifyField('[data-testid="textarea-resource-description"]', 'A comprehensive test resource');
      
      // Select resource type
      await adminHelpers.page.locator('[data-testid="select-resource-type"]').selectOption('video');
      
      // Select topic mapping
      await adminHelpers.page.locator('[data-testid="select-topic"]').selectOption('cardiovascular');

      // Mock successful resource creation
      await adminHelpers.mockAPI('/api/admin/resources', {
        success: true,
        resourceId: 'resource-123',
        message: 'Resource created successfully'
      });

      // Submit form
      await adminHelpers.clickAndWait('[data-testid="button-submit-resource"]');

      // Verify success message
      const successMessage = adminHelpers.page.locator('[data-testid="resource-create-success"]');
      await expect(successMessage).toContainText('Resource created successfully');
    });

    test('should validate resource form fields', async () => {
      const createButton = adminHelpers.page.locator('[data-testid="button-create-resource"]');
      await createButton.click();

      // Try to submit empty form
      await adminHelpers.clickAndWait('[data-testid="button-submit-resource"]');

      // Check required field validation
      const titleInput = adminHelpers.page.locator('[data-testid="input-resource-title"]');
      const urlInput = adminHelpers.page.locator('[data-testid="input-resource-url"]');
      
      await expect(titleInput).toHaveAttribute('aria-invalid', 'true');
      await expect(urlInput).toHaveAttribute('aria-invalid', 'true');

      // Verify validation messages
      await expect(adminHelpers.page.locator('[data-testid="title-validation-error"]')).toContainText('Title is required');
      await expect(adminHelpers.page.locator('[data-testid="url-validation-error"]')).toContainText('URL is required');
    });

    test('should verify URL accessibility', async () => {
      const createButton = adminHelpers.page.locator('[data-testid="button-create-resource"]');
      await createButton.click();

      // Fill form with invalid URL
      await adminHelpers.fillAndVerifyField('[data-testid="input-resource-title"]', 'Test Resource');
      await adminHelpers.fillAndVerifyField('[data-testid="input-resource-url"]', 'https://nonexistent-domain.com/resource');

      // Mock URL verification
      await adminHelpers.mockAPI('/api/admin/resources/verify-url', {
        accessible: false,
        statusCode: 404,
        error: 'URL not accessible'
      });

      // Trigger URL verification
      const verifyButton = adminHelpers.page.locator('[data-testid="button-verify-url"]');
      await verifyButton.click();

      // Verify warning message
      const urlWarning = adminHelpers.page.locator('[data-testid="url-verification-warning"]');
      await expect(urlWarning).toBeVisible();
      await expect(urlWarning).toContainText('URL not accessible (404)');
    });

    test('should edit existing resource', async () => {
      // Mock existing resources
      await adminHelpers.mockAPI('/api/admin/resources', {
        resources: [{
          id: 'resource-1',
          title: 'Existing Resource',
          url: 'https://example.com/old-resource',
          description: 'Old description',
          type: 'article',
          topicMappings: ['cardiovascular']
        }],
        total: 1
      });

      await adminHelpers.page.reload();

      // Click edit button
      const editButton = adminHelpers.page.locator('[data-testid="button-edit-resource-1"]');
      await editButton.click();

      // Verify edit modal with pre-filled data
      const editModal = adminHelpers.page.locator('[data-testid="edit-resource-modal"]');
      await expect(editModal).toBeVisible();
      
      const titleInput = adminHelpers.page.locator('[data-testid="input-resource-title"]');
      await expect(titleInput).toHaveValue('Existing Resource');

      // Update resource
      await adminHelpers.fillAndVerifyField('[data-testid="input-resource-title"]', 'Updated Resource');
      await adminHelpers.fillAndVerifyField('[data-testid="textarea-resource-description"]', 'Updated description');

      // Mock successful update
      await adminHelpers.mockAPI('/api/admin/resources/resource-1', {
        success: true,
        message: 'Resource updated successfully'
      });

      await adminHelpers.clickAndWait('[data-testid="button-update-resource"]');

      // Verify success message
      const successMessage = adminHelpers.page.locator('[data-testid="resource-update-success"]');
      await expect(successMessage).toContainText('Resource updated successfully');
    });

    test('should delete resource with confirmation', async () => {
      // Mock existing resource
      await adminHelpers.mockAPI('/api/admin/resources', {
        resources: [{
          id: 'resource-1',
          title: 'Resource to Delete',
          url: 'https://example.com/resource'
        }]
      });

      await adminHelpers.page.reload();

      // Click delete button
      const deleteButton = adminHelpers.page.locator('[data-testid="button-delete-resource-1"]');
      await deleteButton.click();

      // Verify confirmation modal
      const confirmModal = adminHelpers.page.locator('[data-testid="delete-confirmation-modal"]');
      await expect(confirmModal).toBeVisible();
      await expect(confirmModal).toContainText('Are you sure you want to delete "Resource to Delete"?');

      // Mock successful deletion
      await adminHelpers.mockAPI('/api/admin/resources/resource-1', {
        success: true,
        message: 'Resource deleted successfully'
      });

      // Confirm deletion
      const confirmButton = adminHelpers.page.locator('[data-testid="button-confirm-delete"]');
      await confirmButton.click();

      // Verify success and resource removal
      const successMessage = adminHelpers.page.locator('[data-testid="resource-delete-success"]');
      await expect(successMessage).toContainText('Resource deleted successfully');
    });

    test('should search and filter resources', async () => {
      // Mock resources with various types and topics
      await adminHelpers.mockAPI('/api/admin/resources', {
        resources: [
          { id: '1', title: 'Cardiovascular Video', type: 'video', topicMappings: ['cardiovascular'] },
          { id: '2', title: 'Respiratory Article', type: 'article', topicMappings: ['respiratory'] },
          { id: '3', title: 'Medication Guide', type: 'document', topicMappings: ['pharmacology'] }
        ],
        total: 3
      });

      await adminHelpers.page.reload();

      // Test search functionality
      const searchInput = adminHelpers.page.locator('[data-testid="input-resource-search"]');
      await adminHelpers.fillAndVerifyField('[data-testid="input-resource-search"]', 'cardiovascular');

      // Mock filtered results
      await adminHelpers.mockAPI('/api/admin/resources/search*', {
        resources: [
          { id: '1', title: 'Cardiovascular Video', type: 'video', topicMappings: ['cardiovascular'] }
        ],
        total: 1
      });

      await adminHelpers.clickAndWait('[data-testid="button-search-resources"]');

      // Verify filtered results
      const resultsList = adminHelpers.page.locator('[data-testid="resources-list"]');
      await expect(resultsList).toContainText('Cardiovascular Video');
      await expect(resultsList).not.toContainText('Respiratory Article');

      // Test type filter
      const typeFilter = adminHelpers.page.locator('[data-testid="filter-resource-type"]');
      await typeFilter.selectOption('video');

      // Verify filter application
      const activeFilters = adminHelpers.page.locator('[data-testid="active-filters"]');
      await expect(activeFilters).toContainText('Type: Video');
    });

    test('should handle bulk resource operations', async () => {
      // Mock multiple resources
      await adminHelpers.mockAPI('/api/admin/resources', {
        resources: [
          { id: '1', title: 'Resource 1', status: 'active' },
          { id: '2', title: 'Resource 2', status: 'active' },
          { id: '3', title: 'Resource 3', status: 'inactive' }
        ]
      });

      await adminHelpers.page.reload();

      // Select multiple resources
      await adminHelpers.page.locator('[data-testid="checkbox-resource-1"]').check();
      await adminHelpers.page.locator('[data-testid="checkbox-resource-2"]').check();

      // Verify bulk actions appear
      const bulkActions = adminHelpers.page.locator('[data-testid="bulk-actions"]');
      await expect(bulkActions).toBeVisible();

      // Test bulk status update
      const bulkStatusButton = adminHelpers.page.locator('[data-testid="button-bulk-status"]');
      await bulkStatusButton.click();
      
      const statusSelect = adminHelpers.page.locator('[data-testid="select-bulk-status"]');
      await statusSelect.selectOption('inactive');

      // Mock bulk update
      await adminHelpers.mockAPI('/api/admin/resources/bulk-update', {
        success: true,
        updated: 2,
        message: '2 resources updated successfully'
      });

      await adminHelpers.clickAndWait('[data-testid="button-apply-bulk-status"]');

      // Verify success message
      const successMessage = adminHelpers.page.locator('[data-testid="bulk-update-success"]');
      await expect(successMessage).toContainText('2 resources updated successfully');
    });
  });

  test.describe('Topics Development Queue', () => {
    test.beforeEach(async () => {
      await adminHelpers.loginAsAdmin(TEST_USERS.ADMIN.email, TEST_USERS.ADMIN.password);
      await adminHelpers.navigateToAdminSection('topics-queue');
    });

    test('should display topics queue with priorities', async () => {
      // Mock topics queue data
      await adminHelpers.mockAPI('/api/admin/topics-queue', {
        topics: [
          {
            id: 'topic-1',
            name: 'Cardiovascular Assessment',
            priority: 'high',
            status: 'pending',
            resourceCount: 2,
            demandScore: 85,
            lastUpdated: '2024-01-15T10:30:00Z',
            assignedTo: 'admin@example.com'
          },
          {
            id: 'topic-2',
            name: 'Respiratory Care',
            priority: 'medium',
            status: 'in_progress',
            resourceCount: 5,
            demandScore: 72,
            lastUpdated: '2024-01-14T15:20:00Z',
            assignedTo: null
          },
          {
            id: 'topic-3',
            name: 'Medication Administration',
            priority: 'low',
            status: 'completed',
            resourceCount: 8,
            demandScore: 45,
            lastUpdated: '2024-01-10T09:15:00Z',
            assignedTo: 'admin2@example.com'
          }
        ],
        total: 3
      });

      await adminHelpers.page.reload();

      // Verify queue display
      const queueTable = adminHelpers.page.locator('[data-testid="topics-queue-table"]');
      await expect(queueTable).toBeVisible();

      // Verify topic items
      const highPriorityTopic = adminHelpers.page.locator('[data-testid="topic-row-topic-1"]');
      await expect(highPriorityTopic).toBeVisible();
      await expect(highPriorityTopic).toContainText('Cardiovascular Assessment');
      await expect(highPriorityTopic).toContainText('High Priority');
      await expect(highPriorityTopic).toContainText('Pending');
      await expect(highPriorityTopic).toContainText('Demand: 85');

      // Verify priority color coding
      const priorityBadge = adminHelpers.page.locator('[data-testid="priority-badge-high"]');
      await expect(priorityBadge).toHaveClass(/bg-red/); // High priority styling
    });

    test('should allow viewing topic details', async () => {
      // Mock topic details
      await adminHelpers.mockAPI('/api/admin/topics-queue/topic-1/details', {
        id: 'topic-1',
        name: 'Cardiovascular Assessment',
        description: 'Comprehensive assessment of cardiovascular system including heart sounds, pulse, and blood pressure',
        priority: 'high',
        status: 'pending',
        demandScore: 85,
        relatedQuestions: [
          'How to assess heart murmurs?',
          'Normal vs abnormal heart sounds',
          'Blood pressure measurement techniques'
        ],
        existingResources: [
          { title: 'Heart Assessment Video', url: 'https://example.com/video1' },
          { title: 'Cardiac Examination Guide', url: 'https://example.com/guide1' }
        ],
        gapAnalysis: {
          missingResourceTypes: ['interactive_simulation', 'case_study'],
          recommendedActions: [
            'Create interactive heart sound simulator',
            'Develop case studies for different cardiac conditions'
          ]
        }
      });

      // Mock topics queue
      await adminHelpers.mockAPI('/api/admin/topics-queue', {
        topics: [{ id: 'topic-1', name: 'Cardiovascular Assessment', status: 'pending' }]
      });

      await adminHelpers.page.reload();

      // Click view details button
      const viewDetailsButton = adminHelpers.page.locator('[data-testid="button-view-details-topic-1"]');
      await viewDetailsButton.click();

      // Verify details modal
      const detailsModal = adminHelpers.page.locator('[data-testid="topic-details-modal"]');
      await expect(detailsModal).toBeVisible();
      await expect(detailsModal).toContainText('Cardiovascular Assessment');
      await expect(detailsModal).toContainText('Demand Score: 85');

      // Verify related questions section
      const questionsSection = adminHelpers.page.locator('[data-testid="related-questions"]');
      await expect(questionsSection).toContainText('How to assess heart murmurs?');

      // Verify gap analysis
      const gapAnalysis = adminHelpers.page.locator('[data-testid="gap-analysis"]');
      await expect(gapAnalysis).toContainText('interactive_simulation');
      await expect(gapAnalysis).toContainText('Create interactive heart sound simulator');
    });

    test('should allow editing topic priority and status', async () => {
      // Mock initial topic data
      await adminHelpers.mockAPI('/api/admin/topics-queue', {
        topics: [{ id: 'topic-1', name: 'Test Topic', priority: 'medium', status: 'pending' }]
      });

      await adminHelpers.page.reload();

      // Click edit button
      const editButton = adminHelpers.page.locator('[data-testid="button-edit-topic-1"]');
      await editButton.click();

      // Verify edit modal
      const editModal = adminHelpers.page.locator('[data-testid="edit-topic-modal"]');
      await expect(editModal).toBeVisible();

      // Update priority and status
      await adminHelpers.page.locator('[data-testid="select-priority"]').selectOption('high');
      await adminHelpers.page.locator('[data-testid="select-status"]').selectOption('in_progress');
      await adminHelpers.fillAndVerifyField('[data-testid="textarea-notes"]', 'Updated priority due to high demand');

      // Mock successful update
      await adminHelpers.mockAPI('/api/admin/topics-queue/topic-1', {
        success: true,
        message: 'Topic updated successfully'
      });

      await adminHelpers.clickAndWait('[data-testid="button-update-topic"]');

      // Verify success message
      const successMessage = adminHelpers.page.locator('[data-testid="topic-update-success"]');
      await expect(successMessage).toContainText('Topic updated successfully');
    });

    test('should mark topic as resolved', async () => {
      // Mock topic data
      await adminHelpers.mockAPI('/api/admin/topics-queue', {
        topics: [{ id: 'topic-1', name: 'Test Topic', status: 'in_progress' }]
      });

      await adminHelpers.page.reload();

      // Click resolve button
      const resolveButton = adminHelpers.page.locator('[data-testid="button-resolve-topic-1"]');
      await resolveButton.click();

      // Verify resolution modal
      const resolveModal = adminHelpers.page.locator('[data-testid="resolve-topic-modal"]');
      await expect(resolveModal).toBeVisible();

      // Add resolution notes
      await adminHelpers.fillAndVerifyField('[data-testid="textarea-resolution-notes"]', 'Added 3 new video resources and 2 interactive simulations');
      
      // Select resolution type
      await adminHelpers.page.locator('[data-testid="select-resolution-type"]').selectOption('resources_added');

      // Mock successful resolution
      await adminHelpers.mockAPI('/api/admin/topics-queue/topic-1/resolve', {
        success: true,
        message: 'Topic marked as resolved'
      });

      await adminHelpers.clickAndWait('[data-testid="button-confirm-resolve"]');

      // Verify success message and status update
      const successMessage = adminHelpers.page.locator('[data-testid="resolve-success"]');
      await expect(successMessage).toContainText('Topic marked as resolved');
    });

    test('should filter and sort topics queue', async () => {
      // Mock diverse topics data
      await adminHelpers.mockAPI('/api/admin/topics-queue', {
        topics: [
          { id: '1', name: 'Topic A', priority: 'high', status: 'pending', demandScore: 90 },
          { id: '2', name: 'Topic B', priority: 'medium', status: 'in_progress', demandScore: 75 },
          { id: '3', name: 'Topic C', priority: 'low', status: 'completed', demandScore: 60 }
        ]
      });

      await adminHelpers.page.reload();

      // Test priority filter
      const priorityFilter = adminHelpers.page.locator('[data-testid="filter-priority"]');
      await priorityFilter.selectOption('high');

      // Verify filtered results
      await expect(adminHelpers.page.locator('[data-testid="topic-row-1"]')).toBeVisible();
      await expect(adminHelpers.page.locator('[data-testid="topic-row-2"]')).toBeHidden();

      // Test status filter
      const statusFilter = adminHelpers.page.locator('[data-testid="filter-status"]');
      await statusFilter.selectOption('pending');

      // Test sort by demand score
      const sortSelect = adminHelpers.page.locator('[data-testid="sort-topics"]');
      await sortSelect.selectOption('demand_score_desc');

      // Verify sorting (highest demand first)
      const topicRows = adminHelpers.page.locator('[data-testid^="topic-row-"]');
      const firstTopic = topicRows.first();
      await expect(firstTopic).toContainText('90'); // Highest demand score
    });

    test('should handle bulk topic operations', async () => {
      // Mock topics data
      await adminHelpers.mockAPI('/api/admin/topics-queue', {
        topics: [
          { id: '1', name: 'Topic 1', priority: 'medium', status: 'pending' },
          { id: '2', name: 'Topic 2', priority: 'low', status: 'pending' },
          { id: '3', name: 'Topic 3', priority: 'medium', status: 'in_progress' }
        ]
      });

      await adminHelpers.page.reload();

      // Select multiple topics
      await adminHelpers.page.locator('[data-testid="checkbox-topic-1"]').check();
      await adminHelpers.page.locator('[data-testid="checkbox-topic-2"]').check();

      // Verify bulk actions panel
      const bulkActions = adminHelpers.page.locator('[data-testid="bulk-actions"]');
      await expect(bulkActions).toBeVisible();
      await expect(bulkActions).toContainText('2 topics selected');

      // Test bulk priority update
      const bulkPriorityButton = adminHelpers.page.locator('[data-testid="button-bulk-priority"]');
      await bulkPriorityButton.click();

      await adminHelpers.page.locator('[data-testid="select-bulk-priority"]').selectOption('high');

      // Mock bulk update
      await adminHelpers.mockAPI('/api/admin/topics-queue/bulk-update', {
        success: true,
        updated: 2,
        message: '2 topics updated successfully'
      });

      await adminHelpers.clickAndWait('[data-testid="button-apply-bulk-priority"]');

      // Verify success message
      const successMessage = adminHelpers.page.locator('[data-testid="bulk-update-success"]');
      await expect(successMessage).toContainText('2 topics updated successfully');
    });

    test('should export topics queue data', async () => {
      // Mock topics data
      await adminHelpers.mockAPI('/api/admin/topics-queue', {
        topics: [
          { id: '1', name: 'Topic 1', priority: 'high', status: 'pending' },
          { id: '2', name: 'Topic 2', priority: 'medium', status: 'in_progress' }
        ]
      });

      await adminHelpers.page.reload();

      // Mock export endpoint
      await adminHelpers.mockAPI('/api/admin/topics-queue/export', {
        exportUrl: 'http://localhost:5000/exports/topics-queue-export.csv',
        filename: 'topics-queue-export.csv'
      });

      // Click export button
      const exportButton = adminHelpers.page.locator('[data-testid="button-export-queue"]');
      
      // Set up download handling
      const downloadPromise = adminHelpers.page.waitForEvent('download');
      await exportButton.click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('topics-queue-export.csv');
    });
  });

  test.describe('Form Validation and Error Handling', () => {
    test.beforeEach(async () => {
      await adminHelpers.loginAsAdmin(TEST_USERS.ADMIN.email, TEST_USERS.ADMIN.password);
    });

    test('should validate all form field requirements', async () => {
      await adminHelpers.navigateToAdminSection('resources');

      const createButton = adminHelpers.page.locator('[data-testid="button-create-resource"]');
      await createButton.click();

      // Test all field validations by submitting empty form
      await adminHelpers.clickAndWait('[data-testid="button-submit-resource"]');

      // Verify all required field errors
      await expect(adminHelpers.page.locator('[data-testid="title-validation-error"]')).toBeVisible();
      await expect(adminHelpers.page.locator('[data-testid="url-validation-error"]')).toBeVisible();
      await expect(adminHelpers.page.locator('[data-testid="type-validation-error"]')).toBeVisible();
      await expect(adminHelpers.page.locator('[data-testid="topic-validation-error"]')).toBeVisible();
    });

    test('should validate URL format', async () => {
      await adminHelpers.navigateToAdminSection('resources');

      const createButton = adminHelpers.page.locator('[data-testid="button-create-resource"]');
      await createButton.click();

      // Test invalid URL formats
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com', // Invalid protocol
        'https://', // Incomplete URL
        'https://space in url.com' // Invalid characters
      ];

      for (const invalidUrl of invalidUrls) {
        await adminHelpers.fillAndVerifyField('[data-testid="input-resource-url"]', invalidUrl);
        
        // Trigger validation
        await adminHelpers.page.locator('[data-testid="input-resource-title"]').click();
        
        // Verify URL format error
        const urlError = adminHelpers.page.locator('[data-testid="url-format-error"]');
        await expect(urlError).toContainText('Please enter a valid URL');
      }
    });

    test('should handle server validation errors', async () => {
      await adminHelpers.navigateToAdminSection('resources');

      const createButton = adminHelpers.page.locator('[data-testid="button-create-resource"]');
      await createButton.click();

      // Fill valid form data
      await adminHelpers.fillAndVerifyField('[data-testid="input-resource-title"]', 'Test Resource');
      await adminHelpers.fillAndVerifyField('[data-testid="input-resource-url"]', 'https://example.com');
      await adminHelpers.page.locator('[data-testid="select-resource-type"]').selectOption('video');

      // Mock server validation error
      await adminHelpers.mockAPI('/api/admin/resources', {
        error: 'Validation failed',
        details: [
          { field: 'title', message: 'Title already exists' },
          { field: 'url', message: 'URL is not accessible' }
        ]
      }, 400);

      await adminHelpers.clickAndWait('[data-testid="button-submit-resource"]');

      // Verify server validation errors are displayed
      await expect(adminHelpers.page.locator('[data-testid="server-error-title"]')).toContainText('Title already exists');
      await expect(adminHelpers.page.locator('[data-testid="server-error-url"]')).toContainText('URL is not accessible');
    });

    test('should display helpful error messages', async () => {
      await adminHelpers.navigateToAdminSection('topics-queue');

      // Mock server error
      await adminHelpers.mockAPI('/api/admin/topics-queue', {
        error: 'Database connection failed'
      }, 500);

      await adminHelpers.page.reload();

      // Verify helpful error message
      const errorMessage = adminHelpers.page.locator('[data-testid="load-error"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Unable to load topics queue');
      await expect(errorMessage).toContainText('Please try again');

      // Verify retry button
      const retryButton = adminHelpers.page.locator('[data-testid="button-retry-load"]');
      await expect(retryButton).toBeVisible();
    });

    test('should handle network connectivity issues', async () => {
      await adminHelpers.navigateToAdminSection('resources');

      // Simulate network failure
      await adminHelpers.simulateNetworkFailure('/api/admin/resources');

      await adminHelpers.page.reload();

      // Verify network error handling
      const networkError = adminHelpers.page.locator('[data-testid="network-error"]');
      await expect(networkError).toBeVisible();
      await expect(networkError).toContainText('Network connection failed');
      await expect(networkError).toContainText('Check your internet connection');
    });

    test('should provide clear success feedback', async () => {
      await adminHelpers.navigateToAdminSection('resources');

      const createButton = adminHelpers.page.locator('[data-testid="button-create-resource"]');
      await createButton.click();

      // Fill and submit valid form
      await adminHelpers.fillAndVerifyField('[data-testid="input-resource-title"]', 'Success Test Resource');
      await adminHelpers.fillAndVerifyField('[data-testid="input-resource-url"]', 'https://example.com');
      await adminHelpers.page.locator('[data-testid="select-resource-type"]').selectOption('article');

      await adminHelpers.mockAPI('/api/admin/resources', {
        success: true,
        resourceId: 'resource-456',
        message: 'Resource created successfully'
      });

      await adminHelpers.clickAndWait('[data-testid="button-submit-resource"]');

      // Verify success feedback
      const successFeedback = adminHelpers.page.locator('[data-testid="success-feedback"]');
      await expect(successFeedback).toBeVisible();
      await expect(successFeedback).toContainText('Resource created successfully');
      
      // Verify success icon/styling
      await expect(successFeedback).toHaveClass(/bg-green/);
      await expect(successFeedback.locator('[data-testid="success-icon"]')).toBeVisible();
    });
  });
});