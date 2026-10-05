"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2 } from "lucide-react";
import { useApi } from "@/lib/api";
import { Button } from "@/components/ui/button";

export interface UploadResult {
  docId: string;
  fileName: string;
  fileType?: string;
  summary: string;
  docType: string;
}

export function DocumentUploader({ onUploaded }: { onUploaded: (r: UploadResult) => void }) {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setError(null);
      setBusy(true);
      try {
        const form = new FormData();
        form.append("pdf", file);
        const { data } = await api.post("/api/documents/upload", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        onUploaded(data);
      } catch (e: any) {
        setError(e?.response?.data?.detail ?? e.message ?? "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [api, onUploaded],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
    },
    multiple: false,
    disabled: busy,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          isDragActive ? "border-primary bg-muted/50" : "border-border"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <input {...getInputProps()} />
        {busy ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p>Processing document… images mein OCR ki wajah se thoda time lag sakta hai.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-10 w-10" />
            <p className="font-medium">PDF ya image drop karein ya click karein</p>
            <p className="text-sm text-muted-foreground">PDF, PNG, JPG, WEBP • OCR + chunking + chat supported</p>
          </div>
        )}
      </div>
      {error && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {busy && (
        <div className="mt-3 flex justify-end">
          <Button variant="outline" size="sm" disabled>
            Analysing…
          </Button>
        </div>
      )}
    </div>
  );
}
