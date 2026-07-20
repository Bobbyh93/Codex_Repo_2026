import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CarouselNavigationProps {
  currentSlide: number;
  totalSlides: number;
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  showIndicators?: boolean;
  showNumbers?: boolean;
  showArrows?: boolean;
  className?: string;
  indicatorClassName?: string;
  arrowClassName?: string;
  variant?: "default" | "minimal" | "compact";
}

export function CarouselNavigation({
  currentSlide,
  totalSlides,
  onPrevious,
  onNext,
  canGoPrevious = currentSlide > 0,
  canGoNext = currentSlide < totalSlides - 1,
  showIndicators = true,
  showNumbers = false,
  showArrows = true,
  className,
  indicatorClassName,
  arrowClassName,
  variant = "default"
}: CarouselNavigationProps) {
  
  if (variant === "minimal") {
    return (
      <div className={cn("flex justify-center gap-2", className)}>
        {showIndicators && (
          <div className="flex gap-1">
            {Array.from({ length: totalSlides }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-all",
                  i === currentSlide 
                    ? 'bg-primary w-6' 
                    : i < currentSlide
                      ? 'bg-primary/50'
                      : 'bg-muted-foreground/30',
                  indicatorClassName
                )}
              />
            ))}
          </div>
        )}
        {showNumbers && (
          <Badge variant="outline" className="text-xs">
            {currentSlide + 1} of {totalSlides}
          </Badge>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center justify-between", className)}>
        {showArrows && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            className={cn("opacity-50 hover:opacity-100", arrowClassName)}
            data-testid="carousel-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        
        <div className="flex items-center gap-3">
          {showIndicators && (
            <div className="flex gap-1">
              {Array.from({ length: totalSlides }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-2 w-2 rounded-full transition-all",
                    i === currentSlide 
                      ? 'bg-primary w-8' 
                      : i < currentSlide
                        ? 'bg-primary/50'
                        : 'bg-muted-foreground/30',
                    indicatorClassName
                  )}
                />
              ))}
            </div>
          )}
          {showNumbers && (
            <Badge variant="outline" className="text-xs">
              {currentSlide + 1} of {totalSlides}
            </Badge>
          )}
        </div>

        {showArrows && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onNext}
            disabled={!canGoNext}
            className={cn("opacity-50 hover:opacity-100", arrowClassName)}
            data-testid="carousel-next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress Indicators */}
      {showIndicators && (
        <div className="flex justify-center gap-1">
          {Array.from({ length: totalSlides }, (_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 w-2 rounded-full transition-all",
                i === currentSlide 
                  ? 'bg-primary w-8' 
                  : i < currentSlide
                    ? 'bg-primary/50'
                    : 'bg-muted-foreground/30',
                indicatorClassName
              )}
            />
          ))}
        </div>
      )}

      {/* Step Counter */}
      {showNumbers && (
        <div className="flex justify-center">
          <Badge variant="outline">
            Step {currentSlide + 1} of {totalSlides}
          </Badge>
        </div>
      )}

      {/* Enhanced Navigation Buttons */}
      {showArrows && (
        <div className="flex justify-center gap-3 px-4">
          <Button
            variant={canGoPrevious ? "outline" : "ghost"}
            size="default"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            className={cn(
              "min-w-[100px]",
              !canGoPrevious && "opacity-30",
              arrowClassName
            )}
            data-testid="carousel-prev"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant={canGoNext ? "default" : "ghost"}
            size="default"
            onClick={onNext}
            disabled={!canGoNext}
            className={cn(
              "min-w-[100px]",
              !canGoNext && "opacity-30",
              arrowClassName
            )}
            data-testid="carousel-next"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Additional component for carousel headers
interface CarouselHeaderProps {
  title: string;
  description?: string;
  badge?: {
    text: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  currentSlide: number;
  totalSlides: number;
  showProgress?: boolean;
  className?: string;
}

export function CarouselHeader({
  title,
  description,
  badge,
  currentSlide,
  totalSlides,
  showProgress = true,
  className
}: CarouselHeaderProps) {
  return (
    <div className={cn("text-center mb-4", className)}>
      {badge && (
        <Badge variant={badge.variant || "outline"} className="mb-2">
          {badge.text}
        </Badge>
      )}
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      {description && (
        <p className="text-muted-foreground text-sm">{description}</p>
      )}
      {showProgress && (
        <CarouselNavigation
          currentSlide={currentSlide}
          totalSlides={totalSlides}
          onPrevious={() => {}}
          onNext={() => {}}
          showArrows={false}
          showNumbers={false}
          variant="minimal"
          className="mt-4"
        />
      )}
    </div>
  );
}