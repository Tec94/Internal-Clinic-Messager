"use client";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  className,
  disabled = false,
  "aria-label": ariaLabel,
}: CheckboxProps) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-3${className ? ` ${className}` : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.currentTarget.checked)}
        aria-label={ariaLabel}
        className="beui-checkbox-control h-5 w-5 shrink-0 cursor-pointer accent-[var(--checkbox-selected-bg)] focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      {label ? <span className="select-none text-sm text-foreground">{label}</span> : null}
    </label>
  );
}
