import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
export function loadEnvironmentVariables() {
  const envPath = path.resolve(process.cwd(), '.env');
  const result = dotenv.config({ path: envPath });
  
  if (result.error) {
    console.warn('Warning: .env file not found or could not be loaded');
    console.warn('Using default values for email configuration');
    
    // Set defaults if .env doesn't exist
    process.env.FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@nurseprep.app';
    process.env.FROM_NAME = process.env.FROM_NAME || 'NursePrep Analytics';
  } else {
    console.log('Environment variables loaded from .env');
  }
  
  // Validate critical environment variables
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please set these in your .env file or environment');
  }
  
  // Log configuration status (without exposing secrets)
  console.log('Configuration status:');
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`  JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`  SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? '✅ Set' : '⚠️ Not set (email disabled)'}`);
  console.log(`  FROM_EMAIL: ${process.env.FROM_EMAIL || 'Using default'}`);
  console.log(`  FROM_NAME: ${process.env.FROM_NAME || 'Using default'}`);
}

// Auto-load on import
loadEnvironmentVariables();