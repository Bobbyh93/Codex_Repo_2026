import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  User, 
  Mail, 
  Calendar,
  GraduationCap,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';

interface UserSearchResult {
  id: string;
  email: string;
  name?: string;
  createdAt?: string;
  lastAssessment?: string;
  assessmentCount?: number;
  averageScore?: number;
}

interface UserSearchProps {
  onSelectUser?: (user: UserSearchResult) => void;
  className?: string;
}

export function UserSearch({ onSelectUser, className }: UserSearchProps) {
  const [searchEmail, setSearchEmail] = useState('');
  const [searchTrigger, setSearchTrigger] = useState('');

  // Query for searching users
  const { data: searchResults, isLoading, error } = useQuery<UserSearchResult[]>({
    queryKey: [`/api/admin/users/search?email=${encodeURIComponent(searchTrigger)}`],
    enabled: searchTrigger.length > 0,
  });

  const handleSearch = () => {
    if (searchEmail.trim()) {
      setSearchTrigger(searchEmail.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectUser = (user: UserSearchResult) => {
    setSearchEmail(user.email);
    if (onSelectUser) {
      onSelectUser(user);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          User Search
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email-search">Search by Email Address</Label>
          <div className="flex gap-2">
            <Input
              id="email-search"
              type="email"
              placeholder="Enter email address..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
              data-testid="input-email-search"
            />
            <Button 
              onClick={handleSearch}
              disabled={!searchEmail.trim() || isLoading}
              data-testid="button-search-user"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">Search</span>
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Search for users in the database by their email address
          </p>
        </div>

        {/* Search Results */}
        {error && (
          <Alert className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Error searching for user. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {searchResults && searchResults.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No users found with email: <strong>{searchTrigger}</strong>
            </AlertDescription>
          </Alert>
        )}

        {searchResults && searchResults.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Found {searchResults.length} user{searchResults.length !== 1 ? 's' : ''}
            </p>
            {searchResults.map((user) => (
              <div
                key={user.id}
                className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => handleSelectUser(user)}
                data-testid={`user-result-${user.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <p className="font-medium">{user.name || 'No name'}</p>
                      {user.assessmentCount && user.assessmentCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {user.assessmentCount} assessment{user.assessmentCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="h-3 w-3" />
                      <span>{user.email}</span>
                    </div>
                    {user.createdAt && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="h-3 w-3" />
                        <span>Joined: {user.createdAt && !isNaN(new Date(user.createdAt).getTime()) ? new Date(user.createdAt).toLocaleDateString() : "—"}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    {user.averageScore !== undefined && (
                      <div className="flex items-center gap-1">
                        <GraduationCap className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">{user.averageScore}%</span>
                      </div>
                    )}
                    {user.lastAssessment && (
                      <p className="text-xs text-gray-500">
                        Last: {!isNaN(new Date(user.lastAssessment).getTime()) ? new Date(user.lastAssessment).toLocaleDateString() : "—"}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectUser(user);
                  }}
                  data-testid={`button-select-${user.id}`}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Select This User
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}