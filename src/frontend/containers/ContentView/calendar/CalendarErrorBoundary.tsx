import React, { Component, ErrorInfo, ReactNode } from 'react';
import { IconSet } from 'widgets';
import { Button, ButtonGroup } from 'widgets';

interface CalendarErrorBoundaryProps {
  children: ReactNode;
  /** Callback when user requests to retry */
  onRetry?: () => void;
  /** Callback when user requests to fallback to different view */
  onFallback?: () => void;
}

interface CalendarErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * CalendarErrorBoundary provides graceful error handling for calendar view components
 * with options to retry or fallback to a different view mode
 */
export class CalendarErrorBoundary extends Component<
  CalendarErrorBoundaryProps,
  CalendarErrorBoundaryState
> {
  constructor(props: CalendarErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<CalendarErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Calendar view error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onRetry?.();
  };

  handleFallback = () => {
    this.props.onFallback?.();
  };

  render() {
    if (this.state.hasError) {
      const isLayoutError = this.state.error?.message?.includes('layout') || 
                           this.state.error?.message?.includes('calculation');
      const isVirtualizationError = this.state.error?.message?.includes('virtualization') ||
                                   this.state.error?.message?.includes('scroll');

      let errorTitle = 'Calendar view error';
      let errorMessage = 'An unexpected error occurred while displaying the calendar view.';

      if (isLayoutError) {
        errorTitle = 'Layout calculation error';
        errorMessage = 'There was a problem calculating the calendar layout. This may be due to unusual screen dimensions or a large number of photos.';
      } else if (isVirtualizationError) {
        errorTitle = 'Virtualization error';
        errorMessage = 'There was a problem with the scrolling system. This may occur with very large photo collections.';
      }

      return (
        <div className="calendar-error-boundary">
          <div className="calendar-error-boundary__content">
            <div className="calendar-error-boundary__icon">
              <span className="custom-icon-48">{IconSet.WARNING}</span>
            </div>
            <h3 className="calendar-error-boundary__title">{errorTitle}</h3>
            <p className="calendar-error-boundary__message">{errorMessage}</p>
            
            <ButtonGroup align="center">
              <Button
                styling="outlined"
                icon={IconSet.RELOAD}
                text="Try Again"
                onClick={this.handleRetry}
              />
              {this.props.onFallback && (
                <Button
                  styling="outlined"
                  icon={IconSet.VIEW_LIST}
                  text="Switch to List View"
                  onClick={this.handleFallback}
                />
              )}
            </ButtonGroup>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="calendar-error-boundary__details">
                <summary>Error Details (Development)</summary>
                <pre className="calendar-error-boundary__stack">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}