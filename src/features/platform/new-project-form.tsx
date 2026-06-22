"use client";

import { useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
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
    <PageShell width="max-w-xl" backHref="/projects" backLabel="Back to projects" actions={<LogoutButton />}>
      <h1 className="text-2xl font-semibold">New customer project</h1>
      <form onSubmit={submit} className="mt-6 space-y-6 rounded-lg border border-border bg-surface p-6 shadow-sm">
        <Field label="Customer name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
        <Field label="Project name" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
        <Field label="Phone (optional)" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
        <Field label="Email (optional)" type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
        <Field label="Address (optional)" value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} />
        {error && <p className="text-sm text-danger-foreground">{error}</p>}
        <Button type="submit" disabled={busy || !customerName.trim() || !projectName.trim()} className="w-full">
          {busy ? "Creating..." : "Create project"}
        </Button>
      </form>
    </PageShell>
  );
}
