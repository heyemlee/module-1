"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@/server/platform/types";

const LABEL =
  "mb-[7px] block font-mono text-[9.5px] tracking-[0.12em] text-[#86867f]";
const FIELD =
  "studio-glass-input w-full rounded-[11px] px-3 py-[11px] text-[14px] text-[#16161a]";

export function NewProjectForm({ user: _user }: { user: AuthUser }) {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => router.push("/projects");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.push("/projects");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const valid = customerName.trim() !== "" && projectName.trim() !== "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
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
        setError(
          "Unable to create project. Customer name and project name are required."
        );
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
    <div
      onClick={close}
      className="studio-anim-fade fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{
        background: "rgba(232,232,230,0.55)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)"
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create a project"
        onClick={(event) => event.stopPropagation()}
        className="studio-anim-rise w-[480px] max-w-full rounded-[24px]"
        style={{
          background:
            "linear-gradient(165deg,rgba(255,255,255,0.78),rgba(255,255,255,0.58))",
          border: "1px solid rgba(255,255,255,0.9)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.95) inset,0 40px 90px -40px rgba(20,20,26,0.42)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)"
        }}
      >
        <div className="flex items-center justify-between border-b border-[rgba(20,20,26,0.08)] px-6 py-[22px]">
          <div>
            <p className="mb-[5px] font-mono text-[10px] tracking-[0.16em] text-[#86867f]">
              NEW PROJECT
            </p>
            <h3 className="m-0 text-[20px] font-semibold text-[#16161a]">
              Create a project
            </h3>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-[10px] border border-white/85 bg-white/60 text-[15px] leading-none text-[#86867f] transition-colors hover:text-studio-ink"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="p-6">
          <div className="mb-[14px] grid grid-cols-2 gap-[14px]">
            <label className="block">
              <span className={LABEL}>CUSTOMER NAME *</span>
              <input
                required
                autoFocus
                autoComplete="name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className={LABEL}>PROJECT NAME *</span>
              <input
                required
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                className={FIELD}
              />
            </label>
          </div>

          <div className="mb-[14px] grid grid-cols-2 gap-[14px]">
            <label className="block">
              <span className={LABEL}>PHONE</span>
              <input
                autoComplete="tel"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className={LABEL}>EMAIL</span>
              <input
                type="email"
                autoComplete="email"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
                className={FIELD}
              />
            </label>
          </div>

          <label className="mb-[22px] block">
            <span className={LABEL}>ADDRESS</span>
            <input
              autoComplete="street-address"
              value={customerAddress}
              onChange={(event) => setCustomerAddress(event.target.value)}
              className={FIELD}
            />
          </label>

          {error && (
            <p
              role="alert"
              className="mb-4 rounded-[11px] border px-3 py-2 text-[12.5px]"
              style={{
                borderColor: "rgba(176,90,90,0.4)",
                background: "rgba(214,138,138,0.16)",
                color: "#8a4444"
              }}
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-[10px]">
            <button
              type="button"
              onClick={close}
              className="rounded-[12px] border border-white/85 bg-white/55 px-[18px] py-3 text-[13px] font-medium text-[#16161a]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !valid}
              className="rounded-[12px] px-5 py-3 text-[13px] font-medium text-white"
              style={
                valid
                  ? {
                      background: "linear-gradient(180deg,#2c2c30,#141416)",
                      boxShadow: "0 10px 24px -12px rgba(20,20,26,0.5)",
                      cursor: busy ? "default" : "pointer"
                    }
                  : { background: "rgba(20,20,26,0.16)", cursor: "not-allowed" }
              }
            >
              {busy ? "Creating…" : "Create & open →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
