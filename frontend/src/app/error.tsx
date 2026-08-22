"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader className="space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/15 text-warning">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle className="text-3xl text-balance">
            Something interrupted the CivicBridge portal.
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-muted-foreground">
            The error boundary caught an unexpected issue. You can retry safely,
            and the app will attempt to recover without losing the page shell.
          </p>
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-foreground/80">
            <p className="font-medium">Error</p>
            <p className="mt-1 break-words">{error.message}</p>
          </div>
          <Button onClick={reset} className="w-full sm:w-auto">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Retry render
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
