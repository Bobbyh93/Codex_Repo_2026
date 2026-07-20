import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, addDays } from "date-fns";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Phone, 
  Mail, 
  User, 
  AlertCircle,
  CheckCircle,
  Loader2,
  Info
} from "lucide-react";

interface CallBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicName: string;
  topicId?: string;
  userId?: string;
}

export default function CallBookingModal({ 
  isOpen, 
  onClose, 
  topicName, 
  topicId, 
  userId 
}: CallBookingModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'info' | 'form' | 'schedule' | 'confirmation'>('info');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [formData, setFormData] = useState({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    urgency: 'medium',
    notes: ''
  });

  // Check available slots for selected date
  const { data: availableSlots, isLoading: slotsLoading } = useQuery({
    queryKey: ['/api/bookings/available-slots', selectedDate],
    enabled: !!selectedDate,
    queryFn: async () => {
      const response = await fetch(`/api/bookings/available-slots?date=${selectedDate?.toISOString()}`);
      if (!response.ok) throw new Error('Failed to fetch slots');
      return response.json();
    }
  });

  // Get queue statistics
  const { data: queueStats } = useQuery({
    queryKey: ['/api/admin/bookings/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/bookings/stats');
      if (!response.ok) return null;
      return response.json();
    }
  });

  // Booking mutation
  const bookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      return apiRequest('POST', '/api/bookings/request', bookingData);
    },
    onSuccess: () => {
      toast({
        title: "Call booked successfully!",
        description: "You'll receive a confirmation email shortly.",
      });
      setStep('confirmation');
      setTimeout(() => {
        onClose();
        setStep('info');
      }, 3000);
    },
    onError: (error) => {
      toast({
        title: "Booking failed",
        description: "Please try again or contact support.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = () => {
    if (!formData.contactName || !formData.contactEmail || !formData.contactPhone) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    const bookingData = {
      userId,
      topicId,
      topicName,
      ...formData,
      preferredTimeSlots: selectedTime ? [selectedTime] : [],
      scheduledAt: selectedTime || undefined
    };

    bookingMutation.mutate(bookingData);
  };

  const getEstimatedWaitTime = () => {
    if (!queueStats) return 'Unknown';
    const pendingCount = queueStats.pendingBookings || 0;
    const avgWaitTime = queueStats.averageWaitTime || 24;
    const estimatedHours = pendingCount * avgWaitTime;
    
    if (estimatedHours < 24) {
      return `${Math.round(estimatedHours)} hours`;
    } else {
      return `${Math.round(estimatedHours / 24)} days`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-call-booking">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Book a Consultation Call
          </DialogTitle>
          <DialogDescription>
            Get personalized help for: <span className="font-semibold">{topicName}</span>
          </DialogDescription>
        </DialogHeader>

        {step === 'info' && (
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Why book a call?</strong><br />
                This topic doesn't have pre-made resources yet. Our experts can provide personalized guidance 
                and create custom study materials during your call.
              </AlertDescription>
            </Alert>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Estimated wait time: <Badge variant="secondary">{getEstimatedWaitTime()}</Badge>
                    </span>
                  </div>
                  {queueStats && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {queueStats.pendingBookings} calls in queue
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-primary">30min</div>
                <div className="text-xs text-muted-foreground">Call Duration</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-primary">Free</div>
                <div className="text-xs text-muted-foreground">No Cost</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-primary">1-on-1</div>
                <div className="text-xs text-muted-foreground">Personal Help</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                className="flex-1" 
                onClick={() => setStep('form')}
                data-testid="button-continue-booking"
              >
                Continue to Book
              </Button>
              <Button variant="outline" onClick={onClose}>
                Maybe Later
              </Button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Full Name *
              </Label>
              <Input
                id="name"
                value={formData.contactName}
                onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                placeholder="John Doe"
                data-testid="input-contact-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Email Address *
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({...formData, contactEmail: e.target.value})}
                placeholder="john@example.com"
                data-testid="input-contact-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Phone Number *
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData({...formData, contactPhone: e.target.value})}
                placeholder="+1 (555) 123-4567"
                data-testid="input-contact-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="urgency" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                How urgent is this?
              </Label>
              <Select value={formData.urgency} onValueChange={(value) => setFormData({...formData, urgency: value})}>
                <SelectTrigger id="urgency" data-testid="select-urgency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - I have a few weeks</SelectItem>
                  <SelectItem value="medium">Medium - Within a week</SelectItem>
                  <SelectItem value="high">High - Next few days</SelectItem>
                  <SelectItem value="critical">Critical - ASAP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Tell us more about what you need help with..."
                className="min-h-[100px]"
                data-testid="textarea-notes"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('info')}>
                Back
              </Button>
              <Button 
                className="flex-1" 
                onClick={() => setStep('schedule')}
                data-testid="button-next-schedule"
              >
                Next: Choose Time
              </Button>
            </div>
          </div>
        )}

        {step === 'schedule' && (
          <div className="space-y-4">
            <Tabs defaultValue="preferred">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="preferred">Choose Preferred Time</TabsTrigger>
                <TabsTrigger value="flexible">I'm Flexible</TabsTrigger>
              </TabsList>
              
              <TabsContent value="preferred" className="space-y-4">
                <div className="space-y-2">
                  <Label>Select a Date</Label>
                  <Card>
                    <CardContent className="p-3">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => date < new Date() || date > addDays(new Date(), 30)}
                        className="rounded-md"
                      />
                    </CardContent>
                  </Card>
                </div>

                {selectedDate && (
                  <div className="space-y-2">
                    <Label>Available Time Slots</Label>
                    {slotsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : availableSlots && availableSlots.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {availableSlots.map((slot: any) => (
                          <Button
                            key={slot.time}
                            variant={selectedTime === slot.time ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedTime(slot.time)}
                            className="text-xs"
                            data-testid={`button-slot-${slot.time}`}
                          >
                            {format(new Date(slot.time), 'h:mm a')}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No available slots for this date. Please select another date.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="flexible">
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    We'll contact you within 24 hours to schedule a time that works for both of us.
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('form')}>
                Back
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleSubmit}
                disabled={bookingMutation.isPending}
                data-testid="button-confirm-booking"
              >
                {bookingMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Booking...
                  </>
                ) : (
                  'Confirm Booking'
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'confirmation' && (
          <div className="space-y-4 text-center py-8">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h3 className="text-xl font-semibold">Booking Confirmed!</h3>
            <p className="text-muted-foreground">
              Check your email for confirmation details.<br />
              We'll contact you soon to finalize the schedule.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}