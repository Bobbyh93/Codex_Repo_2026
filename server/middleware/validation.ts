import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// Email validation schema
export const emailSchema = z.string().email().toLowerCase();

// Password validation schema (minimum 8 characters, at least one letter and one number)
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// UUID validation schema
export const uuidSchema = z.string().uuid();

// Sanitize string input (remove potential XSS/SQL injection attempts)
export const sanitizedStringSchema = z.string()
  .transform(str => str.trim())
  .refine(str => !str.includes('<script'), 'Invalid input detected')
  .refine(str => !str.includes('DROP TABLE'), 'Invalid input detected')
  .refine(str => !str.includes('DELETE FROM'), 'Invalid input detected');

// Request validation middleware factory
export function validateRequest(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}

// Common request schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  school: z.string().trim().max(160).optional(),
  role: z.enum(['student', 'instructor', 'admin']).optional()
}).refine(
  (data) => Boolean(data.name || data.username || data.firstName || data.lastName),
  {
    message: 'Name, first name, or username is required',
    path: ['name']
  }
);

export const resetPasswordRequestSchema = z.object({
  email: emailSchema
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema
});

// Sanitize query parameters
export function sanitizeQuery(req: Request, res: Response, next: NextFunction) {
  // Sanitize common query parameters
  if (req.query.search && typeof req.query.search === 'string') {
    req.query.search = req.query.search.replace(/[<>'"]/g, '');
  }
  
  if (req.query.limit) {
    const limit = parseInt(req.query.limit as string);
    req.query.limit = isNaN(limit) || limit < 1 || limit > 100 ? '10' : limit.toString();
  }
  
  if (req.query.offset) {
    const offset = parseInt(req.query.offset as string);
    req.query.offset = isNaN(offset) || offset < 0 ? '0' : offset.toString();
  }
  
  next();
}

// Validate UUID parameters
export function validateUUID(paramName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[paramName];
    try {
      uuidSchema.parse(value);
      next();
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid parameter',
        message: `Invalid ${paramName} format`
      });
    }
  };
}

// Database table name validation schema
export const tableNameSchema = z.string()
  .min(1, 'Table name is required')
  .max(63, 'Table name too long') // PostgreSQL limit
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Invalid table name format')
  .refine(name => !name.toLowerCase().startsWith('pg_'), 'System tables not allowed')
  .refine(name => !name.toLowerCase().startsWith('information_schema'), 'System tables not allowed');

// Database column name validation schema
export const columnNameSchema = z.string()
  .min(1, 'Column name is required')
  .max(63, 'Column name too long')
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Invalid column name format');

// SQL query validation for SELECT-only operations
export const selectQuerySchema = z.string()
  .min(1, 'Query is required')
  .refine(query => {
    const normalized = query.trim().toLowerCase();
    return normalized.startsWith('select') || normalized.startsWith('with');
  }, 'Only SELECT and WITH queries are allowed')
  .refine(query => {
    const dangerous = ['drop', 'delete', 'update', 'insert', 'alter', 'create', 'truncate', 'grant', 'revoke'];
    const normalized = query.toLowerCase();
    return !dangerous.some(keyword => normalized.includes(keyword));
  }, 'Query contains dangerous operations');

// Database update validation schema
export const databaseUpdateSchema = z.object({
  data: z.record(z.string(), z.any()).refine(
    data => Object.keys(data).length > 0,
    'Update data cannot be empty'
  ).refine(
    data => Object.keys(data).every(key => columnNameSchema.safeParse(key).success),
    'Invalid column names in update data'
  ),
  original: z.record(z.string(), z.any()).refine(
    data => Object.keys(data).length > 0,
    'Original data for comparison is required'
  )
});

// Database import validation schema
export const databaseImportSchema = z.object({
  data: z.array(
    z.record(z.string(), z.any())
      .refine(
        row => Object.keys(row).every(key => columnNameSchema.safeParse(key).success),
        'Invalid column names in import data'
      )
  ).min(1, 'Import data cannot be empty').max(1000, 'Too many rows for single import')
});

// SQL query execution schema
export const queryExecutionSchema = z.object({
  query: selectQuerySchema
});

// Validate database table name parameter
export function validateTableName(req: Request, res: Response, next: NextFunction) {
  try {
    const tableName = req.params.tableName;
    tableNameSchema.parse(tableName);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid table name',
        details: error.errors.map(e => e.message)
      });
    }
    next(error);
  }
}
