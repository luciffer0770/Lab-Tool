import clsx from 'clsx';

export function TagScroll({ items, accent }: { items: string[]; accent: 'red' | 'blue' | 'cyan' | 'neutral' }) {
  const border =
    accent === 'red'
      ? 'border-brand-red/35 bg-brand-red/5'
      : accent === 'blue'
        ? 'border-brand-blue/35 bg-brand-blue/5'
        : accent === 'cyan'
          ? 'border-brand-cyan/35 bg-brand-cyan/5'
          : 'border-line-soft bg-surface-panel';
  if (!items.length) return <span className="text-ink-muted text-xs">—</span>;
  return (
    <div className={clsx('max-h-44 overflow-y-auto rounded-lg border p-2', border)}>
      <div className="flex flex-wrap gap-1">
        {items.map((t) => (
          <span
            key={t}
            className="rounded-md border border-line-soft bg-white px-2 py-0.5 font-mono text-[11px] text-ink-secondary shadow-sm"
          >
            {t}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-ink-muted">All {items.length} labels shown (scroll if needed).</p>
    </div>
  );
}
