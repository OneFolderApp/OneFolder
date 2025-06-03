import { shift, flip, Placement, Strategy } from '@floating-ui/core';
import { useFloating } from '@floating-ui/react-dom';

export function usePopover(
  placement?: Placement,
  fallbackPlacements?: Placement[],
  strat?: Strategy,
) {
  const { x, y, reference, floating, strategy, update } = useFloating({
    placement,
    strategy: strat,
    middleware: [
      flip({ fallbackPlacements }),
      shift({ boundary: document.body, crossAxis: true, padding: 8 }),
    ],
  });
  return {
    style: {
      position: strategy,
      top: 0,
      left: 0,
      transform: `translate(${Math.round(x ?? 0.0)}px,${Math.round(y ?? 0.0)}px)`,
    },
    reference,
    floating,
    update,
  };
}
