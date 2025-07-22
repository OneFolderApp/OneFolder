# Calendar View Accessibility Guide

This document outlines the accessibility features implemented in the Calendar View component, including keyboard navigation, screen reader support, and theme compatibility.

## Overview

The Calendar View has been designed with accessibility as a core principle, following WCAG 2.1 AA guidelines and modern web accessibility best practices. All components include proper ARIA labels, semantic HTML, keyboard navigation, and support for assistive technologies.

## Keyboard Navigation

### Primary Navigation
- **Arrow Keys (↑↓←→)**: Navigate between photos in the grid
- **Enter / Space**: Select the focused photo
- **Ctrl/Cmd + Click**: Add photo to selection (multi-select)
- **Shift + Click**: Select range of photos
- **Ctrl/Cmd + A**: Select all photos
- **Escape**: Clear selection or close dialogs

### Calendar-Specific Shortcuts
- **?**: Show/hide keyboard shortcuts help dialog
- **Escape**: Close keyboard shortcuts help dialog

### Within Keyboard Shortcuts Help Dialog
- **Arrow Keys (↑↓)**: Navigate between shortcut items
- **Escape**: Close the dialog
- **Tab**: Navigate to close button

## ARIA Labels and Semantic HTML

### PhotoGrid Component
- Uses `role="grid"` for proper grid structure
- Each photo has `role="gridcell"` with position information
- Grid includes `aria-rowcount` and `aria-colcount` attributes
- Photos have descriptive `aria-label` with filename, date, and position
- Selected photos have `aria-selected="true"`
- Broken photos have `aria-describedby` pointing to error descriptions

### CalendarVirtualizedRenderer Component
- Main container uses `role="application"` for complex interaction
- Includes comprehensive `aria-label` describing the view
- Hidden instructions element with `id="calendar-instructions"`
- Live region with `aria-live="polite"` for status updates
- Loading states use `role="status"` for announcements

### KeyboardShortcutsHelp Component
- Uses `role="dialog"` with `aria-modal="true"`
- Proper heading structure with `aria-labelledby` and `aria-describedby`
- Keyboard shortcuts grouped by category with semantic headings
- Key combinations marked up with `<kbd>` elements
- Focus management within the dialog

### MonthHeader Component
- Uses semantic heading structure
- Includes photo count information
- Proper `aria-labelledby` relationships with photo grids

## Screen Reader Support

### Announcements
- Layout recalculation progress is announced via `aria-live="polite"`
- Loading states are properly announced with status roles
- Error states include descriptive text for screen readers
- Selection changes are communicated through ARIA attributes

### Hidden Content
- Instructions for screen readers are included but visually hidden using `.sr-only` class
- Error descriptions for broken photos are accessible but not visually intrusive
- Spinner icons are marked with `aria-hidden="true"` to avoid confusion

### Descriptive Labels
- Photos include comprehensive descriptions with filename, date taken, and grid position
- Broken photos clearly indicate their status
- Grid structure is fully described for navigation context

## Focus Management

### Visual Indicators
- Focused photos have prominent outline with `--accent-color`
- Focus indicators meet WCAG contrast requirements
- High contrast mode support with enhanced focus styles
- Subtle glow animation for better visibility (respects `prefers-reduced-motion`)

### Programmatic Focus
- Focus automatically moves when `focusedPhotoId` prop changes
- Focus is maintained when switching between view modes
- Keyboard navigation updates focus appropriately
- Focus is trapped within modal dialogs

### Focus Order
- Logical tab order through interactive elements
- Grid cells are focusable with `tabIndex` management
- Modal dialogs properly manage focus on open/close

## Loading States and Transitions

### Loading Indicators
- Loading states use `role="status"` for screen reader announcements
- Progress information is communicated via `aria-live` regions
- Loading messages are descriptive and informative
- Spinner animations respect `prefers-reduced-motion` setting

### Smooth Transitions
- All transitions use `cubic-bezier` easing for natural feel
- Transitions are disabled when `prefers-reduced-motion: reduce` is set
- Layout recalculation includes smooth visual feedback
- Hover and focus states have appropriate transition timing

### Performance Considerations
- Virtualization maintains accessibility while improving performance
- Only visible items are rendered but all remain accessible
- Smooth scrolling behavior can be disabled for better performance
- Memory management doesn't impact accessibility features

## Theme Compatibility

### CSS Variables
- All colors use CSS custom properties for theme consistency
- Proper contrast ratios maintained across all themes
- Focus indicators adapt to theme colors
- Error states use theme-appropriate warning colors

### Dark Theme Support
- Enhanced shadows and contrast for dark backgrounds
- Adjusted opacity values for better visibility
- Backdrop filters work properly with dark themes
- Loading indicators use appropriate colors

### Light Theme Support
- Optimized contrast ratios for light backgrounds
- Subtle shadows and borders for definition
- Proper text color hierarchy maintained
- Accessible color combinations throughout

### High Contrast Mode
- Enhanced border widths and focus indicators
- Stronger color contrasts for better visibility
- Font weights increased for better readability
- Outline widths meet accessibility requirements

### Forced Colors Mode (Windows High Contrast)
- Uses system colors like `ButtonText`, `Highlight`, `ButtonFace`
- Maintains functionality with limited color palette
- Focus indicators use system highlight colors
- Proper contrast maintained in all states

## Responsive Design

### Mobile Accessibility
- Touch targets meet minimum 44x44px requirement
- Larger focus indicators for touch interfaces
- Simplified layouts for smaller screens
- Gesture support doesn't interfere with assistive technology

### Adaptive Layouts
- Grid columns adjust based on screen size
- Font sizes scale appropriately
- Spacing adjusts for different viewport sizes
- Keyboard shortcuts help adapts to mobile screens

### Viewport Considerations
- Proper viewport meta tag support
- Zoom functionality doesn't break layout
- Text remains readable at 200% zoom
- Interactive elements remain accessible when zoomed

## Error Handling

### Broken Photos
- Clear visual and textual indication of broken state
- Error descriptions available to screen readers
- Graceful degradation when images fail to load
- Alternative interaction methods provided

### Network Issues
- Loading states communicate connection problems
- Retry mechanisms are accessible
- Error messages are descriptive and actionable
- Fallback content is provided when needed

### Layout Errors
- Error boundaries catch and handle layout failures
- Fallback UI maintains accessibility
- Error reporting doesn't break screen reader flow
- Recovery options are clearly communicated

## Testing and Validation

### Automated Testing
- Jest tests verify ARIA attributes and roles
- Accessibility violations are caught in CI/CD
- Keyboard navigation is tested programmatically
- Focus management is validated automatically

### Manual Testing Checklist
- [ ] Screen reader navigation (NVDA, JAWS, VoiceOver)
- [ ] Keyboard-only navigation
- [ ] High contrast mode functionality
- [ ] Zoom to 200% without horizontal scrolling
- [ ] Touch device accessibility
- [ ] Voice control compatibility

### Browser Support
- Modern browsers with full ARIA support
- Graceful degradation for older browsers
- Consistent behavior across platforms
- Mobile browser accessibility features

## Implementation Notes

### Performance vs Accessibility
- Virtualization maintains full accessibility
- ARIA attributes are efficiently managed
- Focus management doesn't impact performance
- Screen reader announcements are optimized

### Future Enhancements
- Voice navigation support
- Enhanced gesture recognition
- Better integration with platform accessibility APIs
- Improved internationalization support

### Known Limitations
- Some screen readers may have delayed announcements during rapid scrolling
- Very large collections may impact focus management performance
- Complex keyboard shortcuts may require user training

## Resources

### WCAG Guidelines
- [WCAG 2.1 AA Compliance](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

### Testing Tools
- [axe-core](https://github.com/dequelabs/axe-core) for automated testing
- [WAVE](https://wave.webaim.org/) for visual accessibility evaluation
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) accessibility audit
- [Screen reader testing guide](https://webaim.org/articles/screenreader_testing/)

### Browser Extensions
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Accessibility Insights](https://accessibilityinsights.io/)
- [Colour Contrast Analyser](https://www.tpgi.com/color-contrast-checker/)