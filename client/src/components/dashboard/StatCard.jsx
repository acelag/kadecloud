function StatCard({ title, value, helper, icon: Icon, badge }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-normal text-slate-950">
            {value}
          </p>
        </div>
        {Icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            <Icon aria-hidden="true" size={20} strokeWidth={2} />
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex min-h-6 items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{helper}</p>
        {badge}
      </div>
    </article>
  );
}

export default StatCard;
