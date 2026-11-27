/** Temporary page body for routes built in Phase 5. */
export function PlaceholderPage({ title, phase = 5 }: { title: string; phase?: number }) {
  return (
    <section className="mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-4 pt-header sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Placeholder · Phase {phase}</p>
      <h1 className="mt-4 font-display text-5xl font-bold tracking-tight sm:text-7xl">{title}</h1>
    </section>
  );
}
