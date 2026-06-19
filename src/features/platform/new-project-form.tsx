"use client";

import Link from "next/link";
import { useState } from "react";

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

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      setBusy(false);
      setError("Unable to create project. Customer name and project name are required.");
      return;
    }
    const json = await response.json();
    window.location.href = `/projects/${json.project.id}`;
  }

  return (
    <main className="min-h-screen bg-stone-100 px-6 py-8 text-stone-950">
      <div className="mx-auto max-w-xl">
        <Link href="/projects" className="text-sm text-stone-600">Back to projects</Link>
        <h1 className="mt-4 text-2xl font-semibold">New customer project</h1>
        <form onSubmit={submit} className="mt-6 space-y-4 rounded border border-stone-300 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium">
            Customer name
            <input className="mt-1 w-full rounded border border-stone-300 px-3 py-2" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Project name
            <input className="mt-1 w-full rounded border border-stone-300 px-3 py-2" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Phone <span className="font-normal text-stone-500">(optional)</span>
            <input className="mt-1 w-full rounded border border-stone-300 px-3 py-2" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Email <span className="font-normal text-stone-500">(optional)</span>
            <input className="mt-1 w-full rounded border border-stone-300 px-3 py-2" type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Address <span className="font-normal text-stone-500">(optional)</span>
            <input className="mt-1 w-full rounded border border-stone-300 px-3 py-2" value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button disabled={busy || !customerName.trim() || !projectName.trim()} className="w-full rounded bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? "Creating..." : "Create project"}
          </button>
        </form>
      </div>
    </main>
  );
}
