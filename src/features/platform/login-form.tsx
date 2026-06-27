"use client";

import { useState } from "react";
import SignInForm from "@/components/ui/sign-in-form";
import { LoginShowpiece } from "./login-showpiece";
import { fetchJson } from "@/lib/api-client";

export function LoginForm() {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetchJson("/api/auth/login", {
        method: "POST",
        body: { account: account.trim(), password }
      });
      if (!response.ok) {
        setError("Invalid account or password");
        return;
      }
      window.location.href = "/projects";
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="studio-anim-screen relative grid min-h-[100dvh] overflow-hidden text-studio-ink lg:grid-cols-[1.08fr_0.92fr]"
      style={{
        background:
          "radial-gradient(130% 120% at 12% 8%,#f3f3f1 0%,#e8e8e5 48%,#e0e0dc 100%)"
      }}
    >
      {/* soft environment blooms */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-[12%] left-[4%] h-[60%] w-[46%] bg-[radial-gradient(circle,rgba(255,255,255,0.85),transparent_62%)] blur-[36px]" />
        <div className="absolute -bottom-[18%] left-[18%] h-[64%] w-[50%] bg-[radial-gradient(circle,rgba(202,205,210,0.6),transparent_62%)] blur-[54px]" />
        <div className="absolute right-[30%] top-[18%] h-[42%] w-[30%] bg-[radial-gradient(circle,rgba(255,255,255,0.6),transparent_60%)] blur-[40px]" />
      </div>

      {/* LEFT — brand showpiece (desktop only) */}
      <section className="relative z-[1] hidden flex-col justify-between p-[46px_52px] lg:flex">
        <div className="relative z-[2] flex items-center gap-3">
          <span
            aria-hidden
            className="relative size-[15px] shrink-0 rounded-[4px] border-[1.5px] border-studio-ink"
          >
            <span className="absolute inset-[3px] rounded-[1px] bg-studio-ink" />
          </span>
          <span className="font-mono text-[12px] tracking-[0.36em] text-studio-ink">
            ABCABINET
          </span>
          <span className="font-mono text-[12px] tracking-[0.36em] text-[#9a9a96]">
            STUDIO
          </span>
        </div>

        <div
          className="relative w-full max-w-[600px] rounded-[26px] p-[36px_34px]"
          style={{
            background:
              "linear-gradient(160deg,rgba(255,255,255,0.62),rgba(255,255,255,0.4))",
            border: "1px solid rgba(255,255,255,0.85)",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.95) inset,0 30px 70px -30px rgba(20,20,26,0.32)",
            backdropFilter: "blur(22px) saturate(160%)",
            WebkitBackdropFilter: "blur(22px) saturate(160%)"
          }}
        >
          <p className="mb-[18px] font-mono text-[10.5px] tracking-[0.22em] text-[#86867f]">
            AI KITCHEN AGENT
          </p>
          <h1 className="m-0 text-balance text-[42px] font-semibold leading-[1.04] tracking-[-0.03em] text-[#16161a]">
            From conversation to kitchen concept.
          </h1>

          {/* floating isometric cube */}
          <div
            aria-hidden
            className="studio-anim-floaty pointer-events-none absolute"
            style={{ top: 11, left: 433, width: 88, height: 113 }}
          >
            <div className="kl-cubes" style={{ fontSize: 5 }}>
              <div className="kl-loop">
                <div className="kl-item" />
                <div className="kl-item" />
                <div className="kl-item" />
                <div className="kl-item" />
                <div className="kl-item" />
                <div className="kl-item" />
              </div>
            </div>
          </div>
        </div>

        <LoginShowpiece />
      </section>

      {/* RIGHT — sign in */}
      <section className="relative z-[1] flex flex-col justify-center px-[8%] py-10">
        <SignInForm
          account={account}
          password={password}
          remember={remember}
          busy={busy}
          error={error}
          onAccountChange={setAccount}
          onPasswordChange={setPassword}
          onRememberChange={setRemember}
          onSubmit={submit}
        />
      </section>
    </main>
  );
}
