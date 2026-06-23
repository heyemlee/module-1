"use client";

import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import type { AuthUser } from "@/server/platform/types";
import { PlatformHeader, NavPill } from "./platform-header";

const FIELD =
  "h-11 rounded-xl border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] shadow-none placeholder:text-[#86868b] focus-visible:border-[#1d1d1f]/40 focus-visible:ring-[#1d1d1f]/10";

function Field({
  label,
  className,
  children
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-2 block text-[12px] font-semibold text-[#6e6e73]">{label}</span>
      {children}
    </label>
  );
}

export function NewProjectForm({ user }: { user: AuthUser }) {
  const [customerName, setCustomerName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isAdmin = user.role === "ADMIN";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    // Only send optional fields when non-empty: the API validates customerEmail
    // as an email, so an empty string would fail the request.
    const body: Record<string, string> = { customerName, projectName };
    if (customerPhone.trim()) body.customerPhone = customerPhone.trim();
    if (customerEmail.trim()) body.customerEmail = customerEmail.trim();
    if (customerAddress.trim()) body.customerAddress = customerAddress.trim();

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        setError("Unable to create project. Customer name and project name are required.");
        return;
      }
      const json = await response.json();
      window.location.href = `/projects/${json.project.id}`;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <PlatformHeader
        userName={user.name}
        nav={
          <>
            <NavPill href="/projects" active>
              Projects
            </NavPill>
            {isAdmin && <NavPill href="/admin/users">Users</NavPill>}
            {isAdmin && <NavPill href="/admin/cabinet-colors">Cabinet Colors</NavPill>}
          </>
        }
      />

      <div className="mx-auto max-w-[1320px] px-8 py-10">
        <h1
          className="max-w-[610px] text-[56px] font-bold leading-[1.08] tracking-[-0.01em] text-[#1d1d1f]"
          style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
        >
          Start with the customer
        </h1>
        <p className="mt-4 max-w-[520px] text-[16px] leading-[24px] text-[#6e6e73]">
          A calm first step: collect only project identity before moving into Round 1.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,620px)_minmax(0,470px)]">
          <form
            onSubmit={submit}
            className="rounded-[18px] border border-[#d2d2d7] bg-white p-8"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Customer name">
                <Input
                  className={FIELD}
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                />
              </Field>
              <Field label="Project name">
                <Input
                  className={FIELD}
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                />
              </Field>
              <Field label="Phone">
                <Input
                  className={FIELD}
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                />
              </Field>
              <Field label="Email">
                <Input
                  className={FIELD}
                  type="email"
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Input
                  className={FIELD}
                  value={customerAddress}
                  onChange={(event) => setCustomerAddress(event.target.value)}
                />
              </Field>
            </div>

            {error && (
              <p className="mt-5 rounded-lg bg-[#fdeceb] px-3 py-2 text-sm text-[#b42318]">
                {error}
              </p>
            )}

            <button
              disabled={busy || !customerName.trim() || !projectName.trim()}
              className="mt-6 inline-flex h-[42px] w-full items-center justify-center rounded-full bg-[#1d1d1f] text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Creating..." : "Create project"}
            </button>
          </form>

          <aside className="h-fit rounded-[18px] border border-[#d2d2d7] bg-white p-8">
            <h2 className="text-[16px] font-bold text-[#1d1d1f]">Project card preview</h2>
            <p className="mt-1 text-[13px] text-[#6e6e73]">
              {customerName || "Customer name"} · {projectName || "Project name"}
            </p>
            <div className="mt-6 flex items-start gap-4">
              <div className="relative size-[160px] shrink-0 overflow-hidden rounded-[14px] bg-[#e8e8ed]">
                <div className="absolute left-4 top-5 h-[10px] w-[92px] rounded-full bg-white/45" />
                <span className="absolute bottom-3 left-4 text-[13px] font-bold text-[#1d1d1f]">
                  customer
                </span>
              </div>
              <div className="relative mt-8 h-[112px] w-[160px] shrink-0 overflow-hidden rounded-[14px] bg-[#e8e8ed]">
                <div className="absolute left-4 top-4 h-[10px] w-[92px] rounded-full bg-white/45" />
                <span className="absolute bottom-3 left-4 text-[13px] font-bold text-[#1d1d1f]">
                  site
                </span>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <span className="inline-flex h-7 items-center rounded-full border border-[#d2d2d7] bg-white px-3 text-[11px] font-bold text-[#1d1d1f]">
                Draft
              </span>
              <span className="inline-flex h-7 items-center rounded-full bg-[#e8e8ed] px-3 text-[11px] font-bold text-[#1d1d1f]">
                Round 1 next
              </span>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
