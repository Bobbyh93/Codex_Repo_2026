# Standardized Navigation Components

This directory contains standardized navigation components that provide consistent UI patterns across the NursePrep Analytics application.

## Components Overview

### PageHeader

A flexible header component that provides consistent navigation and branding across pages.

#### Usage

```tsx
import { PageHeader } from "@/components/ui/page-header";

// Basic usage
<PageHeader
  title="Page Title"
  description="Page description"
/>

// With navigation buttons
<PageHeader
  title="Assessment Results"
  description="Your detailed performance analysis"
  showBackButton={true}
  showHomeButton={true}
/>

// Centered variant with badge
<PageHeader
  title="Pre-Test Preparation"
  description="Prepare before your assessment"
  badge={{
    text: "Pre-Test Mode",
    variant: "outline"
  }}
  showHomeButton={true}
  variant="centered"
/>
```

#### Props

- `title` (string): Main page title
- `description` (string, optional): Subtitle or description
- `badge` (object, optional): Badge configuration with text and variant
- `showBackButton` (boolean): Show back navigation button
- `backButtonText` (string): Custom text for back button (default: "Back")
- `backButtonHref` (string): Custom URL for back button (uses browser history if not provided)
- `showHomeButton` (boolean): Show home navigation button
- `customActions` (ReactNode): Additional action buttons
- `variant` ("default" | "centered" | "minimal"): Layout variant
- `className` (string): Additional CSS classes

#### Variants

- **default**: Standard layout with title on left, actions on right
- **centered**: Centered layout with title and description in the middle
- **minimal**: Compact layout with inline back button and title

### CarouselNavigation

Standardized navigation controls for carousel/stepper components.

#### Usage

```tsx
import { CarouselNavigation } from "@/components/ui/carousel-navigation";

// Full navigation with arrows and indicators
<CarouselNavigation
  currentSlide={currentSlide}
  totalSlides={slides.length}
  onPrevious={() => goToPrevious()}
  onNext={() => goToNext()}
  showNumbers={true}
/>

// Minimal indicators only
<CarouselNavigation
  currentSlide={currentSlide}
  totalSlides={slides.length}
  onPrevious={() => {}}
  onNext={() => {}}
  variant="minimal"
  showArrows={false}
/>
```

#### Props

- `currentSlide` (number): Current active slide index
- `totalSlides` (number): Total number of slides
- `onPrevious` (function): Previous button click handler
- `onNext` (function): Next button click handler
- `canGoPrevious` (boolean): Whether previous navigation is allowed
- `canGoNext` (boolean): Whether next navigation is allowed
- `showIndicators` (boolean): Show progress indicators
- `showNumbers` (boolean): Show step numbers
- `showArrows` (boolean): Show navigation arrows
- `variant` ("default" | "minimal" | "compact"): Layout variant

### CarouselHeader

Header component specifically designed for carousel steps.

#### Usage

```tsx
import { CarouselHeader } from "@/components/ui/carousel-navigation";

<CarouselHeader
  title="Upload Your PDF"
  description="Select your assessment report"
  currentSlide={currentSlide}
  totalSlides={totalSlides}
  showProgress={true}
/>
```

## Implementation Examples

### Replacing Old Navigation Patterns

#### Before (Custom Implementation)
```tsx
// Old inconsistent header
<div className="mb-6 pt-4">
  <div className="flex items-center justify-between mb-4">
    <div>
      <h1 className="text-3xl font-bold mb-2">Page Title</h1>
      <p className="text-gray-600">Description</p>
    </div>
    <Button onClick={() => navigate("/")}>
      <Home className="h-4 w-4 mr-2" />
      Back to Home
    </Button>
  </div>
</div>
```

#### After (Standardized Component)
```tsx
// New consistent header
<PageHeader
  title="Page Title"
  description="Description"
  showHomeButton={true}
/>
```

### Carousel Navigation Migration

#### Before (Custom Carousel Controls)
```tsx
// Old custom carousel navigation
<div className="flex justify-center gap-1 mt-4">
  {slides.map((_, i) => (
    <div
      key={i}
      className={`h-2 w-2 rounded-full transition-all ${
        i === currentSlide ? 'bg-primary w-8' : 'bg-muted-foreground/30'
      }`}
    />
  ))}
</div>

<div className="flex justify-between mt-6">
  <Button onClick={goBack} disabled={currentSlide === 0}>
    <ChevronLeft className="h-6 w-6" />
  </Button>
  <Button onClick={goNext} disabled={currentSlide === slides.length - 1}>
    <ChevronRight className="h-6 w-6" />
  </Button>
</div>
```

#### After (Standardized Navigation)
```tsx
// New standardized carousel navigation
<CarouselHeader
  title={slide.title}
  currentSlide={currentSlide}
  totalSlides={slides.length}
  showProgress={true}
/>

<CarouselNavigation
  currentSlide={currentSlide}
  totalSlides={slides.length}
  onPrevious={goBack}
  onNext={goNext}
  showNumbers={true}
/>
```

## Design System Benefits

1. **Consistency**: All pages use the same navigation patterns
2. **Accessibility**: Built-in ARIA labels and keyboard navigation
3. **Responsive**: Mobile-optimized layouts with collapsible menus
4. **Maintainability**: Changes in one place update all pages
5. **Developer Experience**: Simple, well-documented API

## Mobile Considerations

The PageHeader component automatically adapts to mobile screens by:
- Collapsing navigation buttons into a menu
- Stacking elements vertically on small screens
- Providing touch-friendly button sizes
- Maintaining accessible tap targets

## Best Practices

1. **Always use PageHeader** for consistent page titles and navigation
2. **Choose appropriate variants** based on page layout requirements
3. **Provide meaningful descriptions** to help users understand page context
4. **Use badges sparingly** for important status or mode indicators
5. **Test on mobile devices** to ensure responsive behavior works correctly

## Migration Checklist

When updating existing pages to use standardized navigation:

- [ ] Replace custom header markup with PageHeader component
- [ ] Update imports to include navigation components
- [ ] Remove custom CSS classes that duplicate component functionality
- [ ] Test navigation behavior on desktop and mobile
- [ ] Verify accessibility with screen readers
- [ ] Update any custom styling to work with new components