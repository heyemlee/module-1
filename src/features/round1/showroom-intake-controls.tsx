import type { ReactNode } from "react";

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-black tracking-normal">{title}</h2>
      <p className="mb-5 mt-2 text-sm leading-6 text-slate-600">
        Unknown or rough answers are allowed. They stay visible as Confirmation Required.
      </p>
      {children}
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function NumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-slate-700">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : null)
        }
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-700"
      />
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-700"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function StatusPill({
  label,
  tone
}: {
  label: string;
  tone: "red" | "amber" | "green";
}) {
  const classes = {
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-800",
    green: "bg-emerald-50 text-emerald-700"
  };
  return <span className={`rounded px-2.5 py-1 ${classes[tone]}`}>{label}</span>;
}

export function parseNullableSize(value: string) {
  return value === "UNKNOWN" ? null : Number(value);
}
