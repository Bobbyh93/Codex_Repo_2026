import { Request, Response } from 'express';
import { db } from './db';
import { users, assessmentReports } from '@shared/schema';
import { eq, like, sql, desc } from 'drizzle-orm';

export async function searchUsersByEmail(req: Request, res: Response) {
  try {
    const { email } = req.query;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    // Search for users with matching email (partial match)
    const searchPattern = `%${email}%`;
    
    // Get users with their assessment statistics
    const usersWithStats = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
        assessmentCount: sql<number>`COUNT(DISTINCT ${assessmentReports.id})`,
        averageScore: sql<number>`AVG(CAST(${assessmentReports.overallScore} AS FLOAT))`,
        lastAssessment: sql<string>`MAX(${assessmentReports.createdAt})`
      })
      .from(users)
      .leftJoin(assessmentReports, eq(users.id, assessmentReports.userId))
      .where(like(users.email, searchPattern))
      .groupBy(users.id, users.email, users.name, users.createdAt)
      .orderBy(desc(users.createdAt))
      .limit(10);

    // Format the results
    const formattedResults = usersWithStats.map(user => ({
      id: user.id.toString(),
      email: user.email,
      name: user.name || undefined,
      createdAt: user.createdAt?.toISOString(),
      assessmentCount: parseInt(user.assessmentCount?.toString() || '0'),
      averageScore: user.averageScore ? Math.round(user.averageScore) : undefined,
      lastAssessment: user.lastAssessment || undefined
    }));

    res.json(formattedResults);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
}

export async function getUserById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const userId = parseInt(id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Get user with assessment statistics
    const [userWithStats] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
        assessmentCount: sql<number>`COUNT(DISTINCT ${assessmentReports.id})`,
        averageScore: sql<number>`AVG(CAST(${assessmentReports.overallScore} AS FLOAT))`,
        lastAssessment: sql<string>`MAX(${assessmentReports.createdAt})`
      })
      .from(users)
      .leftJoin(assessmentReports, eq(users.id, assessmentReports.userId))
      .where(eq(users.id, userId))
      .groupBy(users.id, users.email, users.name, users.createdAt);

    if (!userWithStats) {
      return res.status(404).json({ error: 'User not found' });
    }

    const formattedUser = {
      id: userWithStats.id.toString(),
      email: userWithStats.email,
      name: userWithStats.name || undefined,
      createdAt: userWithStats.createdAt?.toISOString(),
      assessmentCount: parseInt(userWithStats.assessmentCount?.toString() || '0'),
      averageScore: userWithStats.averageScore ? Math.round(userWithStats.averageScore) : undefined,
      lastAssessment: userWithStats.lastAssessment || undefined
    };

    res.json(formattedUser);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

export async function getAllUsers(req: Request, res: Response) {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const usersList = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    const formattedUsers = usersList.map(user => ({
      id: user.id.toString(),
      email: user.email,
      name: user.name || undefined,
      createdAt: user.createdAt?.toISOString()
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}