import type { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: ReactNode;
};

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}
