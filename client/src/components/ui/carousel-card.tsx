import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CarouselCardProps {
  cards: Array<{
    id: string;
    title: string;
    description?: string;
    content: React.ReactNode;
    icon?: React.ReactNode;
    color?: string;
    actions?: React.ReactNode;
  }>;
  showIndicators?: boolean;
  autoSwipe?: boolean;
  swipeInterval?: number;
  className?: string;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
}

export function CarouselCard({
  cards,
  showIndicators = true,
  autoSwipe = false,
  swipeInterval = 5000,
  className,
  defaultIndex = 0,
  onIndexChange
}: CarouselCardProps) {
  const [currentIndex, setCurrentIndex] = useState(defaultIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentIndex < cards.length - 1) {
      handleNext();
    }
    if (isRightSwipe && currentIndex > 0) {
      handlePrevious();
    }
  };

  const handlePrevious = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const newIndex = Math.max(0, currentIndex - 1);
    setCurrentIndex(newIndex);
    onIndexChange?.(newIndex);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleNext = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const newIndex = Math.min(cards.length - 1, currentIndex + 1);
    setCurrentIndex(newIndex);
    onIndexChange?.(newIndex);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const goToCard = (index: number) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex(index);
    onIndexChange?.(index);
    setTimeout(() => setIsAnimating(false), 300);
  };
  
  // Update index when defaultIndex changes
  useEffect(() => {
    if (defaultIndex !== undefined && defaultIndex !== currentIndex && defaultIndex >= 0 && defaultIndex < cards.length) {
      goToCard(defaultIndex);
    }
  }, [defaultIndex]);

  // Auto-swipe functionality
  useEffect(() => {
    if (!autoSwipe || cards.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % cards.length);
    }, swipeInterval);

    return () => clearInterval(interval);
  }, [autoSwipe, swipeInterval, cards.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isAnimating]);

  if (cards.length === 0) return null;

  const currentCard = cards[currentIndex];

  return (
    <div className={cn("relative w-full max-w-4xl mx-auto", className)}>
      {/* Enhanced Navigation Buttons - Desktop & Mobile */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2 md:px-0 pointer-events-none z-10">
        <Button
          variant={currentIndex === 0 ? "ghost" : "secondary"}
          size="default"
          className="pointer-events-auto md:-translate-x-4 shadow-lg"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          data-testid="button-carousel-prev"
        >
          <ChevronLeft className="h-4 w-4 md:mr-1" />
          <span className="hidden md:inline">Previous</span>
        </Button>
        <Button
          variant={currentIndex === cards.length - 1 ? "ghost" : "secondary"}
          size="default"
          className="pointer-events-auto md:translate-x-4 shadow-lg"
          onClick={handleNext}
          disabled={currentIndex === cards.length - 1}
          data-testid="button-carousel-next"
        >
          <span className="hidden md:inline">Next</span>
          <ChevronRight className="h-4 w-4 md:ml-1" />
        </Button>
      </div>

      {/* Card Container */}
      <div 
        className="overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div 
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {cards.map((card) => (
            <div key={card.id} className="w-full flex-shrink-0 px-2">
              <Card className={cn(
                "transition-all duration-300",
                currentCard.id === card.id ? "scale-100 opacity-100" : "scale-95 opacity-50"
              )}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {card.icon && (
                        <div className={cn(
                          "p-2 rounded-lg",
                          card.color || "bg-primary/10"
                        )}>
                          {card.icon}
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-xl">{card.title}</CardTitle>
                        {card.description && (
                          <CardDescription className="mt-1">
                            {card.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    {card.actions}
                  </div>
                </CardHeader>
                <CardContent>
                  {card.content}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Indicators */}
      {showIndicators && cards.length > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {cards.map((_, index) => (
            <button
              key={index}
              onClick={() => goToCard(index)}
              className={cn(
                "p-1 transition-all duration-200",
                currentIndex === index ? "scale-125" : "scale-100 opacity-50"
              )}
              aria-label={`Go to card ${index + 1}`}
              data-testid={`indicator-${index}`}
            >
              <Circle className={cn(
                "h-2 w-2 transition-all duration-200",
                currentIndex === index ? "fill-current" : ""
              )} />
            </button>
          ))}
        </div>
      )}

      {/* Mobile Navigation Hints */}
      <div className="md:hidden mt-4 text-center text-sm text-muted-foreground">
        Swipe, use buttons, or tap dots to navigate
      </div>
    </div>
  );
}