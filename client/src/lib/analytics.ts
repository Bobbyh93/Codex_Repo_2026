// Simple analytics tracking for KPIs
export const track = (event: string, properties?: Record<string, any>) => {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Analytics] ${event}`, properties);
  }
  
  // You can integrate with any analytics service here (Google Analytics, Mixpanel, etc.)
  // For MVP, we'll just collect in local storage for demo purposes
  const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
  events.push({
    event,
    properties,
    timestamp: new Date().toISOString()
  });
  
  // Keep only last 100 events
  if (events.length > 100) {
    events.shift();
  }
  
  localStorage.setItem('analytics_events', JSON.stringify(events));
};

// Key events for tracking
export const EVENTS = {
  LANDING_VIEW: 'landing_view',
  UPLOAD_START: 'upload_start',
  UPLOAD_COMPLETE: 'upload_complete',
  MINI_VIEW: 'mini_view',
  CHECKOUT_OPEN: 'checkout_open',
  PURCHASE: 'purchase',
  FULL_SENT: 'full_sent',
  EMAIL_COLLECTED: 'email_collected',
  RESOURCE_CLICKED: 'resource_clicked',
  TOPIC_MARKED_COMPLETE: 'topic_marked_complete',
  SHARE_LINK_COPIED: 'share_link_copied',
  SHARE_LINK_CLICKED: 'share_link_clicked'
};

// Get analytics summary
export const getAnalyticsSummary = () => {
  const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
  
  const summary = {
    totalEvents: events.length,
    optInRate: 0,
    intakeCompletion: 0,
    upsellRate: 0
  };
  
  const landingViews = events.filter((e: any) => e.event === EVENTS.LANDING_VIEW).length;
  const uploads = events.filter((e: any) => e.event === EVENTS.UPLOAD_COMPLETE).length;
  const checkouts = events.filter((e: any) => e.event === EVENTS.CHECKOUT_OPEN).length;
  
  if (landingViews > 0) {
    summary.optInRate = Math.round((uploads / landingViews) * 100);
  }
  
  if (uploads > 0) {
    summary.intakeCompletion = Math.round((uploads / uploads) * 100); // Simplified for MVP
    summary.upsellRate = Math.round((checkouts / uploads) * 100);
  }
  
  return summary;
};