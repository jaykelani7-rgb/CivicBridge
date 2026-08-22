"use client";

import { Radar, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CommandCenterErrorProps = {
  error: Error;
  reset: () => void;
};

export default function CommandCenterError({
  error,
  reset,
}: CommandCenterErrorProps) {
  return (
    <main className="dark flex min-h-screen items-center justify-center bg-[#071019] px-5 py-10 text-[#f2ede5]">
      <Card className="w-full max-w-xl border-white/10 bg-[#10161e] text-[#f2ede5] hover:translate-y-0 hover:shadow-none">
        <CardHeader className="space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Radar className="h-6 w-6" />
          </div>
          <CardTitle className="text-3xl text-white">
            The command center lost its live session.
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-[#a9b8c2]">
            We kept the failure inside the dashboard boundary so the rest of the
            app stays stable. Retry to restore the live operations surface.
          </p>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[#c9d4db]">
            {error.message}
          </div>
          <Button onClick={reset}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Retry dashboard
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
