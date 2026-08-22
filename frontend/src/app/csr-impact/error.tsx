"use client";

import { RefreshCcw, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CSRImpactErrorProps = {
  error: Error;
  reset: () => void;
};

export default function CSRImpactError({
  error,
  reset,
}: CSRImpactErrorProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f6f4ef_0%,#eff2e7_40%,#f4eee3_100%)] px-5 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader className="space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/12 text-accent">
            <ReceiptText className="h-6 w-6" />
          </div>
          <CardTitle className="text-3xl">
            The impact portal could not finish loading.
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-muted-foreground">
            The donor workspace is protected by its own route boundary, so you
            can retry without affecting the rest of the app.
          </p>
          <div className="rounded-2xl border border-border bg-background p-4 text-sm text-foreground/80">
            {error.message}
          </div>
          <Button onClick={reset}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Retry impact portal
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
