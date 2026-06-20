"use client";

import { useState } from "react";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";

const STYLES = [
  { value: "EUROPEAN_FRAMELESS", label: "European Frameless" },
  { value: "AMERICAN_FRAMED", label: "American Framed" }
] as const;

export function buildCabinetColorPayload(formData: FormData) {
  return {
    cabinetStyle: String(formData.get("cabinetStyle")),
    name: String(formData.get("name") ?? "").trim(),
    colorCode: String(formData.get("colorCode") ?? "").trim() || null,
    swatchImageUrl: String(formData.get("swatchImageUrl") ?? "").trim() || null,
    swatchHex: String(formData.get("swatchHex") ?? "").trim() || null,
    hoverExampleImageUrl: String(formData.get("hoverExampleImageUrl") ?? "").trim() || null,
    promptDescription: String(formData.get("promptDescription") ?? "").trim(),
    active: formData.get("active") === "on",
    sortOrder: Number(String(formData.get("sortOrder") ?? "0")) || 0
  };
}

export function CabinetColorForm({ color }: { color?: CabinetColor }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const payload = buildCabinetColorPayload(new FormData(event.currentTarget));
    const response = await fetch(
      color ? `/api/admin/cabinet-colors/${color.id}` : "/api/admin/cabinet-colors",
      {
        method: color ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );
    if (!response.ok) {
      setBusy(false);
      setError("Unable to save cabinet color. Check the fields and try again.");
      return;
    }
    window.location.reload();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded border border-stone-300 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{color ? "Edit color" : "Add color"}</h2>
      <label className="block text-sm font-medium">
        Cabinet style
        <select name="cabinetStyle" defaultValue={color?.cabinetStyle ?? "EUROPEAN_FRAMELESS"} className="mt-1 w-full rounded border border-stone-300 px-3 py-2">
          {STYLES.map((style) => (
            <option key={style.value} value={style.value}>{style.label}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Color name
        <input name="name" defaultValue={color?.name ?? ""} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Color code
        <input name="colorCode" defaultValue={color?.colorCode ?? ""} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Swatch image URL
        <input name="swatchImageUrl" defaultValue={color?.swatchImageUrl ?? ""} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Fallback HEX
        <input name="swatchHex" defaultValue={color?.swatchHex ?? ""} placeholder="#d8c8ad" className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Hover example image URL
        <input name="hoverExampleImageUrl" defaultValue={color?.hoverExampleImageUrl ?? ""} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Prompt description
        <textarea name="promptDescription" defaultValue={color?.promptDescription ?? ""} rows={3} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">
          Sort order
          <input name="sortOrder" type="number" defaultValue={color?.sortOrder ?? 0} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
        </label>
        <label className="mt-7 flex items-center gap-2 text-sm font-medium">
          <input name="active" type="checkbox" defaultChecked={color?.active ?? true} />
          Active
        </label>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Saving..." : "Save color"}
      </button>
    </form>
  );
}
