/**
 * Test data fixtures for E2E tests
 * Contains reusable test data for different test scenarios
 */

export const TEST_USERS = {
  STUDENT: {
    email: 'test.student@example.com',
    firstName: 'Test',
    lastName: 'Student',
    school: 'Test University'
  },
  GUEST: {
    sessionId: 'test-guest-123'
  },
  ADMIN: {
    email: 'test.admin@example.com',
    password: 'SecureTestPassword123!'
  }
} as const;

export const TEST_MAGIC_LINKS = {
  VALID_TOKEN: 'valid-test-token-123',
  EXPIRED_TOKEN: 'expired-test-token-456',
  INVALID_TOKEN: 'invalid-test-token-789'
} as const;

export const TEST_VERIFICATION_CODES = {
  VALID_CODE: '123456',
  INVALID_CODE: '999999',
  EXPIRED_CODE: '654321'
} as const;

export const TEST_FILES = {
  PDF_VALID: 'test-assessment.pdf',
  PDF_LARGE: 'large-assessment.pdf',
  PDF_INVALID: 'invalid-file.txt',
  PDF_WITH_TABLES: 'assessment-with-tables.pdf',
  KNOWLEDGE_BASE_DOC: 'sample-nursing-document.pdf'
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    REGISTER: '/api/auth/register',
    LOGIN: '/api/auth/login',
    REQUEST_MAGIC_LINK: '/api/auth/request-magic-link',
    VERIFY_MAGIC_LINK: '/api/auth/verify-magic-link',
    SEND_CODE: '/api/auth/send-code',
    VERIFY_CODE: '/api/auth/verify-code',
    ME: '/api/auth/me',
    PROFILE: '/api/auth/profile'
  },
  ADMIN: {
    LOGIN: '/api/admin/login',
    KNOWLEDGE_BASE_UPLOAD: '/api/admin/knowledge-base/upload',
    KNOWLEDGE_BASE_SEARCH: '/api/admin/knowledge-base/search',
    TOPICS_QUEUE: '/api/admin/topics-queue',
    RESOURCES: '/api/admin/resources',
    TABLES: '/api/admin/tables'
  },
  ASSESSMENT: {
    UPLOAD: '/api/assessment-reports'
  }
} as const;

export const SELECTORS = {
  // Authentication
  LOGIN_EMAIL_INPUT: '[data-testid="input-email"]',
  LOGIN_SUBMIT_BUTTON: '[data-testid="button-send-magic-link"]',
  LOGIN_SUCCESS_MESSAGE: '[data-testid="text-email-sent"]',
  REGISTER_EMAIL_INPUT: '[data-testid="input-email"]',
  REGISTER_FIRST_NAME_INPUT: '[data-testid="input-firstName"]',
  REGISTER_LAST_NAME_INPUT: '[data-testid="input-lastName"]',
  REGISTER_SCHOOL_INPUT: '[data-testid="input-school"]',
  REGISTER_SUBMIT_BUTTON: '[data-testid="button-send-code"]',
  VERIFICATION_CODE_INPUT: '[data-testid="input-verification-code"]',
  VERIFICATION_SUBMIT_BUTTON: '[data-testid="button-verify-code"]',

  // File Upload
  FILE_UPLOAD_DROPZONE: '[data-testid="upload-dropzone"]',
  FILE_UPLOAD_INPUT: '[data-testid="input-file-upload"]',
  UPLOAD_PROGRESS_BAR: '[data-testid="progress-upload"]',
  UPLOAD_CANCEL_BUTTON: '[data-testid="button-cancel-upload"]',
  UPLOAD_SUCCESS_MESSAGE: '[data-testid="text-upload-success"]',
  UPLOAD_ERROR_MESSAGE: '[data-testid="text-upload-error"]',

  // Admin Portal
  ADMIN_EMAIL_INPUT: '[data-testid="input-admin-email"]',
  ADMIN_PASSWORD_INPUT: '[data-testid="input-admin-password"]',
  ADMIN_LOGIN_BUTTON: '[data-testid="button-admin-login"]',
  
  // Knowledge Base
  KB_UPLOAD_BUTTON: '[data-testid="button-kb-upload"]',
  KB_SEARCH_INPUT: '[data-testid="input-kb-search"]',
  KB_SEARCH_BUTTON: '[data-testid="button-kb-search"]',
  KB_DOCUMENT_LIST: '[data-testid="list-kb-documents"]',
  KB_EMPTY_STATE: '[data-testid="empty-state-no-documents"]',

  // Navigation
  NAV_HOME: '[data-testid="nav-home"]',
  NAV_DASHBOARD: '[data-testid="nav-dashboard"]',
  NAV_ADMIN: '[data-testid="nav-admin"]',
  NAV_LOGOUT: '[data-testid="nav-logout"]'
} as const;

export const TIMEOUTS = {
  SHORT: 5000,
  MEDIUM: 15000,
  LONG: 30000,
  FILE_UPLOAD: 60000
} as const;

export const ERROR_MESSAGES = {
  AUTH: {
    INVALID_EMAIL: 'Please enter a valid email address',
    EMAIL_REQUIRED: 'Email is required',
    CODE_INVALID: 'Invalid verification code',
    CODE_EXPIRED: 'Verification code has expired'
  },
  UPLOAD: {
    FILE_TOO_LARGE: 'File size exceeds maximum limit',
    INVALID_FILE_TYPE: 'Please upload a PDF file',
    UPLOAD_FAILED: 'Upload failed. Please try again'
  },
  ADMIN: {
    INVALID_CREDENTIALS: 'Invalid administrator credentials',
    ACCESS_DENIED: 'Access denied'
  }
} as const;

/**
 * Generate test data for different scenarios
 */
export const generateTestData = {
  randomEmail: () => `test-${Math.random().toString(36).substr(2, 9)}@example.com`,
  randomGuestId: () => `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  randomVerificationCode: () => Math.floor(100000 + Math.random() * 900000).toString(),
  
  mockPdfBuffer: () => {
    // Create a minimal PDF buffer for testing
    const pdfHeader = '%PDF-1.4\n';
    const pdfContent = '1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n';
    const pdfTrailer = 'xref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<<\n/Size 2\n/Root 1 0 R\n>>\nstartxref\n74\n%%EOF';
    return Buffer.from(pdfHeader + pdfContent + pdfTrailer);
  }
};