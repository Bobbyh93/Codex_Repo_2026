import type { Express } from "express";
import { db } from "./db";
import { reviewTopics, topicContent, type InsertTopicContent } from "@shared/simplified-schema";
import { migrateToSimplifiedTopics, mapContentToTopics, CORE_REVIEW_TOPICS } from "./topic-migration";
import { eq, like, or } from "drizzle-orm";

export function registerSimplifiedContentRoutes(app: Express) {
  
  // Migration endpoint to create simplified topics
  app.post('/api/admin/migrate-topics', async (req, res) => {
    try {
      const result = await migrateToSimplifiedTopics();
      res.json({ success: true, message: "Topics migrated successfully", ...result });
    } catch (error) {
      console.error('Migration error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get all review topics
  app.get('/api/review-topics', async (req, res) => {
    try {
      const topics = await db.select().from(reviewTopics).orderBy(reviewTopics.name);
      res.json(topics);
    } catch (error) {
      console.error('Error fetching topics:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get topic with content
  app.get('/api/review-topics/:id', async (req, res) => {
    try {
      const topic = await db.select().from(reviewTopics).where(eq(reviewTopics.id, req.params.id)).limit(1);
      
      if (!topic.length) {
        return res.status(404).json({ error: 'Topic not found' });
      }

      const content = await db.select().from(topicContent).where(eq(topicContent.topicId, req.params.id));
      
      res.json({ 
        topic: topic[0], 
        content: content 
      });
    } catch (error) {
      console.error('Error fetching topic:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Smart content mapping endpoint - map content to topics automatically
  app.post('/api/admin/map-content-to-topics', async (req, res) => {
    try {
      const { content, title, source } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      // Get all topics for mapping
      const topics = await db.select().from(reviewTopics);
      
      // Smart mapping logic based on keywords
      const contentText = (title + ' ' + content).toLowerCase();
      let bestMatch = null;
      let bestScore = 0;

      for (const topic of topics) {
        let score = 0;
        const keywords = topic.keywords || [];
        
        // Check keyword matches
        for (const keyword of keywords) {
          if (contentText.includes(keyword.toLowerCase())) {
            score += 2; // Higher weight for exact keyword matches
          }
        }
        
        // Check topic name matches
        const topicWords = topic.name.toLowerCase().split(' ');
        for (const word of topicWords) {
          if (word.length > 3 && contentText.includes(word)) {
            score += 1;
          }
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = topic;
        }
      }

      if (!bestMatch || bestScore === 0) {
        // Default to Clinical Decision Making if no clear match
        bestMatch = topics.find(t => t.name === "Clinical Decision Making") || topics[0];
      }

      // Create content entry mapped to topic
      const newContent: InsertTopicContent = {
        topicId: bestMatch.id,
        title: title || "Imported Content",
        content: content,
        contentType: "text",
        source: source || "Import",
        difficulty: "Intermediate",
        tags: bestMatch.keywords || [],
        isReviewed: false
      };

      const result = await db.insert(topicContent).values(newContent).returning();

      res.json({ 
        success: true, 
        mappedTo: bestMatch.name,
        mappingScore: bestScore,
        contentId: result[0].id,
        topicId: bestMatch.id
      });

    } catch (error) {
      console.error('Error mapping content:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk content import with automatic topic mapping
  app.post('/api/admin/import-content-to-topics', async (req, res) => {
    try {
      const { contentItems } = req.body; // Array of { title, content, source }
      
      if (!Array.isArray(contentItems)) {
        return res.status(400).json({ error: 'contentItems must be an array' });
      }

      const topics = await db.select().from(reviewTopics);
      const results = [];

      for (const item of contentItems) {
        try {
          // Find best topic match
          const contentText = (item.title + ' ' + item.content).toLowerCase();
          let bestMatch = null;
          let bestScore = 0;

          for (const topic of topics) {
            let score = 0;
            const keywords = topic.keywords || [];
            
            for (const keyword of keywords) {
              if (contentText.includes(keyword.toLowerCase())) {
                score += 2;
              }
            }
            
            const topicWords = topic.name.toLowerCase().split(' ');
            for (const word of topicWords) {
              if (word.length > 3 && contentText.includes(word)) {
                score += 1;
              }
            }
            
            if (score > bestScore) {
              bestScore = score;
              bestMatch = topic;
            }
          }

          if (!bestMatch) {
            bestMatch = topics.find(t => t.name === "Clinical Decision Making") || topics[0];
          }

          // Insert content
          const newContent: InsertTopicContent = {
            topicId: bestMatch.id,
            title: item.title || "Imported Content",
            content: item.content,
            contentType: "text",
            source: item.source || "Bulk Import",
            difficulty: "Intermediate",
            tags: bestMatch.keywords?.slice(0, 5) || [],
            isReviewed: false
          };

          const result = await db.insert(topicContent).values(newContent).returning();
          
          results.push({
            success: true,
            title: item.title,
            mappedTo: bestMatch.name,
            mappingScore: bestScore,
            contentId: result[0].id
          });

        } catch (itemError) {
          results.push({
            success: false,
            title: item.title,
            error: itemError.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      
      res.json({
        success: true,
        message: `Imported ${successCount}/${contentItems.length} content items`,
        results: results
      });

    } catch (error) {
      console.error('Error importing content:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get topic statistics
  app.get('/api/admin/topic-stats', async (req, res) => {
    try {
      const topics = await db.select().from(reviewTopics);
      const stats = [];

      for (const topic of topics) {
        const contentCount = await db.select({ count: topicContent.id })
          .from(topicContent)
          .where(eq(topicContent.topicId, topic.id));
        
        stats.push({
          id: topic.id,
          name: topic.name,
          nclexCategory: topic.nclexCategory,
          nclexSubcategory: topic.nclexSubcategory,
          contentCount: contentCount.length || 0,
          difficulty: topic.difficulty,
          estimatedStudyTime: topic.estimatedStudyTime
        });
      }

      res.json(stats);
    } catch (error) {
      console.error('Error fetching topic stats:', error);
      res.status(500).json({ error: error.message });
    }
  });
}