import { test, expect } from '@playwright/test';
import { AuthHelpers } from './utils/test-helpers';
import { TEST_USERS, TEST_MAGIC_LINKS, TEST_VERIFICATION_CODES, SELECTORS, ERROR_MESSAGES, generateTestData } from './test-data/fixtures';

/**
 * Student Authentication E2E Tests
 * 
 * Tests all authentication flows including:
 * - Magic link login
 * - User registration with verification codes
 * - Magic link verification 
 * - Guest to user migration
 * - Dashboard access and session management
 */

test.describe('Student Authentication Flows', () => {
  let authHelpers: AuthHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    authHelpers.setupConsoleLogging();
  });

  test.afterEach(async () => {
    await authHelpers.clearMocks();
  });

  test.describe('Magic Link Login', () => {
    test('should send magic link for valid email', async () => {
      await authHelpers.navigateTo('/login');
      
      // Test the login form components are visible
      await expect(authHelpers.page.locator(SELECTORS.LOGIN_EMAIL_INPUT)).toBeVisible();
      await expect(authHelpers.page.locator(SELECTORS.LOGIN_SUBMIT_BUTTON)).toBeVisible();
      
      // Fill in valid email
      await authHelpers.fillAndVerifyField(SELECTORS.LOGIN_EMAIL_INPUT, TEST_USERS.STUDENT.email);
      
      // Mock the API response
      await authHelpers.mockAPI('/api/auth/request-magic-link', {
        message: 'If an account exists with this email, you will receive a login link shortly.',
        isNewUser: false
      });
      
      // Submit form
      await authHelpers.clickAndWait(SELECTORS.LOGIN_SUBMIT_BUTTON);
      
      // Verify success message appears
      await authHelpers.waitForVisible(SELECTORS.LOGIN_SUCCESS_MESSAGE);
      const successMessage = await authHelpers.getTextContent(SELECTORS.LOGIN_SUCCESS_MESSAGE);
      expect(successMessage).toContain('Check your email');
    });

    test('should show validation error for empty email', async () => {
      await authHelpers.navigateTo('/login');
      
      // Try to submit without email
      await authHelpers.clickAndWait(SELECTORS.LOGIN_SUBMIT_BUTTON);
      
      // Check for validation error
      const emailInput = authHelpers.page.locator(SELECTORS.LOGIN_EMAIL_INPUT);
      await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    });

    test('should show validation error for invalid email format', async () => {
      await authHelpers.navigateTo('/login');
      
      // Fill invalid email
      await authHelpers.fillAndVerifyField(SELECTORS.LOGIN_EMAIL_INPUT, 'invalid-email');
      await authHelpers.clickAndWait(SELECTORS.LOGIN_SUBMIT_BUTTON);
      
      // Check for validation error
      const emailInput = authHelpers.page.locator(SELECTORS.LOGIN_EMAIL_INPUT);
      await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    });

    test('should handle rate limiting gracefully', async () => {
      await authHelpers.navigateTo('/login');
      await authHelpers.fillAndVerifyField(SELECTORS.LOGIN_EMAIL_INPUT, TEST_USERS.STUDENT.email);
      
      // Mock rate limit response
      await authHelpers.mockAPI('/api/auth/request-magic-link', {
        message: 'If an account exists with this email, you will receive a login link shortly.',
        rateLimitExceeded: true
      });
      
      await authHelpers.clickAndWait(SELECTORS.LOGIN_SUBMIT_BUTTON);
      
      // Should still show success message (security measure)
      await authHelpers.waitForVisible(SELECTORS.LOGIN_SUCCESS_MESSAGE);
    });

    test('should allow sending another magic link', async () => {
      await authHelpers.loginWithMagicLink(TEST_USERS.STUDENT.email);
      
      // Find and click "Send Another" button
      const sendAnotherButton = authHelpers.page.locator('[data-testid="button-send-another"]');
      await sendAnotherButton.click();
      
      // Should return to email input form
      await expect(authHelpers.page.locator(SELECTORS.LOGIN_EMAIL_INPUT)).toBeVisible();
      await expect(authHelpers.page.locator(SELECTORS.LOGIN_EMAIL_INPUT)).toHaveValue('');
    });
  });

  test.describe('Magic Link Verification', () => {
    test('should successfully verify valid magic link token', async () => {
      const mockUserData = {
        id: '1',
        email: TEST_USERS.STUDENT.email,
        username: 'testuser',
        firstName: TEST_USERS.STUDENT.firstName,
        lastName: TEST_USERS.STUDENT.lastName,
        role: 'student'
      };

      await authHelpers.verifyMagicLink(TEST_MAGIC_LINKS.VALID_TOKEN, mockUserData);
      
      // Should redirect to dashboard
      expect(authHelpers.page.url()).toContain('/dashboard');
    });

    test('should show error for invalid token', async () => {
      await authHelpers.mockAPI('/api/auth/verify-magic-link', {
        error: 'Invalid or expired token'
      }, 400);

      await authHelpers.navigateTo(`/verify-magic-link?token=${TEST_MAGIC_LINKS.INVALID_TOKEN}`);
      
      // Should show error message
      const errorMessage = authHelpers.page.locator('[data-testid="text-verification-error"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Invalid or expired token');
    });

    test('should show error for expired token', async () => {
      await authHelpers.mockAPI('/api/auth/verify-magic-link', {
        error: 'Token has expired'
      }, 400);

      await authHelpers.navigateTo(`/verify-magic-link?token=${TEST_MAGIC_LINKS.EXPIRED_TOKEN}`);
      
      // Should show error message
      const errorMessage = authHelpers.page.locator('[data-testid="text-verification-error"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should show error when no token provided', async () => {
      await authHelpers.navigateTo('/verify-magic-link');
      
      // Should show error for missing token
      const errorMessage = authHelpers.page.locator('[data-testid="text-verification-error"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('No verification token found');
    });

    test('should handle network errors gracefully', async () => {
      await authHelpers.simulateNetworkFailure('/api/auth/verify-magic-link');
      await authHelpers.navigateTo(`/verify-magic-link?token=${TEST_MAGIC_LINKS.VALID_TOKEN}`);
      
      // Should show error message
      const errorMessage = authHelpers.page.locator('[data-testid="text-verification-error"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should provide option to go home or try again on error', async () => {
      await authHelpers.mockAPI('/api/auth/verify-magic-link', {
        error: 'Invalid token'
      }, 400);

      await authHelpers.navigateTo(`/verify-magic-link?token=${TEST_MAGIC_LINKS.INVALID_TOKEN}`);
      
      // Check for action buttons
      await expect(authHelpers.page.locator('[data-testid="button-go-home"]')).toBeVisible();
      await expect(authHelpers.page.locator('[data-testid="button-try-again"]')).toBeVisible();
    });
  });

  test.describe('User Registration', () => {
    test('should complete registration flow with verification code', async () => {
      const testUser = {
        ...TEST_USERS.STUDENT,
        email: generateTestData.randomEmail()
      };

      await authHelpers.registerWithCode(testUser, TEST_VERIFICATION_CODES.VALID_CODE);
      
      // Should redirect to dashboard after successful registration
      expect(authHelpers.page.url()).toContain('/dashboard');
    });

    test('should validate required fields', async () => {
      await authHelpers.navigateTo('/register');
      
      // Try to submit empty form
      await authHelpers.clickAndWait(SELECTORS.REGISTER_SUBMIT_BUTTON);
      
      // Check email field validation
      const emailInput = authHelpers.page.locator(SELECTORS.REGISTER_EMAIL_INPUT);
      await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    });

    test('should validate email format', async () => {
      await authHelpers.navigateTo('/register');
      
      await authHelpers.fillAndVerifyField(SELECTORS.REGISTER_EMAIL_INPUT, 'invalid-email');
      await authHelpers.clickAndWait(SELECTORS.REGISTER_SUBMIT_BUTTON);
      
      const emailInput = authHelpers.page.locator(SELECTORS.REGISTER_EMAIL_INPUT);
      await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    });

    test('should send verification code after valid form submission', async () => {
      await authHelpers.navigateTo('/register');
      
      // Fill registration form
      await authHelpers.fillAndVerifyField(SELECTORS.REGISTER_EMAIL_INPUT, TEST_USERS.STUDENT.email);
      await authHelpers.fillAndVerifyField(SELECTORS.REGISTER_FIRST_NAME_INPUT, TEST_USERS.STUDENT.firstName);
      await authHelpers.fillAndVerifyField(SELECTORS.REGISTER_LAST_NAME_INPUT, TEST_USERS.STUDENT.lastName);
      await authHelpers.fillAndVerifyField(SELECTORS.REGISTER_SCHOOL_INPUT, TEST_USERS.STUDENT.school);

      // Mock successful code sending
      await authHelpers.mockAPI('/api/auth/send-code', {
        message: 'Verification code sent successfully'
      });

      await authHelpers.clickAndWait(SELECTORS.REGISTER_SUBMIT_BUTTON);
      
      // Should show code input field
      await expect(authHelpers.page.locator(SELECTORS.VERIFICATION_CODE_INPUT)).toBeVisible();
    });

    test('should handle invalid verification code', async () => {
      await authHelpers.navigateTo('/register');
      
      // Fill and submit registration form
      await authHelpers.fillAndVerifyField(SELECTORS.REGISTER_EMAIL_INPUT, TEST_USERS.STUDENT.email);
      await authHelpers.fillAndVerifyField(SELECTORS.REGISTER_FIRST_NAME_INPUT, TEST_USERS.STUDENT.firstName);
      
      await authHelpers.mockAPI('/api/auth/send-code', { message: 'Code sent' });
      await authHelpers.clickAndWait(SELECTORS.REGISTER_SUBMIT_BUTTON);
      
      // Enter invalid code
      await authHelpers.fillAndVerifyField(SELECTORS.VERIFICATION_CODE_INPUT, TEST_VERIFICATION_CODES.INVALID_CODE);
      
      // Mock verification failure
      await authHelpers.mockAPI('/api/auth/verify-code', {
        error: 'Invalid verification code'
      }, 400);
      
      await authHelpers.clickAndWait(SELECTORS.VERIFICATION_SUBMIT_BUTTON);
      
      // Should show error message
      const errorMessage = authHelpers.page.locator('[data-testid="text-verification-error"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should handle expired verification code', async () => {
      await authHelpers.navigateTo('/register');
      
      // Fill and submit registration form
      await authHelpers.fillAndVerifyField(SELECTORS.REGISTER_EMAIL_INPUT, TEST_USERS.STUDENT.email);
      
      await authHelpers.mockAPI('/api/auth/send-code', { message: 'Code sent' });
      await authHelpers.clickAndWait(SELECTORS.REGISTER_SUBMIT_BUTTON);
      
      // Enter expired code
      await authHelpers.fillAndVerifyField(SELECTORS.VERIFICATION_CODE_INPUT, TEST_VERIFICATION_CODES.EXPIRED_CODE);
      
      // Mock verification failure due to expiration
      await authHelpers.mockAPI('/api/auth/verify-code', {
        error: 'Verification code has expired'
      }, 400);
      
      await authHelpers.clickAndWait(SELECTORS.VERIFICATION_SUBMIT_BUTTON);
      
      // Should show specific error for expired code
      const errorMessage = authHelpers.page.locator('[data-testid="text-verification-error"]');
      await expect(errorMessage).toContainText('expired');
    });
  });

  test.describe('Guest to User Migration', () => {
    test('should migrate guest session data during registration', async () => {
      // Simulate guest session with some data
      await authHelpers.page.evaluate(() => {
        localStorage.setItem('guestSessionId', 'guest_123456789');
        localStorage.setItem('guestProgress', JSON.stringify({
          assessmentId: 'test-123',
          completedTopics: ['topic1', 'topic2']
        }));
      });

      // Complete registration
      const testUser = {
        ...TEST_USERS.STUDENT,
        email: generateTestData.randomEmail()
      };

      await authHelpers.registerWithCode(testUser, TEST_VERIFICATION_CODES.VALID_CODE);
      
      // Verify guest data is cleared after migration
      const guestSessionId = await authHelpers.page.evaluate(() => 
        localStorage.getItem('guestSessionId')
      );
      expect(guestSessionId).toBeNull();
    });

    test('should preserve guest progress during login with magic link', async () => {
      // Set guest session data
      await authHelpers.page.evaluate(() => {
        localStorage.setItem('guestSessionId', 'guest_123456789');
        localStorage.setItem('guestProgress', JSON.stringify({
          assessmentResults: ['result1', 'result2']
        }));
      });

      const mockUser = {
        id: '1',
        email: TEST_USERS.STUDENT.email,
        username: 'testuser',
        role: 'student'
      };

      await authHelpers.verifyMagicLink(TEST_MAGIC_LINKS.VALID_TOKEN, mockUser);
      
      // Should redirect to dashboard with preserved session
      expect(authHelpers.page.url()).toContain('/dashboard');
    });
  });

  test.describe('Dashboard Access and Session Management', () => {
    test('should redirect authenticated user to dashboard', async () => {
      // Mock authenticated state
      await authHelpers.page.evaluate(() => {
        localStorage.setItem('authToken', 'mock-jwt-token');
      });

      await authHelpers.mockAPI('/api/auth/me', {
        id: '1',
        email: TEST_USERS.STUDENT.email,
        username: 'testuser',
        role: 'student'
      });

      await authHelpers.navigateTo('/dashboard');
      
      // Should successfully access dashboard
      await expect(authHelpers.page.locator('[data-testid="dashboard-content"]')).toBeVisible();
    });

    test('should redirect unauthenticated user to login', async () => {
      await authHelpers.navigateTo('/dashboard');
      
      // Should redirect to login page
      await authHelpers.page.waitForURL('**/login');
      expect(authHelpers.page.url()).toContain('/login');
    });

    test('should handle logout correctly', async () => {
      // Mock authenticated state
      await authHelpers.page.evaluate(() => {
        localStorage.setItem('authToken', 'mock-jwt-token');
      });

      await authHelpers.mockAPI('/api/auth/me', {
        id: '1',
        email: TEST_USERS.STUDENT.email,
        username: 'testuser',
        role: 'student'
      });

      await authHelpers.navigateTo('/dashboard');
      
      // Perform logout
      await authHelpers.logout();
      
      // Should redirect to login and clear token
      expect(authHelpers.page.url()).toContain('/login');
      
      const token = await authHelpers.page.evaluate(() => 
        localStorage.getItem('authToken')
      );
      expect(token).toBeNull();
    });

    test('should handle expired token gracefully', async () => {
      await authHelpers.page.evaluate(() => {
        localStorage.setItem('authToken', 'expired-token');
      });

      // Mock expired token response
      await authHelpers.mockAPI('/api/auth/me', {
        error: 'Token expired'
      }, 401);

      await authHelpers.navigateTo('/dashboard');
      
      // Should redirect to login and clear expired token
      await authHelpers.page.waitForURL('**/login');
      
      const token = await authHelpers.page.evaluate(() => 
        localStorage.getItem('authToken')
      );
      expect(token).toBeNull();
    });

    test('should maintain session across page refreshes', async () => {
      // Mock authenticated state
      await authHelpers.page.evaluate(() => {
        localStorage.setItem('authToken', 'mock-jwt-token');
      });

      await authHelpers.mockAPI('/api/auth/me', {
        id: '1',
        email: TEST_USERS.STUDENT.email,
        username: 'testuser',
        role: 'student'
      });

      await authHelpers.navigateTo('/dashboard');
      
      // Refresh page
      await authHelpers.page.reload();
      
      // Should still be authenticated
      await expect(authHelpers.page.locator('[data-testid="dashboard-content"]')).toBeVisible();
    });
  });

  test.describe('Authentication Edge Cases', () => {
    test('should handle simultaneous login attempts', async () => {
      const email = generateTestData.randomEmail();
      
      // Open multiple tabs and attempt login
      const page1 = authHelpers.page;
      const page2 = await authHelpers.page.context().newPage();
      const authHelpers2 = new AuthHelpers(page2);

      await Promise.all([
        authHelpers.loginWithMagicLink(email),
        authHelpers2.loginWithMagicLink(email)
      ]);

      // Both should show success messages
      await Promise.all([
        authHelpers.waitForVisible(SELECTORS.LOGIN_SUCCESS_MESSAGE),
        authHelpers2.waitForVisible(SELECTORS.LOGIN_SUCCESS_MESSAGE)
      ]);

      await page2.close();
    });

    test('should handle browser back/forward during auth flow', async () => {
      await authHelpers.navigateTo('/login');
      await authHelpers.fillAndVerifyField(SELECTORS.LOGIN_EMAIL_INPUT, TEST_USERS.STUDENT.email);
      
      // Navigate away and back
      await authHelpers.navigateTo('/');
      await authHelpers.page.goBack();
      
      // Form should still be functional
      await expect(authHelpers.page.locator(SELECTORS.LOGIN_EMAIL_INPUT)).toBeVisible();
    });

    test('should validate email uniqueness during registration', async () => {
      await authHelpers.navigateTo('/register');
      
      await authHelpers.fillAndVerifyField(SELECTORS.REGISTER_EMAIL_INPUT, TEST_USERS.STUDENT.email);
      
      // Mock email already exists response
      await authHelpers.mockAPI('/api/auth/send-code', {
        error: 'Email already exists'
      }, 409);
      
      await authHelpers.clickAndWait(SELECTORS.REGISTER_SUBMIT_BUTTON);
      
      // Should show error message
      const errorMessage = authHelpers.page.locator('[data-testid="text-registration-error"]');
      await expect(errorMessage).toContainText('already exists');
    });
  });
});