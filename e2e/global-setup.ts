import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup...');
  
  // Launch browser to run setup tasks
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Wait for the server to be ready
    await page.goto(config.webServer?.url || 'http://localhost:5000');
    console.log('✅ Server is ready');

    // Here you can add any global setup tasks like:
    // - Setting up test database with seed data
    // - Creating test users
    // - Clearing temporary files
    
    console.log('✅ Global setup completed');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;