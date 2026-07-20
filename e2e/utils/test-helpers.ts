import { Page, expect, Locator } from '@playwright/test';
import { TEST_USERS, SELECTORS, TIMEOUTS, generateTestData } from '../test-data/fixtures';

/**
 * Common test utilities for E2E tests
 */

export class TestHelpers {
  constructor(public page: Page) {}

  /**
   * Navigate to a specific path and wait for page load
   */
  async navigateTo(path: string, waitForLoadState: 'load' | 'domcontentloaded' | 'networkidle' = 'load') {
    await this.page.goto(path, { waitUntil: waitForLoadState });
    await this.page.waitForTimeout(500); // Small buffer for dynamic content
  }

  /**
   * Fill form field and verify it was filled correctly
   */
  async fillAndVerifyField(selector: string, value: string) {
    const field = this.page.locator(selector);
    await field.fill(value);
    await expect(field).toHaveValue(value);
  }

  /**
   * Click button and wait for action to complete
   */
  async clickAndWait(selector: string, waitCondition?: () => Promise<void>) {
    const button = this.page.locator(selector);
    await button.click();
    
    if (waitCondition) {
      await waitCondition();
    } else {
      await this.page.waitForTimeout(1000); // Default wait
    }
  }

  /**
   * Wait for element to be visible with custom timeout
   */
  async waitForVisible(selector: string, timeout = TIMEOUTS.MEDIUM) {
    await this.page.locator(selector).waitFor({ 
      state: 'visible', 
      timeout 
    });
  }

  /**
   * Wait for element to be hidden with custom timeout
   */
  async waitForHidden(selector: string, timeout = TIMEOUTS.MEDIUM) {
    await this.page.locator(selector).waitFor({ 
      state: 'hidden', 
      timeout 
    });
  }

  /**
   * Check if element exists without throwing
   */
  async elementExists(selector: string): Promise<boolean> {
    try {
      await this.page.locator(selector).waitFor({ 
        state: 'attached', 
        timeout: 2000 
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get text content from element
   */
  async getTextContent(selector: string): Promise<string> {
    const element = this.page.locator(selector);
    return await element.textContent() || '';
  }

  /**
   * Upload file using file input
   */
  async uploadFile(selector: string, filePath: string) {
    const fileInput = this.page.locator(selector);
    await fileInput.setInputFiles(filePath);
  }

  /**
   * Wait for API response
   */
  async waitForAPIResponse(urlPattern: string | RegExp, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST') {
    return await this.page.waitForResponse(response => {
      const url = response.url();
      const matchesUrl = typeof urlPattern === 'string' ? 
        url.includes(urlPattern) : 
        urlPattern.test(url);
      return matchesUrl && response.request().method() === method;
    });
  }

  /**
   * Mock API endpoint
   */
  async mockAPI(urlPattern: string, responseBody: any, status = 200) {
    await this.page.route(urlPattern, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(responseBody)
      });
    });
  }

  /**
   * Clear all mocks
   */
  async clearMocks() {
    await this.page.unrouteAll();
  }

  /**
   * Take screenshot with timestamp
   */
  async takeScreenshot(name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true
    });
  }

  /**
   * Simulate network failure
   */
  async simulateNetworkFailure(urlPattern: string) {
    await this.page.route(urlPattern, route => {
      route.abort('failed');
    });
  }

  /**
   * Wait for loading state to finish
   */
  async waitForLoadingToFinish(loadingSelector: string, timeout = TIMEOUTS.LONG) {
    try {
      await this.page.locator(loadingSelector).waitFor({ 
        state: 'visible', 
        timeout: 2000 
      });
      await this.page.locator(loadingSelector).waitFor({ 
        state: 'hidden', 
        timeout 
      });
    } catch {
      // Loading element might not appear if action completes quickly
    }
  }

  /**
   * Intercept console messages
   */
  setupConsoleLogging() {
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Console Error: ${msg.text()}`);
      }
    });

    this.page.on('pageerror', err => {
      console.log(`Page Error: ${err.message}`);
    });
  }
}

/**
 * Authentication-specific helper methods
 */
export class AuthHelpers extends TestHelpers {
  /**
   * Perform magic link login flow
   */
  async loginWithMagicLink(email: string) {
    await this.navigateTo('/login');
    await this.fillAndVerifyField(SELECTORS.LOGIN_EMAIL_INPUT, email);
    
    // Mock successful magic link request
    await this.mockAPI('/api/auth/request-magic-link', {
      message: 'If an account exists with this email, you will receive a login link shortly.',
      isNewUser: false
    });

    await this.clickAndWait(SELECTORS.LOGIN_SUBMIT_BUTTON);
    await this.waitForVisible(SELECTORS.LOGIN_SUCCESS_MESSAGE);
  }

  /**
   * Verify magic link token
   */
  async verifyMagicLink(token: string, mockUserData: any) {
    await this.mockAPI('/api/auth/verify-magic-link', {
      user: mockUserData,
      token: 'mock-jwt-token',
      isNewUser: false
    });

    await this.navigateTo(`/verify-magic-link?token=${token}`);
    await this.page.waitForURL('**/dashboard', { timeout: TIMEOUTS.LONG });
  }

  /**
   * Register user with verification code
   */
  async registerWithCode(userData: typeof TEST_USERS.STUDENT, code: string) {
    await this.navigateTo('/register');
    
    // Fill registration form
    await this.fillAndVerifyField(SELECTORS.REGISTER_EMAIL_INPUT, userData.email);
    await this.fillAndVerifyField(SELECTORS.REGISTER_FIRST_NAME_INPUT, userData.firstName);
    await this.fillAndVerifyField(SELECTORS.REGISTER_LAST_NAME_INPUT, userData.lastName);
    await this.fillAndVerifyField(SELECTORS.REGISTER_SCHOOL_INPUT, userData.school);

    // Mock verification code sending
    await this.mockAPI('/api/auth/send-code', {
      message: 'Verification code sent successfully'
    });

    await this.clickAndWait(SELECTORS.REGISTER_SUBMIT_BUTTON);
    
    // Enter verification code
    await this.fillAndVerifyField(SELECTORS.VERIFICATION_CODE_INPUT, code);
    
    // Mock verification and login
    await this.mockAPI('/api/auth/verify-code', {
      user: userData,
      token: 'mock-jwt-token'
    });

    await this.clickAndWait(SELECTORS.VERIFICATION_SUBMIT_BUTTON);
    await this.page.waitForURL('**/dashboard', { timeout: TIMEOUTS.LONG });
  }

  /**
   * Logout user
   */
  async logout() {
    const logoutButton = this.page.locator(SELECTORS.NAV_LOGOUT);
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await this.page.waitForURL('**/login', { timeout: TIMEOUTS.MEDIUM });
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.navigateTo('/dashboard');
      await this.page.waitForURL('**/dashboard', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * File upload helper methods
 */
export class FileUploadHelpers extends TestHelpers {
  /**
   * Upload file with drag and drop
   */
  async uploadWithDragDrop(filePath: string) {
    const dropzone = this.page.locator(SELECTORS.FILE_UPLOAD_DROPZONE);
    await dropzone.setInputFiles(filePath);
  }

  /**
   * Monitor upload progress
   */
  async monitorUploadProgress() {
    const progressBar = this.page.locator(SELECTORS.UPLOAD_PROGRESS_BAR);
    
    // Wait for progress to appear
    await progressBar.waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });
    
    // Monitor progress changes
    let lastProgress = 0;
    const progressValues = [];
    
    while (await progressBar.isVisible()) {
      const progressText = await progressBar.getAttribute('aria-valuenow');
      const currentProgress = parseInt(progressText || '0');
      
      if (currentProgress !== lastProgress) {
        progressValues.push(currentProgress);
        lastProgress = currentProgress;
      }
      
      if (currentProgress >= 100) break;
      await this.page.waitForTimeout(500);
    }
    
    return progressValues;
  }

  /**
   * Cancel upload
   */
  async cancelUpload() {
    const cancelButton = this.page.locator(SELECTORS.UPLOAD_CANCEL_BUTTON);
    await cancelButton.click();
  }
}

/**
 * Admin portal helper methods
 */
export class AdminHelpers extends TestHelpers {
  /**
   * Login as admin
   */
  async loginAsAdmin(email: string, password: string) {
    await this.navigateTo('/admin/login');
    await this.fillAndVerifyField(SELECTORS.ADMIN_EMAIL_INPUT, email);
    await this.fillAndVerifyField(SELECTORS.ADMIN_PASSWORD_INPUT, password);
    
    // Mock admin authentication
    await this.mockAPI('/api/admin/login', {
      token: 'mock-admin-token',
      admin: { email, role: 'admin' }
    });

    await this.clickAndWait(SELECTORS.ADMIN_LOGIN_BUTTON);
    await this.page.waitForURL('**/admin/dashboard', { timeout: TIMEOUTS.LONG });
  }

  /**
   * Navigate to admin section
   */
  async navigateToAdminSection(section: string) {
    await this.navigateTo(`/admin/${section}`);
  }
}