import * as React from "react";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  label: string;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
}

/**
 * Lightweight accessible tooltip. Exposes `label` as both `aria-label` on the
 * wrapped control and a visible tooltip on hover/focus. No external dependency.
 */
export function Tooltip({ label, children, side = "top" }: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const child = React.Children.only(children);
  const trigger = React.cloneElement(child, {
    "aria-label": child.props["aria-label"] ?? label,
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
  });

  const pos: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };

  return (
    <span className="relative inline-flex">
      {trigger}
      {open && (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background shadow",
            pos[side],
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
