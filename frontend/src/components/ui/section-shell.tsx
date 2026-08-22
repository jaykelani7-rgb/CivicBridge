import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionShellProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
};

export function SectionShell({
  id,
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  headerClassName,
  contentClassName,
}: SectionShellProps) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cn(
        "rounded-[28px] border border-border/80 bg-card/90 p-6 shadow-sm backdrop-blur-sm sm:p-8",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between",
          headerClassName,
        )}
      >
        <div className="max-w-3xl space-y-3">
          {eyebrow ? (
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
              {eyebrow}
            </p>
          ) : null}
          <h2 id={id ? `${id}-title` : undefined} className="font-heading text-3xl font-black text-foreground sm:text-4xl">
            {title}
          </h2>
          {description ? (
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className={cn("pt-6", contentClassName)}>{children}</div>
    </section>
  );
}
