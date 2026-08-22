import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function VolunteerLoading() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8f5ef_0%,#f2ede3_54%,#ece5d7_100%)] px-4 pb-24 pt-4">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <Card>
          <CardHeader className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <Skeleton className="h-40 w-40 rounded-full" />
            </div>
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>

        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </main>
  );
}
