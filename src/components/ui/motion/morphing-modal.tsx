"use client";
// beui.dev/components/motion/morphing-modal

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import { type ReactNode, useEffect, useRef } from "react";
import { EASE_OUT, SPRING_PANEL } from "@/lib/ease";
import { cn } from "@/lib/utils";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface MorphingModalProps {
  /** Which view is currently shown. `null` closes the modal. */
  viewId: string | null;
  onClose: () => void;
  children: ReactNode;
  /** "bottom" anchors to the viewport bottom (mobile-like). "center" centers vertically. */
  placement?: "bottom" | "center";
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  className?: string;
  contentClassName?: string;
  overlayClassName?: string;
  closeOnOverlayClick?: boolean;
}

export function MorphingModal({
  viewId,
  onClose,
  children,
  placement = "bottom",
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  className,
  contentClassName,
  overlayClassName,
  closeOnOverlayClick = true,
}: MorphingModalProps) {
  const open = viewId !== null;
  const reduce = useReducedMotion();
  const enterY = reduce ? 0 : placement === "bottom" ? 40 : 20;
  const enterScale = reduce ? 1 : 0.97;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusPanel = () => {
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? panelRef.current)?.focus({ preventScroll: true });
    };
    const frame = window.requestAnimationFrame(focusPanel);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        panelRef.current?.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [onClose, open]);

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-[400]",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <motion.div
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-background/5 [backdrop-filter:blur(14px)_saturate(140%)] [-webkit-backdrop-filter:blur(14px)_saturate(140%)]",
          open ? "pointer-events-auto" : "pointer-events-none",
          overlayClassName,
        )}
        style={{ pointerEvents: closeOnOverlayClick ? undefined : "none" }}
      />

      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex justify-center px-4",
          placement === "bottom" ? "items-end pb-8" : "items-center",
        )}
      >
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              ref={panelRef}
              key="panel"
              layout
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-describedby={ariaDescribedBy}
              tabIndex={-1}
              initial={{ opacity: 0, y: enterY, scale: enterScale }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                y: enterY,
                scale: reduce ? 1 : 0.98,
                transition: { duration: 0.18, ease: EASE_OUT },
              }}
              transition={SPRING_PANEL}
              className={cn(
                "pointer-events-auto relative w-full max-w-[min(420px,calc(100vw-32px))] overflow-hidden rounded-3xl bg-background shadow-2xl ring-1 ring-border/80 will-change-transform",
                className,
              )}
            >
              <motion.div layout="position" className={cn("p-5", contentClassName)}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={viewId}
                    initial={
                      reduce
                        ? { opacity: 0 }
                        : { opacity: 0, y: 8, filter: "blur(4px)" }
                    }
                    animate={
                      reduce
                        ? {
                            opacity: 1,
                            transition: {
                              duration: 0.18,
                              ease: EASE_OUT,
                            },
                          }
                        : {
                            opacity: 1,
                            y: 0,
                            filter: "blur(0px)",
                            transition: {
                              duration: 0.24,
                              ease: EASE_OUT,
                            },
                          }
                    }
                    exit={
                      reduce
                        ? {
                            opacity: 0,
                            transition: {
                              duration: 0.14,
                              ease: EASE_OUT,
                            },
                          }
                        : {
                            opacity: 0,
                            y: -8,
                            filter: "blur(4px)",
                            transition: {
                              duration: 0.16,
                              ease: EASE_OUT,
                            },
                          }
                    }
                  >
                    {children}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
