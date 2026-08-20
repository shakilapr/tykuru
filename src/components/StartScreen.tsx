import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

export interface StartScreenProps {
  onOpen: () => void;
  error?: string | null;
  onOpenPath: (path: string) => void;
}

export function StartScreen({ onOpen, error, onOpenPath }: StartScreenProps) {
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const path = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
      if (path) onOpenPath(path);
    },
    [onOpenPath],
  );

  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-6 ${dragOver ? "outline-2 outline-dashed outline-primary" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Tykuru</h1>
        <p className="mt-1 text-sm text-muted-foreground">Open a Typst document to preview it.</p>
      </div>
      {error ? (
        <div role="alert" className="max-w-md rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <Button onClick={onOpen} aria-label="Open .typ" className="px-6 py-3 text-base">
        Open .typ
      </Button>
    </div>
  );
}
