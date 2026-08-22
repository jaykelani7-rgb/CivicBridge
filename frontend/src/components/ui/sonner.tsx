"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  const { theme = "light" } = useTheme();

  return (
    <Sonner
      closeButton
      position="top-right"
      richColors
      theme={theme === "dark" ? "dark" : "light"}
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg border border-border bg-card text-card-foreground shadow-soft",
          title: "font-heading text-base font-bold",
          description: "text-sm text-muted-foreground",
          actionButton:
            "bg-primary text-primary-foreground hover:bg-primary/90",
          cancelButton: "bg-muted text-foreground hover:bg-muted/80",
        },
      }}
    />
  );
}
