import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CSRImpactLoading() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6f4ef_0%,#eff2e7_40%,#f4eee3_100%)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <Card>
          <CardHeader className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-16 w-full max-w-4xl" />
            <Skeleton className="h-5 w-full max-w-3xl" />
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-[24px]" />
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.95fr)]">
          <Card>
            <CardHeader className="space-y-4">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-12 w-full max-w-2xl" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-72 rounded-[24px]" />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-10 w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-56 rounded-[24px]" />
              <Skeleton className="h-56 rounded-[24px]" />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
