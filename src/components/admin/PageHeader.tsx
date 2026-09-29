export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-2xl text-charcoal-700">{title}</h1>
        {description ? <p className="mt-1 text-sm text-charcoal-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`rounded-2xl border border-taupe-100 bg-white ${className ?? ''}`}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-taupe-100 px-5 py-3.5">
          <div>
            <h2 className="font-serif text-base text-charcoal-700">{title}</h2>
            {description ? <p className="text-xs text-charcoal-400">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={bodyClassName ?? 'p-5'}>{children}</div>
    </section>
  );
}
