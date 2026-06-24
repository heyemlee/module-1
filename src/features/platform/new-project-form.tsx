"use client";

import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AuthUser } from "@/server/platform/types";
import {
  StudioPage,
  StudioPageHeader,
  StudioSection
} from "./studio-page";

function Field({
  label,
  required,
  className,
  children
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-2 block text-[12px] font-medium text-studio-muted">
        {label}
        {required && <span className="sr-only"> Required</span>}
      </span>
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
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
    <StudioPage>
      <StudioPageHeader
        title="New project"
        description="Create the customer record and project workspace. Round 1 starts after creation."
      />

      <StudioSection className="mt-6 max-w-3xl">
        <form onSubmit={submit} className="p-5 sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Customer name" required>
              <Input
                required
                autoComplete="name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </Field>
            <Field label="Project name" required>
              <Input
                required
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
              />
            </Field>
          </div>

          <div className="my-7 border-t border-studio-line" />

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-studio-ink">
                Contact details
              </h2>
              <span className="text-[11px] text-studio-quiet">Optional</span>
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field label="Phone">
                <Input
                  autoComplete="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  autoComplete="email"
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Input
                  autoComplete="street-address"
                  value={customerAddress}
                  onChange={(event) => setCustomerAddress(event.target.value)}
                />
              </Field>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-studio-control border border-studio-danger/30 bg-studio-danger/10 px-3 py-2 text-[13px] text-studio-danger"
            >
              {error}
            </p>
          )}

          <div className="mt-7 flex justify-end">
            <Button
              type="submit"
              size="lg"
              aria-busy={busy}
              disabled={busy || !customerName.trim() || !projectName.trim()}
            >
              {busy ? "Creating project" : "Create project"}
            </Button>
          </div>
        </form>
      </StudioSection>
    </StudioPage>
  );
}
