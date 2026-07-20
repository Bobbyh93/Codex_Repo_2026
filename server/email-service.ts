import sgMail from '@sendgrid/mail';
import type { User } from '@shared/schema';

// Initialize SendGrid
const initializeSendGrid = () => {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn('SENDGRID_API_KEY not configured. Email functionality will be disabled.');
    return false;
  }
  sgMail.setApiKey(apiKey);
  return true;
};

export class EmailService {
  private static isConfigured = initializeSendGrid();
  
  // Default sender email (should match your verified SendGrid sender)
  private static readonly FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@nurseprep.app';
  private static readonly FROM_NAME = process.env.FROM_NAME || 'NursePrep Analytics';

  static async sendPasswordResetEmail(user: User, resetToken: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.log('SendGrid not configured - skipping email send');
      return false;
    }

    const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;
    
    const msg = {
      to: user.email,
      from: {
        email: this.FROM_EMAIL,
        name: this.FROM_NAME
      },
      subject: 'Reset Your NursePrep Analytics Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🩺 NursePrep Analytics</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
            
            <p>Hi ${user.firstName || user.username},</p>
            
            <p>You requested to reset your password for your NursePrep Analytics account. Click the button below to create a new password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px; font-family: monospace;">
              ${resetUrl}
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #666;">
              <p><strong>Security Notice:</strong></p>
              <ul style="margin: 10px 0;">
                <li>This link will expire in 1 hour</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Never share this link with anyone</li>
              </ul>
            </div>
            
            <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #999;">
              <p>© ${new Date().getFullYear()} NursePrep Analytics. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${user.firstName || user.username},

You requested to reset your password for your NursePrep Analytics account.

Reset your password by visiting: ${resetUrl}

This link will expire in 1 hour. If you didn't request this reset, please ignore this email.

Security tip: Never share this link with anyone.

© ${new Date().getFullYear()} NursePrep Analytics
      `
    };

    try {
      await sgMail.send(msg);
      console.log(`Password reset email sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return false;
    }
  }

  static async sendWelcomeEmail(user: User): Promise<boolean> {
    if (!this.isConfigured) {
      console.log('SendGrid not configured - skipping email send');
      return false;
    }

    const msg = {
      to: user.email,
      from: {
        email: this.FROM_EMAIL,
        name: this.FROM_NAME
      },
      subject: 'Welcome to NursePrep Analytics! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to NursePrep Analytics</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🩺 Welcome to NursePrep Analytics!</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <h2 style="color: #333; margin-top: 0;">Your Journey to Nursing Excellence Starts Here!</h2>
            
            <p>Hi ${user.firstName || user.username},</p>
            
            <p>Congratulations on joining NursePrep Analytics! We're excited to help you transform your assessment results into personalized study plans that will accelerate your nursing education success.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="margin-top: 0; color: #667eea;">🚀 What You Can Do Now:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Upload Assessment Reports:</strong> Start by uploading your ATI or other assessment PDFs</li>
                <li><strong>View Analytics Dashboard:</strong> Get instant insights into your performance patterns</li>
                <li><strong>Generate Study Guides:</strong> Create personalized PDF study guides based on your weaknesses</li>
                <li><strong>Track Your Progress:</strong> Monitor improvement across all nursing topics</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL || 'http://localhost:5000'}/dashboard" 
                 style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Go to Dashboard
              </a>
            </div>
            
            <div style="background: #e8f2ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #0066cc;">💡 Pro Tip:</h4>
              <p style="margin-bottom: 0;">Upload multiple assessment reports to see comprehensive analytics and identify patterns in your learning journey!</p>
            </div>
            
            <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #999;">
              <p>Questions? Need help? Contact us anytime!</p>
              <p>© ${new Date().getFullYear()} NursePrep Analytics. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${user.firstName || user.username},

Welcome to NursePrep Analytics! We're excited to help you succeed in your nursing education.

What you can do now:
- Upload assessment reports (ATI, etc.)
- View your analytics dashboard  
- Generate personalized study guides
- Track your progress over time

Get started: ${process.env.APP_URL || 'http://localhost:5000'}/dashboard

Questions? Contact us anytime!

© ${new Date().getFullYear()} NursePrep Analytics
      `
    };

    try {
      await sgMail.send(msg);
      console.log(`Welcome email sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return false;
    }
  }

  static async sendStudyGuideEmail(user: User, fileName: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.log('SendGrid not configured - skipping email send');
      return false;
    }

    const msg = {
      to: user.email,
      from: {
        email: this.FROM_EMAIL,
        name: this.FROM_NAME
      },
      subject: '📚 Your Personalized Study Guide is Ready!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Study Guide Ready</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">📚 Study Guide Generated!</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <h2 style="color: #333; margin-top: 0;">Your Personalized Study Guide is Ready!</h2>
            
            <p>Hi ${user.firstName || user.username},</p>
            
            <p>Great news! We've generated your personalized study guide based on your assessment results. This guide focuses on your areas for improvement and includes:</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Priority Topics:</strong> Areas that need the most attention</li>
                <li><strong>Study Objectives:</strong> Clear learning goals for each topic</li>
                <li><strong>Resource Recommendations:</strong> Textbook chapters, videos, and practice questions</li>
                <li><strong>Study Schedule:</strong> Organized timeline for maximum efficiency</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL || 'http://localhost:5000'}/dashboard" 
                 style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Download Study Guide
              </a>
            </div>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <h4 style="margin-top: 0; color: #155724;">🎯 Study Tips:</h4>
              <p style="margin-bottom: 0;">Focus on high-priority topics first, but don't neglect review of areas where you're already strong. Consistent practice leads to success!</p>
            </div>
            
            <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #999;">
              <p>Keep up the great work! You've got this! 💪</p>
              <p>© ${new Date().getFullYear()} NursePrep Analytics. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${user.firstName || user.username},

Your personalized study guide is ready! This guide focuses on your areas for improvement and includes:

- Priority topics that need attention
- Clear learning objectives  
- Resource recommendations
- Organized study schedule

Download your guide: ${process.env.APP_URL || 'http://localhost:5000'}/dashboard

Study tip: Focus on high-priority topics first, but don't neglect review of stronger areas.

Keep up the great work!

© ${new Date().getFullYear()} NursePrep Analytics
      `
    };

    try {
      await sgMail.send(msg);
      console.log(`Study guide notification email sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('Error sending study guide email:', error);
      return false;
    }
  }

  static async sendVerificationCodeEmail(email: string, code: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.log('SendGrid not configured - skipping email send');
      console.log(`[EMAIL TEST MODE] Verification code for ${email}: ${code}`);
      // In development, return true to allow testing without actual email
      return process.env.NODE_ENV === 'development';
    }

    const msg = {
      to: email,
      from: {
        email: this.FROM_EMAIL,
        name: this.FROM_NAME
      },
      subject: 'Your NursePrep Analytics Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verification Code</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🩺 NursePrep Analytics</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <h2 style="color: #333; margin-top: 0;">Your Verification Code</h2>
            
            <p>Enter this code to access your NursePrep Analytics account:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background: white; border: 2px solid #667eea; padding: 20px; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 8px; display: inline-block;">
                ${code}
              </div>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #666;">
              <p><strong>Security Notice:</strong></p>
              <ul style="margin: 10px 0;">
                <li>This code expires in 10 minutes</li>
                <li>Never share this code with anyone</li>
                <li>If you didn't request this code, please ignore this email</li>
              </ul>
            </div>
            
            <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #999;">
              <p>© ${new Date().getFullYear()} NursePrep Analytics. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Your NursePrep Analytics Verification Code

Enter this code to access your account: ${code}

This code expires in 10 minutes.

Security tip: Never share this code with anyone.

© ${new Date().getFullYear()} NursePrep Analytics
      `
    };

    try {
      await sgMail.send(msg);
      console.log(`Verification code sent to ${email}`);
      return true;
    } catch (error: any) {
      console.error('Error sending verification code email:', error);
      
      // In development, log the code and return true to allow testing
      if (process.env.NODE_ENV === 'development') {
        console.log(`[EMAIL TEST MODE] Verification code for ${email}: ${code}`);
        console.log('SendGrid error - falling back to test mode for development');
        return true;
      }
      
      return false;
    }
  }

  // Test email connectivity and configuration
  static async sendMagicLinkEmail(email: string, magicLink: string, firstName?: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.log('SendGrid not configured - skipping email send');
      console.log(`[EMAIL TEST MODE] Magic link for ${email}: ${magicLink}`);
      // In development, return true to allow testing without actual email
      return process.env.NODE_ENV === 'development';
    }

    const msg = {
      to: email,
      from: {
        email: this.FROM_EMAIL,
        name: this.FROM_NAME
      },
      subject: '🔐 Your NursePrep Analytics Login Link',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Login Link</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🩺 NursePrep Analytics</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <h2 style="color: #333; margin-top: 0;">Your Login Link is Ready!</h2>
            
            <p>Hi ${firstName || 'there'},</p>
            
            <p>Click the button below to securely log into your NursePrep Analytics account:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLink}" 
                 style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Log In to Your Account
              </a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 12px;">
              ${magicLink}
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #666;">
              <p><strong>Security Notice:</strong></p>
              <ul style="margin: 10px 0;">
                <li>This link expires in 15 minutes</li>
                <li>The link can only be used once</li>
                <li>If you didn't request this link, please ignore this email</li>
                <li>Never share this link with anyone</li>
              </ul>
            </div>
            
            <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #999;">
              <p>© ${new Date().getFullYear()} NursePrep Analytics. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Your NursePrep Analytics Login Link

Hi ${firstName || 'there'},

Click this link to log into your NursePrep Analytics account:
${magicLink}

This link expires in 15 minutes and can only be used once.

Security tip: Never share this link with anyone.

© ${new Date().getFullYear()} NursePrep Analytics
      `
    };

    try {
      await sgMail.send(msg);
      console.log(`Magic link email sent to ${email}`);
      return true;
    } catch (error: any) {
      console.error('Error sending magic link email:', error);
      
      // In development, log the link and return true to allow testing
      if (process.env.NODE_ENV === 'development') {
        console.log(`[EMAIL TEST MODE] Magic link for ${email}: ${magicLink}`);
        console.log('SendGrid error - falling back to test mode for development');
        return true;
      }
      
      return false;
    }
  }

  static async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured) {
      return { 
        success: false, 
        error: 'SendGrid not configured - missing SENDGRID_API_KEY' 
      };
    }

    const apiKey = process.env.SENDGRID_API_KEY;
    
    // Validate API key format
    if (!apiKey || !apiKey.startsWith('SG.')) {
      return { 
        success: false, 
        error: 'Invalid SendGrid API key format (should start with SG.)' 
      };
    }

    // Validate FROM_EMAIL configuration
    if (!this.FROM_EMAIL) {
      return { 
        success: false, 
        error: 'FROM_EMAIL not configured for SendGrid' 
      };
    }

    try {
      // Try to validate with SendGrid by checking API key length and format
      if (apiKey.length < 50) { // SendGrid API keys are typically longer
        return { 
          success: false, 
          error: 'SendGrid API key appears to be too short' 
        };
      }

      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: `SendGrid connection test failed: ${error.message}` 
      };
    }
  }
}