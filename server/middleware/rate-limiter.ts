import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Rate limiter for password reset
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: 'Too many password reset requests, please try again later.',
});

// Rate limiter for file uploads
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 uploads per windowMs
  message: 'Too many file uploads, please try again later.',
});

// Rate limiter for report generation (CPU intensive)
export const reportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each IP to 5 report generations per windowMs
  message: 'Too many report generation requests, please try again later.',
});

// Custom handler for rate limit exceeded
export const handleRateLimitExceeded = (req: Request, res: Response) => {
  res.status(429).json({
    error: 'Rate limit exceeded',
    message: 'You have made too many requests. Please wait before trying again.',
    retryAfter: res.getHeader('Retry-After')
  });
};