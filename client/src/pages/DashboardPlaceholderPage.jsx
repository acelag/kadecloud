function DashboardPlaceholderPage({ title }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
        KadeCloud
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        This section is reserved for the MVP workflow. The dashboard layout and
        navigation are ready for the feature screens to be added.
      </p>
    </section>
  );
}

export default DashboardPlaceholderPage;
