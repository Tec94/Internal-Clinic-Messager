"use client";

import { FileText, UploadCloud, X } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

export type FileUploadItem = {
  id: string;
  name: string;
  size: number;
  type?: string;
  file?: File;
  status?: "uploading" | "finalizing" | "complete" | "failed";
  progress?: number;
  attachmentId?: string;
  error?: string;
};

interface FileUploadProps {
  value: FileUploadItem[];
  onValueChange: (items: FileUploadItem[]) => void;
  accept?: string;
  maxFiles?: number;
  title?: string;
  description?: string;
  browseLabel?: string;
  className?: string;
  disabled?: boolean;
  onRemove?: (item: FileUploadItem) => void;
}

export function FileUpload({
  value,
  onValueChange,
  accept,
  maxFiles,
  title = "Drop files here",
  description = "Add files to the upload queue",
  browseLabel = "Browse",
  className,
  disabled = false,
  onRemove,
}: FileUploadProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const maxReached = maxFiles !== undefined && value.length >= maxFiles;

  const addFiles = (files: FileList) => {
    const available = maxFiles === undefined ? files.length : maxFiles - value.length;
    const added = Array.from(files)
      .slice(0, Math.max(0, available))
      .map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        file,
      }));

    if (added.length) onValueChange([...value, ...added]);
  };

  return (
    <div className={`w-full space-y-3${className ? ` ${className}` : ""}`}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        disabled={maxReached || disabled}
        tabIndex={-1}
        className="sr-only"
        aria-label="Upload files"
        onChange={(event) => {
          if (event.currentTarget.files) addFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />

      <button
        type="button"
        disabled={maxReached || disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!maxReached) event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (!maxReached) addFiles(event.dataTransfer.files);
        }}
        className="group flex w-full items-center gap-4 rounded-3xl border border-dashed border-border bg-background p-5 text-left outline-none transition-colors hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55"
      >
        <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-[1.25rem] bg-muted text-foreground">
          <UploadCloud className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-sm text-foreground">
            {maxReached ? "Upload limit reached" : title}
          </strong>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {maxReached ? `${value.length} of ${maxFiles} files added` : description}
          </span>
        </span>
        <span className="shrink-0 rounded-full border border-border px-3.5 py-2 text-xs font-medium text-foreground group-hover:bg-muted">
          {browseLabel}
        </span>
      </button>

      {value.length ? (
        <ul className="space-y-2" aria-live="polite">
          {value.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{item.name}</span>
                <span className="text-xs text-muted-foreground">{item.size.toLocaleString()} B</span>
                {item.status === "uploading" || item.status === "finalizing" ? (
                  <span className="file-upload-progress">
                    <progress
                      max={100}
                      value={item.progress ?? 0}
                      aria-label={t("attachment.uploadProgress", {
                        name: item.name,
                        progress: item.progress ?? 0,
                      })}
                    />
                    <small>
                      {item.status === "finalizing"
                        ? t("attachment.finalizing")
                        : `${item.progress ?? 0}%`}
                    </small>
                  </span>
                ) : null}
                {item.status === "failed" && item.error ? (
                  <small className="field-error" role="alert">{item.error}</small>
                ) : null}
              </span>
              <button
                type="button"
                aria-label={
                  item.status === "uploading" || item.status === "finalizing"
                    ? t("attachment.cancelUpload", { name: item.name })
                    : `Remove ${item.name}`
                }
                disabled={
                  disabled
                  && item.status !== "uploading"
                  && item.status !== "finalizing"
                }
                onClick={() => {
                  onRemove?.(item);
                  onValueChange(value.filter((entry) => entry.id !== item.id));
                }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
