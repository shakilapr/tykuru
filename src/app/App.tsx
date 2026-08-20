import { useState } from "react";
import { ThemeProvider } from "@/app/app-state";
import AppLayout from "@/app/AppLayout";
import { StartScreen } from "@/components/StartScreen";

export default function App() {
  const [open, setOpen] = useState(false);
  return (
    <ThemeProvider>
      <div className="h-full w-full">
        {open ? <AppLayout onOpen={() => setOpen(true)} /> : <StartScreen onOpen={() => setOpen(true)} />}
      </div>
    </ThemeProvider>
  );
}
