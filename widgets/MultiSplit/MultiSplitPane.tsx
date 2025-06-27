import { clamp } from 'common/core';
import { debounce } from 'common/timeout';
import React, { ReactNode, useLayoutEffect, useMemo, useRef } from 'react';
import { Collapse } from 'src/frontend/components/Collapse';
import { useMutationObserver } from 'src/frontend/hooks/useMutationObserver';

export type MultiSplitPaneProps = React.HTMLAttributes<HTMLDivElement> & {
  id: string;
  title: string;
  /** Will be set by the MultiSplit parent */
  isCollapsed?: boolean;
  /** Will be set by the MultiSplit parent */
  setCollapsed?: (isCollapsed: boolean) => void;
  height?: number;
  setHeight?: (height: number) => void;
  headerProps?: React.HTMLAttributes<HTMLDivElement>;
  headerToolbar?: ReactNode;
  className?: string;
};

const ResizableCollapse = ({
  isCollapsed,
  height,
  setHeight,
  children,
}: Pick<MultiSplitPaneProps, 'isCollapsed' | 'height' | 'children'> & {
  setHeight: (height: number) => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Keep track of the resizable height of this component so it can be persistent
  const debouncedSetHeight = useMemo(() => debounce(setHeight, 100), [setHeight]);
  useMutationObserver(
    ref,
    (mutations) => {
      // Only set the height when the panel is not collapsed, so the height is restored as to how it was when expanded
      const heightStr = (mutations[0]?.target as HTMLDivElement).style.height.replace('px', '');
      const height = Number(heightStr) || 0;
      if (height !== 0) {
        const maxHeight = window.innerHeight;
        debouncedSetHeight(clamp(height, 0, maxHeight));
      }
    },
    { attributes: true },
  );

  // Set initial height on mount and after expanding
  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }
    const newHeight = isCollapsed ? '0px' : `${height ? `${height}px` : ''}`;
    ref.current.style.height = newHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollapsed]);

  // Reset height when height is set to 0 (e.g. double clicking the header)
  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }
    if (height === 0) {
      ref.current.style.height = '0px';
    }
  }, [height]);

  return (
    <div ref={ref} className="resizable-collapse">
      <Collapse open={!isCollapsed}>{children}</Collapse>
    </div>
  );
};

const MultiSplitPane: React.FC<MultiSplitPaneProps> = ({
  title,
  isCollapsed,
  setCollapsed,
  height,
  setHeight,
  children,
  className,
  headerToolbar,
  headerProps,
  ...props
}) => {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className={`section ${className || ''}`} {...props} ref={ref}>
      <header {...(headerProps || {})}>
        <h2
          onClick={() => setCollapsed?.(!isCollapsed)}
          // Reset the height to grow with the content by double clicking
          onDoubleClick={() => setHeight?.(0)}
        >
          {title}
        </h2>
        {headerToolbar}
      </header>
      {setHeight ? (
        <ResizableCollapse isCollapsed={isCollapsed} setHeight={setHeight} height={height}>
          {children}
        </ResizableCollapse>
      ) : (
        <Collapse open={!isCollapsed}>{children}</Collapse>
      )}
    </div>
  );
};

export default MultiSplitPane;
