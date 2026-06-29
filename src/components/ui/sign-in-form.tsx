"use client";

import { type FormEvent } from "react";
import { Checkbox } from "@/components/ui/checkbox";

const LABEL =
  "mb-[7px] block font-mono text-[10px] tracking-[0.16em] text-[#86867f]";
const FIELD =
  "studio-glass-input w-full rounded-[12px] px-[14px] py-[13px] text-[14.5px] text-[#16161a]";

export default function SignInForm({
  account,
  password,
  remember,
  busy,
  error,
  onAccountChange,
  onPasswordChange,
  onRememberChange,
  onSubmit
}: {
  account: string;
  password: string;
  remember: boolean;
  busy: boolean;
  error: string | null;
  onAccountChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberChange: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-[370px]">
      <div
        className="w-full rounded-[24px] p-[38px_36px]"
        style={{
          background:
            "linear-gradient(165deg,rgba(255,255,255,0.72),rgba(255,255,255,0.52))",
          border: "1px solid rgba(255,255,255,0.85)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.95) inset,0 30px 70px -34px rgba(20,20,26,0.34)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)"
        }}
      >
        <p className="mb-[9px] font-mono text-[10.5px] tracking-[0.2em] text-[#86867f]">
          SIGN IN
        </p>
        <h2 className="m-0 mb-1 text-[27px] font-semibold tracking-[-0.02em] text-[#16161a]">
          Welcome back
        </h2>

        {error && (
          <div
            role="alert"
            className="mb-4 mt-4 flex items-center gap-[9px] rounded-[12px] px-[13px] py-[11px] font-mono text-[12.5px] tracking-[0.02em]"
            style={{
              border: "1px solid rgba(176,90,90,0.4)",
              background: "rgba(214,138,138,0.16)",
              color: "#8a4444"
            }}
          >
            <span
              className="size-[6px] shrink-0 rounded-full"
              style={{ background: "#b05a5a" }}
            />
            {error}
          </div>
        )}

        <div className="mt-5">
          <label htmlFor="account" className={LABEL}>
            ACCOUNT
          </label>
          <input
            id="account"
            type="text"
            autoComplete="username"
            placeholder="mei.lin"
            value={account}
            onChange={(event) => onAccountChange(event.target.value)}
            className={`${FIELD} mb-[15px]`}
          />
          <label htmlFor="password" className={LABEL}>
            PASSWORD
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            className={FIELD}
          />
        </div>

        {/* ponytail: Remember-me kept by request — not in the handoff markup */}
        <label className="mt-[18px] flex cursor-pointer items-center gap-[10px]">
          <Checkbox checked={remember} onCheckedChange={onRememberChange} />
          <span className="text-[13px] font-medium text-[#16161a]">
            Remember me
          </span>
        </label>

        <button
          type="submit"
          disabled={busy}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            event.currentTarget.style.transform = `translate(${
              (event.clientX - rect.left - rect.width / 2) * 0.12
            }px, ${(event.clientY - rect.top - rect.height / 2) * 0.18}px)`;
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.transform = "";
          }}
          className="relative mt-[22px] w-full overflow-hidden rounded-[13px] p-[15px] text-[14px] font-semibold tracking-[0.01em] text-white"
          style={{
            background: "linear-gradient(180deg,#2c2c30,#141416)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.2),0 14px 30px -12px rgba(20,20,26,0.55)",
            transition: "transform 0.25s cubic-bezier(0.2,0.8,0.2,1)"
          }}
        >
          {busy ? (
            <span className="inline-flex items-center gap-[10px]">
              <span className="size-[13px] animate-spin rounded-full border-2 border-white/35 border-t-white" />
              Authenticating…
            </span>
          ) : (
            <span>Enter Studio →</span>
          )}
        </button>
      </div>
    </form>
  );
}
