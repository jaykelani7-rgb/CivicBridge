import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CommandCenterLoading() {
  return (
    <main className="dark min-h-screen bg-[#071019] px-4 py-5 text-[#f2ede5] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        <Card className="border-white/10 bg-[#0d151e] hover:translate-y-0 hover:shadow-none">
          <CardHeader className="space-y-4">
            <Skeleton className="h-6 w-40 bg-white/10" />
            <Skeleton className="h-16 w-full max-w-4xl bg-white/10" />
            <Skeleton className="h-5 w-full max-w-3xl bg-white/10" />
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl bg-white/10" />
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_380px]">
          <Card className="border-white/10 bg-[#0d151e] hover:translate-y-0 hover:shadow-none">
            <CardHeader className="space-y-4">
              <Skeleton className="h-6 w-44 bg-white/10" />
              <Skeleton className="h-12 w-full max-w-2xl bg-white/10" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[520px] rounded-[28px] bg-white/10" />
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-[#0d151e] hover:translate-y-0 hover:shadow-none">
            <CardHeader className="space-y-4">
              <Skeleton className="h-6 w-36 bg-white/10" />
              <Skeleton className="h-10 w-full bg-white/10" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-2xl bg-white/10" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
