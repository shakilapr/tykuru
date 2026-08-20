import { Button } from "@/components/ui/button";

export function StartScreen({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Tykuru</h1>
        <p className="mt-1 text-sm text-muted-foreground">Open a Typst document to preview it.</p>
      </div>
      <Button onClick={onOpen} aria-label="Open .typ" className="px-6 py-3 text-base">
        Open .typ
      </Button>
    </div>
  );
}
