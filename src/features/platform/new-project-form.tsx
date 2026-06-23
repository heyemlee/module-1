"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoutButton } from "./logout-button";

export function NewProjectForm() {
  const [customerName, setCustomerName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <main className="app-page px-6 py-8">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between">
          <Link href="/projects" className="text-sm font-semibold text-[var(--app-blue)]">Back to projects</Link>
          <LogoutButton />
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-normal text-[var(--app-ink)]">New customer project</h1>
        <form onSubmit={submit} className="app-panel mt-6 space-y-4 p-6">
          <label className="block text-sm font-semibold text-[var(--app-ink)]">
            Customer name
            <input className="apple-input mt-1" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-[var(--app-ink)]">
            Project name
            <input className="apple-input mt-1" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-[var(--app-ink)]">
            Phone <span className="font-normal text-[var(--app-muted)]">(optional)</span>
            <input className="apple-input mt-1" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-[var(--app-ink)]">
            Email <span className="font-normal text-[var(--app-muted)]">(optional)</span>
            <input className="apple-input mt-1" type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-[var(--app-ink)]">
            Address <span className="font-normal text-[var(--app-muted)]">(optional)</span>
            <input className="apple-input mt-1" value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} />
          </label>
          {error && <p className="rounded-lg bg-[var(--app-red-soft)] px-3 py-2 text-sm text-[var(--app-red)]">{error}</p>}
          <button disabled={busy || !customerName.trim() || !projectName.trim()} className="uiverse-fill-button w-full px-4 py-3 disabled:opacity-60">
            {busy ? "Creating..." : "Create project"}
          </button>
        </form>
      </div>
    </main>
  );
}
