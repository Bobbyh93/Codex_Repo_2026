import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Check, ExternalLink, MessageCircle, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { track, EVENTS } from "@/lib/analytics";

interface ShareButtonProps {
  reportId: string;
  title?: string;
  description?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function ShareButton({ 
  reportId, 
  title = "Study Plan Results",
  description = "Check out my personalized study plan from NursePrep Analytics",
  variant = "outline",
  size = "default",
  className 
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Generate share URL
  const shareUrl = `${window.location.origin}/assessment-preview/${reportId}`;
  
  // Generate social sharing URLs
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);
  
  const socialLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%20${encodedUrl}`,
    sms: `sms:?body=${encodedTitle}%20${encodedUrl}`
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Link Copied!",
        description: "The share link has been copied to your clipboard.",
      });
      track(EVENTS.SHARE_LINK_COPIED, { reportId, method: 'clipboard' });
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast({
        title: "Copy Failed",
        description: "Unable to copy link. Please copy it manually.",
        variant: "destructive"
      });
    }
  };

  const handleSocialShare = (platform: string, url: string) => {
    window.open(url, '_blank', 'width=600,height=400');
    track(EVENTS.SHARE_LINK_CLICKED, { reportId, platform });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          className={className}
          data-testid="button-share"
        >
          <Share2 className="h-4 w-4 mr-2" />
          Share Results
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Your Study Plan</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Direct link sharing */}
          <div className="space-y-2">
            <Label htmlFor="share-url">Share Link</Label>
            <div className="flex gap-2">
              <Input
                id="share-url"
                value={shareUrl}
                readOnly
                className="text-sm"
                data-testid="input-share-url"
              />
              <Button 
                onClick={copyToClipboard}
                variant="outline"
                size="sm"
                className={cn(
                  "min-w-[80px]",
                  copied && "bg-success text-success-foreground"
                )}
                data-testid="button-copy-link"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can view your assessment results
            </p>
          </div>

          {/* Social sharing options */}
          <div className="space-y-2">
            <Label>Share On</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSocialShare('email', socialLinks.email)}
                className="justify-start"
                data-testid="button-share-email"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSocialShare('sms', socialLinks.sms)}
                className="justify-start"
                data-testid="button-share-sms"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Text
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSocialShare('twitter', socialLinks.twitter)}
                className="justify-start"
                data-testid="button-share-twitter"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Twitter
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSocialShare('facebook', socialLinks.facebook)}
                className="justify-start"
                data-testid="button-share-facebook"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Facebook
              </Button>
            </div>
          </div>

          {/* Preview info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <h4 className="font-medium text-sm">{title}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}