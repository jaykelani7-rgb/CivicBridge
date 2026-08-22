"use client";

import { RefreshCcw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type VolunteerErrorProps = {
  error: Error;
  reset: () => void;
};

export default function VolunteerError({
  error,
  reset,
}: VolunteerErrorProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8f5ef_0%,#f2ede3_54%,#ece5d7_100%)] px-5 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Smartphone className="h-6 w-6" />
          </div>
          <CardTitle className="text-3xl">
            The field app hit a sync issue.
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-muted-foreground">
            The mobile workspace stayed isolated so you can retry without losing
            the rest of the app state.
          </p>
          <div className="rounded-2xl border border-border bg-background p-4 text-sm text-foreground/80">
            {error.message}
          </div>
          <Button onClick={reset}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Retry field app
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
