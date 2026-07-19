"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  backdropClassName?: string;
  ariaLabel?: string;
}

export function Drawer({
  open,
  onOpenChange,
  children,
  className,
  backdropClassName,
  ariaLabel,
}: DrawerProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm${backdropClassName ? ` ${backdropClassName}` : ""}`}
        />
        <Dialog.Content
          aria-label={ariaLabel}
          aria-describedby={undefined}
          onOpenAutoFocus={() => { returnFocusRef.current = document.activeElement as HTMLElement | null; }}
          onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusRef.current?.focus(); }}
          className={`fixed inset-y-0 right-0 z-50 flex w-80 max-w-[85vw] flex-col border-l border-border bg-background shadow-2xl${className ? ` ${className}` : ""}`}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
