import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-12">
      <div className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-14 w-full max-w-xl" />
            <Skeleton className="h-5 w-full max-w-2xl" />
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-5 w-full max-w-[15rem]" />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
