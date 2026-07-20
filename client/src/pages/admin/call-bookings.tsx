import { useState } from 'react';
import AdminLayout from '@/components/admin/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { format } from 'date-fns';
import {
  Phone,
  Calendar,
  Clock,
  User,
  Mail,
  AlertCircle,
  CheckCircle,
  XCircle,
  DollarSign,
  TrendingUp,
  Users,
  PhoneCall,
  FileText,
  Download,
  Filter,
  Search,
  ChevronRight,
  Loader2,
  MessageSquare,
  Target,
  Activity,
  PhoneMissed,
  PhoneOff
} from 'lucide-react';

export default function CallBookingsAdmin() {
  const { toast } = useToast();
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // Fetch bookings
  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['/api/admin/bookings', filterStatus],
    queryFn: async () => {
      const params = filterStatus !== 'all' ? `?status=${filterStatus}` : '';
      const response = await fetch(`/api/admin/bookings${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch bookings');
      return response.json();
    }
  });

  // Fetch booking stats
  const { data: stats } = useQuery({
    queryKey: ['/api/admin/bookings/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/bookings/stats', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    }
  });

  // Fetch lead metrics
  const { data: leadMetrics } = useQuery({
    queryKey: ['/api/admin/leads/metrics'],
    queryFn: async () => {
      const response = await fetch('/api/admin/leads/metrics', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    }
  });

  // Update booking status mutation
  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const csrfToken = (window as any).csrfToken;
      const response = await fetch(`/api/admin/bookings/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(updates),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to update booking');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bookings/stats'] });
      toast({
        title: "Booking updated",
        description: "The booking status has been updated successfully.",
      });
      setSelectedBooking(null);
    }
  });

  // Add notes mutation
  const addNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const csrfToken = (window as any).csrfToken;
      const response = await fetch(`/api/admin/bookings/${id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ notes }),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to add notes');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bookings'] });
      toast({
        title: "Notes added",
        description: "Admin notes have been added to the booking.",
      });
      setAdminNotes('');
    }
  });

  // Update lead status mutation
  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, status, conversionValue, conversionType }: any) => {
      const csrfToken = (window as any).csrfToken;
      const response = await fetch(`/api/admin/leads/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ status, conversionValue, conversionType }),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to update lead');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/leads/metrics'] });
      toast({
        title: "Lead updated",
        description: "Lead status has been updated successfully.",
      });
    }
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'scheduled': return 'default';
      case 'completed': return 'outline';
      case 'cancelled': return 'destructive';
      case 'no_show': return 'destructive';
      default: return 'secondary';
    }
  };

  const getUrgencyBadgeVariant = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getLeadStatusColor = (status: string) => {
    switch (status) {
      case 'cold': return 'text-blue-500';
      case 'warm': return 'text-yellow-500';
      case 'hot': return 'text-orange-500';
      case 'qualified': return 'text-purple-500';
      case 'converted': return 'text-green-500';
      case 'lost': return 'text-gray-500';
      default: return '';
    }
  };

  const filteredBookings = bookings?.filter((booking: any) =>
    searchQuery === '' ||
    booking.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    booking.contactEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    booking.topicName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportToCSV = () => {
    if (!bookings) return;

    const csv = [
      ['Date', 'Name', 'Email', 'Phone', 'Topic', 'Status', 'Lead Status', 'Urgency', 'Notes'].join(','),
      ...bookings.map((booking: any) => [
        booking.createdAt && !isNaN(new Date(booking.createdAt).getTime()) ? format(new Date(booking.createdAt), 'yyyy-MM-dd') : '',
        booking.contactName,
        booking.contactEmail,
        booking.contactPhone,
        booking.topicName,
        booking.status,
        booking.lead?.status || 'N/A',
        booking.urgency,
        booking.notes || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-bookings-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Phone className="h-8 w-8" />
              Call Booking Manager
            </h1>
            <p className="text-muted-foreground">
              Manage consultation calls and track lead conversions
            </p>
          </div>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export to CSV
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalBookings || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.pendingBookings || 0} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {leadMetrics?.conversionRate?.toFixed(1) || 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                {leadMetrics?.convertedLeads || 0} converted
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.averageWaitTime?.toFixed(0) || 0}h
              </div>
              <p className="text-xs text-muted-foreground">
                Until scheduled
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${leadMetrics?.averageConversionValue?.toFixed(0) || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Per conversion
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="bookings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4" />
              Bookings
            </TabsTrigger>
            <TabsTrigger value="queue" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Queue
            </TabsTrigger>
            <TabsTrigger value="leads" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Leads
            </TabsTrigger>
            <TabsTrigger value="topics" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Top Topics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>All Bookings</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search bookings..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-64"
                        data-testid="input-search-bookings"
                      />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-32" data-testid="select-filter-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {bookingsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Topic</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Lead</TableHead>
                        <TableHead>Urgency</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBookings?.map((booking: any) => (
                        <TableRow key={booking.id}>
                          <TableCell>
                            {booking.createdAt && !isNaN(new Date(booking.createdAt).getTime()) ? format(new Date(booking.createdAt), 'MMM d, yyyy') : "—"}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{booking.contactName}</div>
                              <div className="text-sm text-muted-foreground">{booking.contactEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <div className="truncate">{booking.topicName}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(booking.status)}>
                              {booking.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {booking.lead && (
                              <span className={`font-medium ${getLeadStatusColor(booking.lead.status)}`}>
                                {booking.lead.status}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getUrgencyBadgeVariant(booking.urgency)}>
                              {booking.urgency}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedBooking(booking)}
                                  data-testid={`button-manage-${booking.id}`}
                                >
                                  Manage
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Booking Details</DialogTitle>
                                  <DialogDescription>
                                    Manage booking and lead information
                                  </DialogDescription>
                                </DialogHeader>
                                {selectedBooking && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label>Contact Name</Label>
                                        <div className="font-medium">{selectedBooking.contactName}</div>
                                      </div>
                                      <div>
                                        <Label>Email</Label>
                                        <div className="font-medium">{selectedBooking.contactEmail}</div>
                                      </div>
                                      <div>
                                        <Label>Phone</Label>
                                        <div className="font-medium">{selectedBooking.contactPhone}</div>
                                      </div>
                                      <div>
                                        <Label>Topic</Label>
                                        <div className="font-medium">{selectedBooking.topicName}</div>
                                      </div>
                                    </div>

                                    <Separator />

                                    <div className="space-y-2">
                                      <Label>Update Status</Label>
                                      <Select 
                                        value={selectedBooking.status}
                                        onValueChange={(value) => 
                                          updateBookingMutation.mutate({
                                            id: selectedBooking.id,
                                            updates: { status: value }
                                          })
                                        }
                                      >
                                        <SelectTrigger data-testid="select-booking-status">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="pending">Pending</SelectItem>
                                          <SelectItem value="scheduled">Scheduled</SelectItem>
                                          <SelectItem value="completed">Completed</SelectItem>
                                          <SelectItem value="cancelled">Cancelled</SelectItem>
                                          <SelectItem value="no_show">No Show</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {selectedBooking.lead && (
                                      <>
                                        <Separator />
                                        <div className="space-y-2">
                                          <Label>Lead Status</Label>
                                          <Select 
                                            value={selectedBooking.lead.status}
                                            onValueChange={(value) => 
                                              updateLeadMutation.mutate({
                                                id: selectedBooking.lead.id,
                                                status: value
                                              })
                                            }
                                          >
                                            <SelectTrigger data-testid="select-lead-status">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="cold">Cold</SelectItem>
                                              <SelectItem value="warm">Warm</SelectItem>
                                              <SelectItem value="hot">Hot</SelectItem>
                                              <SelectItem value="qualified">Qualified</SelectItem>
                                              <SelectItem value="converted">Converted</SelectItem>
                                              <SelectItem value="lost">Lost</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </>
                                    )}

                                    <Separator />

                                    <div className="space-y-2">
                                      <Label>Admin Notes</Label>
                                      <Textarea
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                        placeholder="Add notes about this booking..."
                                        className="min-h-[100px]"
                                        data-testid="textarea-admin-notes"
                                      />
                                      <Button 
                                        onClick={() => addNotesMutation.mutate({
                                          id: selectedBooking.id,
                                          notes: adminNotes
                                        })}
                                        disabled={!adminNotes || addNotesMutation.isPending}
                                        data-testid="button-add-notes"
                                      >
                                        {addNotesMutation.isPending ? (
                                          <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Adding...
                                          </>
                                        ) : (
                                          'Add Notes'
                                        )}
                                      </Button>
                                    </div>

                                    {selectedBooking.notes && (
                                      <>
                                        <Separator />
                                        <div>
                                          <Label>User Notes</Label>
                                          <div className="mt-1 p-3 bg-muted rounded-md text-sm">
                                            {selectedBooking.notes}
                                          </div>
                                        </div>
                                      </>
                                    )}

                                    {selectedBooking.adminNotes && (
                                      <>
                                        <Separator />
                                        <div>
                                          <Label>Admin Notes</Label>
                                          <div className="mt-1 p-3 bg-muted rounded-md text-sm">
                                            {selectedBooking.adminNotes}
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="queue">
            <Card>
              <CardHeader>
                <CardTitle>Priority Queue</CardTitle>
                <CardDescription>
                  Pending calls sorted by priority and urgency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {bookings?.filter((b: any) => b.status === 'pending')
                    .sort((a: any, b: any) => {
                      const urgencyOrder: any = { critical: 0, high: 1, medium: 2, low: 3 };
                      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
                    })
                    .map((booking: any) => (
                      <Card key={booking.id}>
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${
                              booking.urgency === 'critical' ? 'bg-red-100' :
                              booking.urgency === 'high' ? 'bg-orange-100' :
                              booking.urgency === 'medium' ? 'bg-yellow-100' :
                              'bg-gray-100'
                            }`}>
                              <AlertCircle className={`h-4 w-4 ${
                                booking.urgency === 'critical' ? 'text-red-600' :
                                booking.urgency === 'high' ? 'text-orange-600' :
                                booking.urgency === 'medium' ? 'text-yellow-600' :
                                'text-gray-600'
                              }`} />
                            </div>
                            <div>
                              <div className="font-medium">{booking.contactName}</div>
                              <div className="text-sm text-muted-foreground">{booking.topicName}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant={getUrgencyBadgeVariant(booking.urgency)}>
                                  {booking.urgency}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  Waiting {booking.createdAt && !isNaN(new Date(booking.createdAt).getTime()) ? Math.floor((Date.now() - new Date(booking.createdAt).getTime()) / (1000 * 60 * 60)) : 0}h
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button 
                            size="sm"
                            onClick={() => {
                              setSelectedBooking(booking);
                              updateBookingMutation.mutate({
                                id: booking.id,
                                updates: { status: 'scheduled' }
                              });
                            }}
                            data-testid={`button-schedule-${booking.id}`}
                          >
                            Schedule Call
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads">
            <Card>
              <CardHeader>
                <CardTitle>Lead Pipeline</CardTitle>
                <CardDescription>
                  Track lead conversion through the sales funnel
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leadMetrics?.leadsByStatus && (
                  <div className="space-y-4">
                    {leadMetrics.leadsByStatus.map((statusGroup: any) => (
                      <div key={statusGroup.status} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            statusGroup.status === 'cold' ? 'bg-blue-500' :
                            statusGroup.status === 'warm' ? 'bg-yellow-500' :
                            statusGroup.status === 'hot' ? 'bg-orange-500' :
                            statusGroup.status === 'qualified' ? 'bg-purple-500' :
                            statusGroup.status === 'converted' ? 'bg-green-500' :
                            'bg-gray-500'
                          }`} />
                          <div>
                            <div className="font-medium capitalize">{statusGroup.status}</div>
                            <div className="text-sm text-muted-foreground">{statusGroup.count} leads</div>
                          </div>
                        </div>
                        <div className="text-2xl font-bold">
                          {((statusGroup.count / leadMetrics.totalLeads) * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="topics">
            <Card>
              <CardHeader>
                <CardTitle>Most Requested Topics</CardTitle>
                <CardDescription>
                  Topics users are requesting help with
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.topRequestedTopics && (
                  <div className="space-y-2">
                    {stats.topRequestedTopics.map((topic: any, index: number) => (
                      <div key={topic.topic} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="font-bold text-lg text-muted-foreground">
                            #{index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{topic.topic}</div>
                            <div className="text-sm text-muted-foreground">{topic.count} requests</div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Create Resources
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}