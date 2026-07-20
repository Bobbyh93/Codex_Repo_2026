import { storage } from "./storage";
import { db } from "./db";
import { 
  callBookings, 
  leads, 
  adminAvailability,
  users,
  adminUsers,
  nursingTopics
} from "@shared/schema";
import { 
  type CallBooking, 
  type InsertCallBooking,
  type Lead,
  type InsertLead,
  type AdminAvailability,
  type InsertAdminAvailability
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import sgMail from "@sendgrid/mail";

// Configure SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@nurseprepdemo.com";

if (SENDGRID_API_KEY && typeof SENDGRID_API_KEY === 'string') {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export class CallBookingSystem {
  /**
   * Schedule a new call booking
   */
  async scheduleCall(booking: InsertCallBooking): Promise<CallBooking> {
    // Create the booking
    const newBooking = await storage.createCallBooking(booking);
    
    // Create a lead entry for tracking
    await storage.createLead({
      bookingId: newBooking.id,
      userId: booking.userId,
      status: 'cold',
      score: this.calculateInitialLeadScore(booking),
      source: 'unmapped_topic',
      interestedTopics: booking.topicName ? [booking.topicName] : [],
      firstContactDate: new Date(),
      numberOfContacts: 0,
      engagementLevel: this.getEngagementLevel(booking.urgency || 'medium'),
    });
    
    // Send confirmation email
    if (SENDGRID_API_KEY && booking.contactEmail) {
      await this.sendBookingConfirmation(newBooking);
    }
    
    // Track demand for this topic
    if (booking.topicId) {
      await storage.trackTopicDemand({
        topicId: booking.topicId,
        userId: booking.userId,
        source: 'call_booking',
        priority: this.getUrgencyPriority(booking.urgency || 'medium'),
        metadata: {
          context: 'Requested call for unmapped topic resources'
        }
      });
    }
    
    return newBooking;
  }
  
  /**
   * Get available time slots for booking
   */
  async getAvailableSlots(
    date: Date, 
    adminId?: string
  ): Promise<{ time: string; adminId: string; adminName: string }[]> {
    const slots = await storage.getAvailableTimeSlots(date, adminId);
    
    // Get admin details for each slot
    const adminsAvailable = await db
      .select({
        adminId: adminAvailability.adminId,
        adminEmail: adminUsers.email
      })
      .from(adminAvailability)
      .leftJoin(adminUsers, eq(adminAvailability.adminId, adminUsers.id))
      .where(and(
        eq(adminAvailability.dayOfWeek, date.getDay()),
        eq(adminAvailability.isActive, true)
      ));
    
    const enrichedSlots = [];
    for (const slot of slots) {
      for (const admin of adminsAvailable) {
        enrichedSlots.push({
          time: slot,
          adminId: admin.adminId,
          adminName: admin.adminEmail || 'Admin'
        });
      }
    }
    
    return enrichedSlots;
  }
  
  /**
   * Update call booking status
   */
  async updateCallStatus(
    bookingId: string,
    status: string,
    adminId?: string,
    notes?: string
  ): Promise<CallBooking> {
    const updates: Partial<CallBooking> = { status };
    
    if (status === 'completed' && adminId) {
      updates.completedAt = new Date();
      updates.completedBy = adminId;
    } else if (status === 'cancelled') {
      updates.cancelledAt = new Date();
      updates.cancelReason = notes;
    }
    
    if (notes) {
      updates.adminNotes = notes;
    }
    
    const updatedBooking = await storage.updateCallBooking(bookingId, updates);
    
    // Update lead status based on call status
    const lead = await storage.getLeadByBookingId(bookingId);
    if (lead) {
      await this.updateLeadBasedOnCallStatus(lead.id, status);
    }
    
    // Send status update email
    if (SENDGRID_API_KEY && updatedBooking.contactEmail) {
      await this.sendStatusUpdateEmail(updatedBooking);
    }
    
    return updatedBooking;
  }
  
  /**
   * Assign call to specific admin
   */
  async assignToAdmin(bookingId: string, adminId: string): Promise<CallBooking> {
    const updatedBooking = await storage.updateCallBooking(bookingId, {
      assignedTo: adminId,
      status: 'scheduled'
    });
    
    // Update lead assignment
    const lead = await storage.getLeadByBookingId(bookingId);
    if (lead) {
      await storage.updateLead(lead.id, {
        assignedTo: adminId,
        lastContactDate: new Date()
      });
    }
    
    return updatedBooking;
  }
  
  /**
   * Track lead status and conversion
   */
  async trackLeadStatus(
    leadId: string,
    status: string,
    conversionValue?: number,
    conversionType?: string
  ): Promise<Lead> {
    const updates: Partial<Lead> = {
      status,
      lastContactDate: new Date(),
      numberOfContacts: sql<number>`COALESCE(${leads.numberOfContacts}, 0) + 1` as any
    };
    
    if (status === 'converted' && conversionValue) {
      updates.conversionValue = conversionValue.toString();
      updates.conversionType = conversionType;
      updates.conversionDate = new Date();
    } else if (status === 'lost') {
      updates.lostReason = conversionType; // Using conversionType as lost reason in this case
    }
    
    // Update engagement level based on status
    updates.engagementLevel = this.getEngagementFromStatus(status);
    
    // Calculate and update lead score
    const lead = await storage.getLeadById(leadId);
    if (lead) {
      updates.score = this.calculateLeadScore(lead, status);
    }
    
    return await storage.updateLead(leadId, updates);
  }
  
  /**
   * Get call queue prioritized by urgency
   */
  async getCallQueue(): Promise<(CallBooking & { lead?: Lead })[]> {
    const bookings = await storage.getCallBookingQueue();
    
    // Enrich with lead information
    const enrichedBookings = [];
    for (const booking of bookings) {
      const lead = await storage.getLeadByBookingId(booking.id);
      enrichedBookings.push({
        ...booking,
        lead
      });
    }
    
    return enrichedBookings;
  }
  
  /**
   * Get booking statistics and metrics
   */
  async getBookingStats(): Promise<{
    totalBookings: number;
    pendingBookings: number;
    scheduledBookings: number;
    completedBookings: number;
    averageWaitTime: number;
    topRequestedTopics: { topic: string; count: number }[];
    conversionMetrics: any;
  }> {
    const allBookings = await storage.getCallBookings();
    
    const stats = {
      totalBookings: allBookings.length,
      pendingBookings: allBookings.filter(b => b.status === 'pending').length,
      scheduledBookings: allBookings.filter(b => b.status === 'scheduled').length,
      completedBookings: allBookings.filter(b => b.status === 'completed').length,
      averageWaitTime: 0,
      topRequestedTopics: [] as { topic: string; count: number }[],
      conversionMetrics: await storage.getLeadMetrics()
    };
    
    // Calculate average wait time for completed bookings
    const completedBookings = allBookings.filter(b => b.status === 'completed' && b.completedAt);
    if (completedBookings.length > 0) {
      const totalWaitTime = completedBookings.reduce((acc, booking) => {
        if (!booking.completedAt) return acc;
        const completedDate = booking.completedAt instanceof Date ? booking.completedAt : new Date(booking.completedAt);
        const createdDate = booking.createdAt instanceof Date ? booking.createdAt : booking.createdAt ? new Date(booking.createdAt) : new Date();
        const waitTime = completedDate.getTime() - createdDate.getTime();
        return acc + waitTime;
      }, 0);
      stats.averageWaitTime = totalWaitTime / completedBookings.length / (1000 * 60 * 60); // Convert to hours
    }
    
    // Get top requested topics
    const topicCounts = new Map<string, number>();
    for (const booking of allBookings) {
      if (booking.topicName) {
        topicCounts.set(booking.topicName, (topicCounts.get(booking.topicName) || 0) + 1);
      }
    }
    
    stats.topRequestedTopics = Array.from(topicCounts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return stats;
  }
  
  /**
   * Create or update admin availability
   */
  async setAdminAvailability(availability: InsertAdminAvailability): Promise<AdminAvailability> {
    // Check if availability already exists for this admin and day
    const existing = await db
      .select()
      .from(adminAvailability)
      .where(and(
        eq(adminAvailability.adminId, availability.adminId),
        eq(adminAvailability.dayOfWeek, availability.dayOfWeek)
      ));
    
    if (existing.length > 0) {
      return await storage.updateAdminAvailability(existing[0].id, availability);
    } else {
      return await storage.createAdminAvailability(availability);
    }
  }
  
  /**
   * Auto-detect unmapped topics and suggest booking
   */
  async detectUnmappedTopicRequest(
    topicName: string,
    userId?: string
  ): Promise<{ shouldOfferCall: boolean; reason: string }> {
    // Check if topic exists in database
    const topic = await db
      .select()
      .from(nursingTopics)
      .where(sql`${nursingTopics.name} ILIKE ${'%' + topicName + '%'}`);
    
    if (topic.length === 0) {
      return {
        shouldOfferCall: true,
        reason: 'Topic not found in our database. Would you like to schedule a call with our expert?'
      };
    }
    
    // Check if topic has resources
    const topicId = topic[0].id;
    const resourceAvailability = await storage.getResourceAvailabilityForTopics([topicId]);
    
    if (!resourceAvailability.get(topicId)) {
      return {
        shouldOfferCall: true,
        reason: 'We don\'t have resources for this topic yet. Schedule a call for personalized help!'
      };
    }
    
    return {
      shouldOfferCall: false,
      reason: 'Resources available for this topic'
    };
  }
  
  // Private helper methods
  
  private calculateInitialLeadScore(booking: InsertCallBooking): number {
    let score = 50; // Base score
    
    // Adjust based on urgency
    if (booking.urgency === 'critical') score += 30;
    else if (booking.urgency === 'high') score += 20;
    else if (booking.urgency === 'medium') score += 10;
    
    // Adjust based on notes (engagement indicator)
    if (booking.notes && booking.notes.length > 100) score += 10;
    
    return Math.min(score, 100);
  }
  
  private calculateLeadScore(lead: Lead, newStatus: string): number {
    let score = lead.score || 0;
    
    // Adjust based on status progression
    if (newStatus === 'warm') score = Math.max(score, 60);
    else if (newStatus === 'hot') score = Math.max(score, 80);
    else if (newStatus === 'qualified') score = Math.max(score, 90);
    else if (newStatus === 'converted') score = 100;
    else if (newStatus === 'lost') score = Math.min(score, 20);
    
    // Adjust based on engagement
    if ((lead.numberOfContacts || 0) > 3) score += 5;
    if (lead.engagementLevel === 'high') score += 10;
    
    return Math.min(score, 100);
  }
  
  private getEngagementLevel(urgency?: string): string {
    switch (urgency) {
      case 'critical':
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      default:
        return 'low';
    }
  }
  
  private getEngagementFromStatus(status: string): string {
    switch (status) {
      case 'hot':
      case 'qualified':
      case 'converted':
        return 'high';
      case 'warm':
        return 'medium';
      default:
        return 'low';
    }
  }
  
  private getUrgencyPriority(urgency: string): number {
    switch (urgency) {
      case 'critical': return 5;
      case 'high': return 4;
      case 'medium': return 3;
      case 'low': return 2;
      default: return 1;
    }
  }
  
  private async updateLeadBasedOnCallStatus(leadId: string, callStatus: string): Promise<void> {
    let leadStatus = 'cold';
    
    switch (callStatus) {
      case 'scheduled':
        leadStatus = 'warm';
        break;
      case 'completed':
        leadStatus = 'hot';
        break;
      case 'cancelled':
      case 'no_show':
        leadStatus = 'lost';
        break;
    }
    
    await storage.updateLead(leadId, {
      status: leadStatus,
      lastContactDate: new Date()
    });
  }
  
  private async sendBookingConfirmation(booking: CallBooking): Promise<void> {
    const msg = {
      to: booking.contactEmail,
      from: FROM_EMAIL,
      subject: 'Call Booking Confirmation - NursePrep Analytics',
      html: `
        <h2>Your Call Has Been Scheduled</h2>
        <p>Dear ${booking.contactName},</p>
        <p>Thank you for booking a call with us regarding "${booking.topicName}".</p>
        <p><strong>Status:</strong> ${booking.status}</p>
        ${booking.scheduledAt ? `<p><strong>Scheduled for:</strong> ${new Date(booking.scheduledAt).toLocaleString()}</p>` : ''}
        <p><strong>Priority:</strong> ${booking.urgency}</p>
        <p>We'll be in touch soon with more details.</p>
        <p>Best regards,<br>NursePrep Analytics Team</p>
      `
    };
    
    try {
      await sgMail.send(msg);
    } catch (error) {
      console.error('Failed to send booking confirmation email:', error);
    }
  }
  
  private async sendStatusUpdateEmail(booking: CallBooking): Promise<void> {
    let subject = 'Call Booking Update - NursePrep Analytics';
    let statusMessage = '';
    
    switch (booking.status) {
      case 'scheduled':
        statusMessage = `Your call has been scheduled for ${booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString() : 'soon'}.`;
        break;
      case 'completed':
        statusMessage = 'Your call has been completed. Thank you for your time!';
        break;
      case 'cancelled':
        statusMessage = `Your call has been cancelled. ${booking.cancelReason || 'Please contact us if you need to reschedule.'}`;
        break;
      default:
        statusMessage = `Your call status has been updated to: ${booking.status}`;
    }
    
    const msg = {
      to: booking.contactEmail,
      from: FROM_EMAIL,
      subject,
      html: `
        <h2>Call Booking Update</h2>
        <p>Dear ${booking.contactName},</p>
        <p>${statusMessage}</p>
        <p><strong>Topic:</strong> ${booking.topicName}</p>
        ${booking.adminNotes ? `<p><strong>Notes:</strong> ${booking.adminNotes}</p>` : ''}
        <p>Best regards,<br>NursePrep Analytics Team</p>
      `
    };
    
    try {
      await sgMail.send(msg);
    } catch (error) {
      console.error('Failed to send status update email:', error);
    }
  }
}

export const callBookingSystem = new CallBookingSystem();