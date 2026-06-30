import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { ArrowLeft, BookOpen, Home, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderBaseProps {
  description?: string;
  badge?: {
    text: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  showBackButton?: boolean;
  backButtonText?: string;
  backButtonHref?: string;
  showHomeButton?: boolean;
  showEducatorLogin?: boolean;
  showBranding?: boolean;
  customActions?: React.ReactNode;
  className?: string;
}

type PageHeaderProps =
  | (PageHeaderBaseProps & { variant: "navbar"; title?: never })
  | (PageHeaderBaseProps & { variant?: "default" | "centered" | "minimal"; title: string });

export function BrandLogo() {
  return (
    <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
        <BookOpen className="text-primary-foreground h-4 w-4" />
      </div>
      <span className="text-lg font-semibold text-foreground">NursePrep Analytics</span>
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  badge,
  showBackButton = false,
  backButtonText = "Back",
  backButtonHref,
  showHomeButton = false,
  showEducatorLogin = false,
  showBranding = false,
  customActions,
  variant = "default",
  className
}: PageHeaderProps) {
  const [, navigate] = useLocation();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleBackClick = () => {
    if (backButtonHref) {
      navigate(backButtonHref);
    } else {
      window.history.back();
    }
  };

  const handleHomeClick = () => {
    navigate("/");
  };

  if (variant === "navbar") {
    return (
      <header className={cn("bg-card border-b border-border", className)}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <BookOpen className="text-primary-foreground h-4 w-4" />
              </div>
              <h1 className="text-xl font-semibold text-foreground" data-testid="app-title">
                NursePrep Analytics
              </h1>
            </Link>
            <Link href="/admin/login">
              <span className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Educator Login
              </span>
            </Link>
          </div>
        </div>
      </header>
    );
  }

  if (variant === "centered") {
    return (
      <div className={cn("text-center mb-8 pt-4", className)}>
        {showBranding && (
          <div className="flex items-center justify-between mb-6">
            <BrandLogo />
            {showEducatorLogin && (
              <Link href="/admin/login">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Educator Login
                </span>
              </Link>
            )}
          </div>
        )}
        {!showBranding && showEducatorLogin && (
          <div className="flex justify-end mb-2">
            <Link href="/admin/login">
              <span className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Educator Login
              </span>
            </Link>
          </div>
        )}
        {badge && (
          <Badge variant={badge.variant || "outline"} className="mb-4">
            {badge.text}
          </Badge>
        )}
        <h1 className="text-3xl md:text-4xl font-bold mb-4">{title}</h1>
        {description && (
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {description}
          </p>
        )}
        {(showBackButton || showHomeButton || customActions) && (
          <div className="flex justify-center gap-4 mt-6">
            {showBackButton && (
              <Button 
                variant="outline" 
                onClick={handleBackClick}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {backButtonText}
              </Button>
            )}
            {showHomeButton && (
              <Button 
                variant="outline" 
                onClick={handleHomeClick}
                data-testid="button-home"
              >
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
            )}
            {customActions}
          </div>
        )}
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div className={cn("mb-6 pt-4", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {showBackButton && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleBackClick}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {backButtonText}
              </Button>
            )}
            <div>
              {badge && (
                <Badge variant={badge.variant || "outline"} className="mb-2">
                  {badge.text}
                </Badge>
              )}
              <h1 className="text-2xl font-bold">{title}</h1>
              {description && (
                <p className="text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showHomeButton && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleHomeClick}
                data-testid="button-home"
              >
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
            )}
            {customActions}
            {showEducatorLogin && (
              <Link href="/admin/login">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Educator Login
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("mb-6 pt-4", className)}>
      {showBranding && (
        <div className="flex items-center justify-between mb-4">
          <BrandLogo />
          {showEducatorLogin && (
            <Link href="/admin/login">
              <span className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Educator Login
              </span>
            </Link>
          )}
        </div>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          {badge && (
            <Badge variant={badge.variant || "outline"} className="mb-2">
              {badge.text}
            </Badge>
          )}
          <h1 className="text-3xl font-bold mb-2">{title}</h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        
        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2">
          {showBackButton && (
            <Button 
              variant="outline" 
              onClick={handleBackClick}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {backButtonText}
            </Button>
          )}
          {showHomeButton && (
            <Button 
              variant="outline" 
              onClick={handleHomeClick}
              data-testid="button-home"
            >
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
          )}
          {customActions}
          {!showBranding && showEducatorLogin && (
            <Link href="/admin/login">
              <span className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Educator Login
              </span>
            </Link>
          )}
        </div>

        {/* Mobile: Educator Login (always visible) + Menu Button */}
        <div className="flex items-center gap-3 md:hidden">
          {!showBranding && showEducatorLogin && (
            <Link href="/admin/login">
              <span className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Educator Login
              </span>
            </Link>
          )}
          {(showBackButton || showHomeButton || customActions) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              data-testid="button-mobile-menu"
            >
              {showMobileMenu ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Actions Menu */}
      {showMobileMenu && (
        <div className="mt-4 flex flex-col gap-2 md:hidden">
          {showBackButton && (
            <Button 
              variant="outline" 
              onClick={() => {
                handleBackClick();
                setShowMobileMenu(false);
              }}
              data-testid="button-back-mobile"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {backButtonText}
            </Button>
          )}
          {showHomeButton && (
            <Button 
              variant="outline" 
              onClick={() => {
                handleHomeClick();
                setShowMobileMenu(false);
              }}
              data-testid="button-home-mobile"
            >
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
          )}
          {customActions}
        </div>
      )}
    </div>
  );
}
