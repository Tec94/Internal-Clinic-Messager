"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";

interface MorphingModalProps {
  viewId: string | null;
  onClose: () => void;
  children: ReactNode;
  placement?: "bottom" | "center";
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  className?: string;
  contentClassName?: string;
  overlayClassName?: string;
}

export function MorphingModal({
  viewId,
  onClose,
  children,
  placement = "bottom",
  ariaLabelledBy,
  ariaDescribedBy,
  className,
  contentClassName,
  overlayClassName,
}: MorphingModalProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open={viewId !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={`fixed inset-0 z-[400] bg-background/5 [backdrop-filter:blur(14px)_saturate(140%)] [-webkit-backdrop-filter:blur(14px)_saturate(140%)]${overlayClassName ? ` ${overlayClassName}` : ""}`}
        />
        <Dialog.Content
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          onOpenAutoFocus={() => { returnFocusRef.current = document.activeElement as HTMLElement | null; }}
          onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusRef.current?.focus(); }}
          className={`fixed left-1/2 z-[401] w-full max-w-[min(420px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-3xl bg-background shadow-2xl ring-1 ring-border/80 ${placement === "center" ? "top-1/2 -translate-y-1/2" : "bottom-8"}${className ? ` ${className}` : ""}`}
        >
          <div className={`p-5${contentClassName ? ` ${contentClassName}` : ""}`}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
