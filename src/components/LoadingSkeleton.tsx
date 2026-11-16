export function PageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-pulse">
      <div className="h-8 w-56 bg-primary-light/60 rounded-lg" />
      <div className="h-4 w-80 bg-border-soft rounded" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-32 bg-surface-alt border border-border-soft rounded-xl" />
        <div className="h-32 bg-surface-alt border border-border-soft rounded-xl" />
        <div className="h-32 bg-surface-alt border border-border-soft rounded-xl" />
      </div>
      <div className="h-64 bg-surface-alt border border-border-soft rounded-xl" />
    </div>
  );
}

export function SummarySkeleton() {
  return (
    <div className="bg-white border border-border-soft rounded-xl p-6 space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-24 bg-primary-light rounded" />
        <div className="h-6 w-3/4 bg-primary-light/70 rounded-lg" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full bg-surface-alt rounded" />
        <div className="h-4 w-11/12 bg-surface-alt rounded" />
        <div className="h-4 w-4/5 bg-surface-alt rounded" />
      </div>
      <div className="space-y-2.5 pt-2">
        <div className="h-4 w-32 bg-primary-light rounded" />
        <div className="h-3.5 w-full bg-surface-alt rounded" />
        <div className="h-3.5 w-5/6 bg-surface-alt rounded" />
        <div className="h-3.5 w-4/6 bg-surface-alt rounded" />
      </div>
    </div>
  );
}
