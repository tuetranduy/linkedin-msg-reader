import React, { useCallback } from "react";
import { useMessages } from "@/context/MessageContext";
import { Upload, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileUpload() {
  const { loadCSV, isLoading, error } = useMessages();
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".csv")) {
        alert("Please upload a CSV file");
        return;
      }

      const content = await file.text();
      await loadCSV(content);
    },
    [loadCSV],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div
        className={cn(
          "flex w-full max-w-md flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border",
          isLoading && "pointer-events-none opacity-50",
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isLoading ? (
          <>
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
            <p className="text-center text-lg font-medium">
              Loading messages...
            </p>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              This may take a moment for large files
            </p>
          </>
        ) : (
          <>
            <div className="mb-4 rounded-full bg-primary/10 p-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <p className="mb-2 text-center text-lg font-medium">
              Upload your LinkedIn messages
            </p>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              Drag and drop your messages.csv file here, or click to browse
            </p>

            <label className="cursor-pointer rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              <input
                type="file"
                accept=".csv"
                onChange={handleInputChange}
                className="hidden"
              />
              Select CSV File
            </label>

            <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Supports LinkedIn message export format</span>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-8 max-w-md text-center text-xs text-muted-foreground">
        <p className="font-medium">How to get your LinkedIn messages:</p>
        <ol className="mt-2 list-inside list-decimal text-left">
          <li>Go to LinkedIn Settings &gt; Get a copy of your data</li>
          <li>Select "Messages" and request download</li>
          <li>Extract the ZIP and upload messages.csv</li>
        </ol>
      </div>
    </div>
  );
}
