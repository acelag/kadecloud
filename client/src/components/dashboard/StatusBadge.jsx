const badgeStyles = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200"
};

function StatusBadge({ children, tone = "neutral" }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badgeStyles[tone]}`}
    >
      {children}
    </span>
  );
}

export default StatusBadge;
