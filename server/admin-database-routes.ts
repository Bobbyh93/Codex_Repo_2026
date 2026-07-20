import type { Express, Request, Response } from "express";
import { db, pool } from "./db";
import { sql } from "drizzle-orm";
import { AdminAuthSession, requireAdminSession, requirePermission, auditLog, validateCSRFToken, type AdminAuthRequest } from "./admin-auth-session";
import { 
  validateRequest, 
  validateTableName, 
  sanitizeQuery,
  databaseUpdateSchema,
  databaseImportSchema,
  queryExecutionSchema 
} from "./middleware/validation";

export function registerAdminDatabaseRoutes(app: Express) {
  // Use session-based authentication for admin database routes
  const requireAdmin = [requireAdminSession];
  const requireSQLPermission = [requireAdminSession, requirePermission('sql_console')];

  // Get system database status
  app.get("/api/admin/system/database-status", requireAdmin, auditLog('VIEW_DB_STATUS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      // Test database connection
      const testResult = await db.execute(sql`SELECT 1 as connected`);
      
      // Get table count
      const tablesResult = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);

      res.json({
        connected: true,
        tableCount: parseInt(tablesResult.rows[0]?.count as string || '0'),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Database status check failed:", error);
      res.json({
        connected: false,
        tableCount: 0,
        error: "Database connection failed"
      });
    }
  });

  // Get all tables with metadata  
  app.get("/api/admin/database/tables", requireSQLPermission, auditLog('LIST_TABLES'), async (req: AdminAuthRequest, res: Response) => {
    try {
      // Get all tables in the public schema
      const tablesResult = await db.execute(sql`
        SELECT 
          table_name,
          (SELECT COUNT(*) 
           FROM information_schema.columns 
           WHERE table_schema = 'public' 
           AND table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      // Get row counts and column details for each table
      const tablesWithDetails = await Promise.all(
        tablesResult.rows.map(async (table: any) => {
          const tableName = table.table_name;
          
          // Get row count
          let rowCount = 0;
          try {
            const countResult = await db.execute(
              sql`SELECT COUNT(*) as count FROM ${sql.identifier(tableName)}`
            );
            rowCount = parseInt(countResult.rows[0]?.count as string || '0');
          } catch (e) {
            console.error(`Failed to count rows for ${tableName}:`, e);
          }

          // Get column information
          const columnsResult = await db.execute(sql`
            SELECT 
              column_name as name,
              data_type as type,
              is_nullable = 'YES' as nullable,
              column_default as default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ${tableName}
            ORDER BY ordinal_position
          `);

          return {
            name: tableName,
            rowCount,
            columns: columnsResult.rows
          };
        })
      );

      res.json({
        tables: tablesWithDetails
      });
    } catch (error) {
      console.error("Failed to fetch tables:", error);
      res.status(500).json({ error: "Failed to fetch database tables" });
    }
  });

  // Get table data
  app.get("/api/admin/database/tables/:tableName", requireSQLPermission, validateTableName, sanitizeQuery, auditLog('VIEW_TABLE_DATA'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { tableName } = req.params;
      const { limit = 100, offset = 0 } = req.query;

      // Validate table name to prevent SQL injection
      const tableValidation = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        ) as exists
      `);

      if (!tableValidation.rows[0]?.exists) {
        return res.status(404).json({ error: "Table not found" });
      }

      // Get table schema
      const schemaResult = await db.execute(sql`
        SELECT 
          column_name as name,
          data_type as type,
          is_nullable = 'YES' as nullable,
          column_default as default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${tableName}
        ORDER BY ordinal_position
      `);

      // Validate and sanitize limit and offset parameters
      const parsedLimit = Math.min(Math.max(parseInt(limit as string) || 100, 1), 1000);
      const parsedOffset = Math.max(parseInt(offset as string) || 0, 0);

      // Get table data with safe parameterized query
      const dataResult = await pool.query(
        `SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`,
        [parsedLimit, parsedOffset]
      );

      res.json({
        schema: schemaResult.rows,
        rows: dataResult.rows
      });
    } catch (error) {
      console.error("Failed to fetch table data:", error);
      res.status(500).json({ error: "Failed to fetch table data" });
    }
  });

  // Execute SQL query (SELECT-only for security)
  app.post("/api/admin/database/query", requireSQLPermission, validateCSRFToken, validateRequest(queryExecutionSchema), auditLog('EXECUTE_SQL'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { query } = req.body;

      // Execute the validated SELECT query
      const result = await db.execute(sql.raw(query));

      res.json({
        rows: result.rows,
        rowCount: result.rowCount
      });
    } catch (error: any) {
      console.error("Query execution failed:", error);
      res.status(400).json({ 
        error: error.message || "Query execution failed"
      });
    }
  });

  // Update table row with secure parameterized queries
  app.put("/api/admin/database/tables/:tableName/update", requireSQLPermission, validateCSRFToken, validateTableName, validateRequest(databaseUpdateSchema), auditLog('UPDATE_TABLE'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { tableName } = req.params;
      const { data, original } = req.body;

      // Validate table exists
      const tableValidation = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        ) as exists
      `);

      if (!tableValidation.rows[0]?.exists) {
        return res.status(404).json({ error: "Table not found" });
      }

      // Find primary key or unique identifier
      const pkResult = await db.execute(sql`
        SELECT column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage AS ccu 
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_schema = 'public' 
          AND tc.table_name = ${tableName}
          AND tc.constraint_type = 'PRIMARY KEY'
      `);

      if (pkResult.rows.length === 0) {
        return res.status(400).json({ 
          error: "Cannot update table without primary key" 
        });
      }

      const pkColumn = pkResult.rows[0].column_name as string;
      const pkValue = original[pkColumn];

      if (!pkValue) {
        return res.status(400).json({ 
          error: "Primary key value is required for update" 
        });
      }

      // Build UPDATE query with proper parameterized values
      const setClause = Object.keys(data)
        .map((key, index) => `"${key}" = $${index + 1}`)
        .join(', ');

      const updateQuery = `UPDATE "${tableName}" SET ${setClause} WHERE "${pkColumn}" = $${Object.keys(data).length + 1}`;
      const values = [...Object.values(data), pkValue];

      // Execute parameterized query to prevent SQL injection
      await pool.query(updateQuery, values);

      res.json({
        message: "Row updated successfully"
      });
    } catch (error: any) {
      console.error("Failed to update row:", error);
      res.status(500).json({ 
        error: error.message || "Failed to update row" 
      });
    }
  });

  // Export table as CSV
  app.get("/api/admin/database/tables/:tableName/export", requireSQLPermission, validateTableName, auditLog('EXPORT_TABLE'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { tableName } = req.params;

      // Validate table exists
      const tableValidation = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        ) as exists
      `);

      if (!tableValidation.rows[0]?.exists) {
        return res.status(404).json({ error: "Table not found" });
      }

      // Validate table name inline as defense-in-depth before raw identifier interpolation
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(tableName)) {
        return res.status(400).json({ error: "Invalid table name" });
      }

      // Get all data from table (tableName is safe: validated by regex above and middleware)
      const dataResult = await db.execute(
        sql.raw(`SELECT * FROM "${tableName}"`)
      );

      if (dataResult.rows.length === 0) {
        return res.status(404).json({ error: "No data to export" });
      }

      // Convert to CSV
      const headers = Object.keys(dataResult.rows[0]);
      const csvRows = [
        headers.join(','),
        ...dataResult.rows.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape values containing commas or quotes
            if (value === null) return '';
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          }).join(',')
        )
      ];

      const csv = csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${tableName}-export.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Failed to export table:", error);
      res.status(500).json({ error: "Failed to export table" });
    }
  });

  // Import data to table with secure parameterized queries
  app.post("/api/admin/database/tables/:tableName/import", requireAdmin, validateTableName, validateRequest(databaseImportSchema), async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      const { data } = req.body;

      // Validate table exists
      const tableValidation = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        ) as exists
      `);

      if (!tableValidation.rows[0]?.exists) {
        return res.status(404).json({ error: "Table not found" });
      }

      // Get table columns to validate data structure
      const columnsResult = await db.execute(sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${tableName}
        ORDER BY ordinal_position
      `);

      const validColumns = new Set(columnsResult.rows.map(row => row.column_name));

      // Insert data using parameterized queries
      let inserted = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const row of data) {
        try {
          // Validate that all columns exist in the table
          const rowColumns = Object.keys(row);
          const invalidColumns = rowColumns.filter(col => !validColumns.has(col));
          
          if (invalidColumns.length > 0) {
            throw new Error(`Invalid columns: ${invalidColumns.join(', ')}`);
          }

          if (rowColumns.length === 0) {
            throw new Error('Row has no data');
          }

          // Build parameterized INSERT query
          const escapeIdentifier = (name: string) => `"${name.replace(/"/g, '""')}"`;
          const columns = rowColumns.map(escapeIdentifier).join(', ');
          const placeholders = rowColumns.map((_, index) => `$${index + 1}`).join(', ');
          const values = rowColumns.map(key => row[key]);

          const insertQuery = `INSERT INTO ${escapeIdentifier(tableName)} (${columns}) VALUES (${placeholders})`;
          await pool.query(insertQuery, values);
          inserted++;
        } catch (error: any) {
          failed++;
          errors.push(`Row ${inserted + failed}: ${error.message}`);
        }
      }

      res.json({
        message: "Import completed",
        inserted,
        failed,
        errors: errors.slice(0, 10) // Limit error messages
      });
    } catch (error) {
      console.error("Failed to import data:", error);
      res.status(500).json({ error: "Failed to import data" });
    }
  });
}