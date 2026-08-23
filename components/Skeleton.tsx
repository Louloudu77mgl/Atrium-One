import { cn } from "@/components/ui";
import type { ReactNode } from "react";

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("ao-skeleton block", className)} />;
}

export function SkeletonText({ lines = 2, className }: { lines?: number; className?: string }) {
  return <div className={cn("space-y-2", className)}>{Array.from({ length: lines }, (_, index) => <Skeleton key={index} className={cn("h-3", index === lines - 1 ? "w-2/3" : "w-full")} />)}</div>;
}

export function SkeletonAvatar({ className }: { className?: string }) {
  return <Skeleton className={cn("h-11 w-11 rounded-full", className)} />;
}

export function SkeletonButton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-10 w-28 rounded-[var(--radius-sm)]", className)} />;
}

export function SkeletonCard({ className, children }: { className?: string; children?: ReactNode }) {
  return <section className={cn("ao-section-card p-[18px]", className)}>{children ?? <><Skeleton className="h-5 w-2/5" /><SkeletonText className="mt-4" /><SkeletonButton className="mt-5" /></>}</section>;
}

type SkeletonPageVariant = "dashboard" | "reviews" | "social" | "campaigns" | "automations" | "settings" | "table";

export function PageSkeleton({ variant = "dashboard" }: { variant?: SkeletonPageVariant }) {
  const isTable = variant === "table" || variant === "reviews";
  const isSocial = variant === "social";
  const isAutomations = variant === "automations";
  const isCampaigns = variant === "campaigns";

  return (
    <div className="ao-page" aria-busy="true" aria-label="Chargement de la page">
      <SkeletonSidebar />
      <div className="min-h-screen md:ml-60">
        <SkeletonHeader />
        <main className="ao-page-content md:px-7 md:py-7">
          <div className="ao-page-width ao-stack-6">
            <section className="ao-hero md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-[280px] flex-1"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-9 w-3/4" /><SkeletonText className="mt-4 max-w-xl" /></div>
                <div className="flex gap-3"><SkeletonButton /><SkeletonButton className="w-24" /></div>
              </div>
            </section>
            {isTable ? <TableSkeleton /> : null}
            {isSocial ? <SocialSkeleton /> : null}
            {isAutomations ? <AutomationSkeleton /> : null}
            {isCampaigns ? <CampaignsSkeleton /> : null}
            {variant === "settings" ? <SettingsSkeleton /> : null}
            {!isTable && !isSocial && !isAutomations && !isCampaigns && variant !== "settings" ? <DashboardSkeleton /> : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function SkeletonSidebar() { return <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-white/10 bg-[var(--color-primary)] px-3 py-5 md:flex md:flex-col"><div className="flex items-center gap-3 px-2"><Skeleton className="h-9 w-9 rounded-xl bg-white/20" /><Skeleton className="h-4 w-24 bg-white/20" /></div><div className="mt-10 space-y-2">{Array.from({ length: 8 }, (_, index) => <div key={index} className="flex items-center gap-3 rounded-xl px-3 py-2.5"><Skeleton className="h-5 w-5 rounded-md bg-white/15" /><Skeleton className={`h-3 bg-white/15 ${index === 2 ? "w-32" : "w-24"}`} /></div>)}</div><div className="mt-auto flex items-center gap-3 px-3"><Skeleton className="h-9 w-9 rounded-full bg-white/20" /><Skeleton className="h-3 w-28 bg-white/20" /></div></aside>; }
function SkeletonHeader() { return <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-white/90 px-4 backdrop-blur md:px-7"><div className="flex items-center gap-3"><SkeletonAvatar className="h-9 w-9" /><div><Skeleton className="h-3 w-28" /><Skeleton className="mt-1.5 h-2.5 w-40" /></div></div><div className="flex items-center gap-3"><Skeleton className="hidden h-8 w-48 rounded-full lg:block" /><Skeleton className="h-10 w-10 rounded-xl" /><SkeletonButton className="hidden w-24 sm:block" /></div></header>; }
function DashboardSkeleton() { return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <SkeletonCard key={index} className="min-h-40"><Skeleton className="h-3 w-2/5" /><Skeleton className="mt-5 h-8 w-1/2" /><Skeleton className="mt-3 h-3 w-4/5" /></SkeletonCard>)}</div><SkeletonCard className="min-h-[380px]"><div className="flex items-center justify-between"><Skeleton className="h-6 w-52" /><SkeletonButton /></div><div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="space-y-4"><Skeleton className="h-52 w-full rounded-[var(--radius-lg)]" /><SkeletonText lines={3} /></div><div className="space-y-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div></div></SkeletonCard></>; }
function TableSkeleton() { return <section className="ao-section-card overflow-hidden">{Array.from({ length: 7 }, (_, index) => <div key={index} className="flex items-center gap-5 border-b border-[var(--color-border)] px-5 py-4 last:border-0"><SkeletonAvatar className="h-9 w-9" /><div className="flex-1"><Skeleton className="h-3 w-1/3" /><Skeleton className="mt-2 h-3 w-2/3" /></div><Skeleton className="h-6 w-20 rounded-full" /><SkeletonButton className="w-20" /></div>)}</section>; }
function SocialSkeleton() { return <><div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 2 }, (_, index) => <SkeletonCard key={index} className="min-h-72"><Skeleton className="aspect-square w-full rounded-[var(--radius-lg)]" /><Skeleton className="mt-4 h-5 w-3/4" /><SkeletonText className="mt-3" /></SkeletonCard>)}</div><SkeletonCard className="min-h-52" /></>; }
function AutomationSkeleton() { return <><div className="ao-section-card flex flex-wrap gap-3 p-3">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-10 w-28" />)}</div><div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]"><SkeletonCard className="min-h-96" /><SkeletonCard className="min-h-96" /></div></>; }
function CampaignsSkeleton() { return <><div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <SkeletonCard key={index} className="min-h-36" />)}</div><div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><SkeletonCard className="min-h-80" /><SkeletonCard className="min-h-80" /></div></>; }
function SettingsSkeleton() { return <div className="grid gap-5 md:grid-cols-2"><SkeletonCard className="min-h-72" /><SkeletonCard className="min-h-72" /><SkeletonCard className="min-h-52 md:col-span-2" /></div>; }
