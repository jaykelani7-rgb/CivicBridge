import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "loading-sheen animate-shimmer rounded-md bg-muted/80",
        className,
      )}
      {...props}
    />
  );
}
