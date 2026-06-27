"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/server/platform/types";
import { fetchJson } from "@/lib/api-client";

const ROLES: UserRole[] = ["SALES", "DESIGNER", "ADMIN"];

const LABEL =
  "mb-[7px] block font-mono text-[9.5px] tracking-[0.12em] text-[#86867f]";
const FIELD =
  "studio-glass-input w-full rounded-[11px] px-3 py-[11px] text-[14px] text-[#16161a]";

export function CreateUserForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [role, setRole] = useState<UserRole>("SALES");
  const [password, setPassword] = useState("");
  const [monthlyRenderQuota, setMonthlyRenderQuota] = useState("50");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const valid = account.trim() !== "" && password.length >= 8;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetchJson("/api/admin/users", {
        method: "POST",
        body: {
          account: account.trim(),
          role,
          password,
          monthlyRenderQuota: parseInt(monthlyRenderQuota, 10)
        }
      });
      if (!response.ok) {
        setError(
          response.status === 409
            ? "Account already in use"
            : "Unable to create user. Check the fields and try again."
        );
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
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
        aria-label="Create a user"
        onClick={(event) => event.stopPropagation()}
        className="studio-anim-rise w-[440px] max-w-full rounded-[24px]"
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
              NEW USER
            </p>
            <h3 className="m-0 text-[20px] font-semibold text-[#16161a]">
              Create a user
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-[10px] border border-white/85 bg-white/60 text-[15px] leading-none text-[#86867f] transition-colors hover:text-studio-ink"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} autoComplete="off" className="p-6">
          <label className="mb-[14px] block">
            <span className={LABEL}>ACCOUNT</span>
            <input
              autoFocus
              required
              autoComplete="off"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              className={FIELD}
            />
          </label>

          <div className="mb-[14px] grid grid-cols-2 gap-[14px]">
            <label className="block">
              <span className={LABEL}>ROLE</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
                className={`${FIELD} appearance-none`}
              >
                {ROLES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>MONTHLY QUOTA</span>
              <input
                type="number"
                min="0"
                required
                value={monthlyRenderQuota}
                onChange={(event) => setMonthlyRenderQuota(event.target.value)}
                className={FIELD}
              />
            </label>
          </div>

          <label className="mb-[6px] block">
            <span className={LABEL}>PASSWORD</span>
            <input
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={FIELD}
            />
          </label>
          <p className="mb-[22px] font-mono text-[10px] tracking-[0.04em] text-[#aaaaa4]">
            At least 8 characters
          </p>

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
              onClick={onClose}
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
              {busy ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
