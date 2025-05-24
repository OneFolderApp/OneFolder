import React, {
  CSSProperties,
  ForwardedRef,
  forwardRef,
  ReactElement,
  ReactNode,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FixedSizeList } from 'react-window';

export interface GridProps {
  id?: string;
  /** When multiselectable is set to true, the click event handlers on the option elements must togggle the select state. */
  multiselectable?: boolean;
  children: GridChildren;
}

export type GridChild = React.ReactElement<RowProps>;
export type GridChildren = GridChild | GridChild[] | React.ReactFragment | undefined;

export const Grid = forwardRef(function Grid(props: GridProps, ref: ForwardedRef<HTMLDivElement>) {
  const { id, multiselectable, children } = props;

  return (
    <div ref={ref} id={id} role="grid" aria-multiselectable={multiselectable}>
      {children}
    </div>
  );
});

export function useGridFocus(
  gridRef: React.RefObject<HTMLDivElement>,
): [focus: string | undefined, handleInput: (event: React.KeyboardEvent) => void] {
  const focus = useRef(0);
  const [activeIndex, setActiveIndex] = useState<string>();

  const handleFocus = useRef((event: React.KeyboardEvent) => {
    if (gridRef.current === null || gridRef.current.childElementCount === 0) {
      return;
    }
    if (event.altKey) {
      event.preventDefault();
      return;
    }

    const scrollOpts: ScrollIntoViewOptions = { block: 'nearest' };
    const options = gridRef.current.querySelectorAll(
      'div[role="row"]',
    ) as NodeListOf<HTMLDivElement>;
    const numOptions = options.length;
    focus.current = Math.min(numOptions - 1, focus.current);
    const activeElement = options[focus.current];
    switch (event.key) {
      case 'Enter':
        event.stopPropagation();
        activeElement.click();
        break;

      case 'ArrowUp': {
        event.stopPropagation();
        event.preventDefault();
        focus.current = (focus.current - 1 + numOptions) % numOptions;
        if (focus.current === numOptions - 1) {
          gridRef.current.scrollTop = gridRef.current.scrollHeight;
        } else {
          const prevElement = options[focus.current];
          prevElement.scrollIntoView(scrollOpts);
        }
        let previous = undefined;
        for (let i = 0; i < options.length; i++) {
          const element = options[i];
          if (element.dataset['focused'] === 'true') {
            element.dataset['focused'] = 'false';
            previous = i;
            break;
          }
        }
        if (previous === undefined) {
          focus.current = options.length - 1;
        }
        options[focus.current].dataset['focused'] = 'true';
        setActiveIndex(options[focus.current].id);
        break;
      }

      case 'ArrowDown': {
        event.stopPropagation();
        event.preventDefault();
        focus.current = (focus.current + 1) % numOptions;
        if (focus.current === 0) {
          gridRef.current.scrollTop = 0;
        } else {
          const nextElement = options[focus.current];
          nextElement.scrollIntoView(scrollOpts);
        }
        let previous = undefined;
        for (let i = 0; i < options.length; i++) {
          const element = options[i];
          if (element.dataset['focused'] === 'true') {
            element.dataset['focused'] = 'false';
            previous = i;
            break;
          }
        }
        if (previous === undefined) {
          focus.current = 0;
        }
        options[focus.current].dataset['focused'] = 'true';
        setActiveIndex(options[focus.current].id);
        break;
      }

      // Note: no 'space' to select, since space is valid input for the input-field

      default:
        break;
    }
  });

  return [activeIndex, handleFocus.current];
}

export interface VirtualizedGridRowProps<T> {
  id?: string;
  index: number;
  style?: CSSProperties;
  data: T[];
  isScrolling?: boolean;
}

export interface VirtualizedGridProps<T> {
  id?: string;
  /** When multiselectable is set to true, the click event handlers on the option elements must togggle the select state. */
  multiselectable?: boolean;
  itemData: T[];
  sampleItem?: T;
  children: (props: VirtualizedGridRowProps<T>) => React.ReactElement | null;
  width?: number | string;
  height?: number | '100%';
  // Optional override for height: defines height in number of visible items (rows)
  itemsInView?: number;
}

export interface VirtualizedGridHandle {
  listRef: FixedSizeList | null;
  outerRef: HTMLDivElement | null;
  itemCount: number;
  focusedIndex: React.MutableRefObject<number>;
  scrollToItem: (index: number) => void;
}

function VirtualizedGridInner<T>(
  props: VirtualizedGridProps<T>,
  ref: ForwardedRef<VirtualizedGridHandle>,
) {
  const { id, itemData, sampleItem, multiselectable, width, height, itemsInView, children } = props;
  const ListRow = children;
  const [cellSize, setCellSize] = useState(24);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const focusedIndex = useRef(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<FixedSizeList>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const measureItem = sampleItem !== undefined ? sampleItem : itemData.at(0);

  const scrollToItem = useRef((index: number) => {
    focusedIndex.current = index;
    listRef.current?.scrollToItem(index, 'auto');
  }).current;

  useImperativeHandle(
    ref,
    () => ({
      listRef: listRef.current,
      outerRef: outerRef.current,
      itemCount: itemData.length,
      focusedIndex: focusedIndex,
      scrollToItem: scrollToItem,
    }),
    [itemData.length, scrollToItem],
  );

  useEffect(() => {
    if (measureRef.current) {
      const rect = measureRef.current.getBoundingClientRect();
      if (rect.height > 0) {
        setCellSize(rect.height);
      }
    }
  }, [measureItem]);

  useEffect(() => {
    focusedIndex.current = -1;
    setTimeout(() => {
      listRef.current?.scrollToItem(0, 'start');
    }, 0);
  }, [itemData.length]);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const ListGrid = useMemo(
    () =>
      forwardRef(function VGrid({ children, ...props }: any, fref: ForwardedRef<HTMLDivElement>) {
        return (
          <div ref={fref} id={id} role="grid" aria-multiselectable={multiselectable} {...props}>
            {children}
          </div>
        );
      }),
    [id, multiselectable],
  );

  const listHeight =
    height && !itemsInView
      ? typeof height === 'number'
        ? height
        : size.height
      : cellSize * Math.min(itemData.length, itemsInView ?? 10);
  const listWidth = width ? width : 'auto';

  return (
    <div ref={containerRef} className="virtualized-grid" tabIndex={-1}>
      <div className="horizontal-measure-inline-hidden">
        <div ref={measureRef} role="grid">
          {measureItem !== undefined && (
            <ListRow index={0} style={undefined} data={[measureItem]} id="measure-item-id" />
          )}
        </div>
      </div>
      <FixedSizeList
        ref={listRef}
        layout="vertical"
        height={listHeight}
        width={listWidth}
        itemCount={itemData.length}
        itemData={itemData}
        itemSize={cellSize}
        overscanCount={10}
        outerElementType={ListGrid}
        outerRef={outerRef}
        innerElementType={Body}
        children={ListRow}
      />
    </div>
  );
}

const VirtualizedGrid = forwardRef(VirtualizedGridInner) as <T>(
  props: VirtualizedGridProps<T> & { ref?: ForwardedRef<VirtualizedGridHandle> },
) => ReturnType<typeof VirtualizedGridInner>;
export { VirtualizedGrid };

const Body = forwardRef(function Body(
  { children, ...props }: any,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <div ref={ref} role="rowgroup" {...props}>
      {children}
    </div>
  );
});

export function useVirtualizedGridFocus(
  gridRef: React.RefObject<VirtualizedGridHandle>,
): [focus: string | undefined, handleKey: (e: React.KeyboardEvent) => void] {
  const [activeId, setActiveIndex] = useState<string | undefined>();

  const updateFocus = useRef(
    (direction: 1 | -1, vGrid: VirtualizedGridHandle, outer: HTMLDivElement) => {
      const prevIndex = vGrid.focusedIndex.current;
      const newIndex = (vGrid.focusedIndex.current + direction + vGrid.itemCount) % vGrid.itemCount;
      const prevEl = outer.querySelector(
        `div[role="row"][data-index="${prevIndex}"]`,
      ) as HTMLDivElement | null;
      const nextEl = outer.querySelector(
        `div[role="row"][data-index="${newIndex}"]`,
      ) as HTMLDivElement | null;
      if (prevEl) {
        prevEl.dataset.focused = 'false';
      }
      if (nextEl) {
        nextEl.dataset.focused = 'true';
        setActiveIndex(nextEl.id);
      } else {
        setActiveIndex(undefined);
      }
      vGrid.scrollToItem(newIndex);
    },
  ).current;

  const handleEnter = useRef(
    (event: React.KeyboardEvent, vGrid: VirtualizedGridHandle, outer: HTMLDivElement) => {
      const row = outer.querySelector(
        `div[role="row"][data-index="${Math.max(0, vGrid.focusedIndex.current)}"]`,
      ) as HTMLDivElement | null;
      if (row) {
        row.click();
        event.preventDefault();
        event.stopPropagation();
      }
    },
  ).current;

  const handleKey = useRef((event: React.KeyboardEvent) => {
    if (event.altKey) {
      event.preventDefault();
      return;
    }
    if (!gridRef.current) {
      return;
    }
    const vGrid = gridRef.current;
    const outer = vGrid.outerRef;
    if (!outer || vGrid.itemCount === 0) {
      return;
    }
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        event.stopPropagation();
        updateFocus(-1, vGrid, outer);
        break;
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        updateFocus(1, vGrid, outer);
        break;
      case 'Enter':
        handleEnter(event, vGrid, outer);
        break;
      default:
        break;
    }
  }).current;

  return [activeId, handleKey];
}

export interface RowProps {
  id?: string;
  /** Important to handle selection with arrow keys in viertualizedGrid */
  index?: number;
  value: string;
  selected?: boolean;
  /** The icon on the right side of the label because on the left is the checkmark already. */
  icon?: JSX.Element;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  children?: ReactElement<GridCellProps> | ReactElement<GridCellProps>[];
  tooltip?: string;
  valueIsHtml?: boolean;
  onContextMenu?: React.MouseEventHandler<HTMLSpanElement>;
  style?: React.CSSProperties;
}

export const Row = ({
  id,
  index,
  value,
  selected,
  onClick,
  icon,
  tooltip,
  children,
  valueIsHtml,
  onContextMenu,
  style,
}: RowProps) => (
  <div
    id={id}
    role="row"
    aria-selected={selected}
    onClick={onClick}
    tabIndex={-1} // Important for focus handling!
    data-tooltip={tooltip}
    onContextMenu={onContextMenu}
    style={style}
    data-index={index}
  >
    <GridCell>
      <span className="combobox-popup-option-icon" aria-hidden>
        {icon}
      </span>
      {valueIsHtml ? <span dangerouslySetInnerHTML={{ __html: value }} /> : <span>{value}</span>}
    </GridCell>
    {children}
  </div>
);

export const RowSeparator = ({ style }: { style?: React.CSSProperties }) => (
  <div style={style} role="separator"></div>
);

interface GridCellProps {
  id?: string;
  className?: string;
  children?: ReactNode;
  __html?: string;
}

export const GridCell = ({ id, className, children, __html }: GridCellProps) => {
  return (
    <div
      id={id}
      role="gridcell"
      className={className}
      dangerouslySetInnerHTML={__html ? { __html } : undefined}
    >
      {children}
    </div>
  );
};
