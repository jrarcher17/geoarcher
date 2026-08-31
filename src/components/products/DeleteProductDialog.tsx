"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function DeleteProductDialog({
  productId,
  name,
  adCount,
  onDeleted,
}: {
  productId: string;
  name: string;
  adCount: number;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adLabel =
    adCount === 1 ? "1 ad in My Ads" : `${adCount} ads in My Ads`;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/me/products/${productId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not delete that product.");
      setOpen(false);
      onDeleted();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete that product."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn-secondary text-sm text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Delete
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent
          title={`Delete ${name}?`}
          description={
            adCount > 0
              ? `This will also permanently delete ${adLabel}.`
              : "This cannot be undone."
          }
          className="max-w-md"
        >
          <p className="text-sm leading-relaxed text-slate-600">
            {adCount > 0
              ? `“${name}” and ${adCount === 1 ? "the ad created for it" : `the ${adCount} ads created for it`} will be removed. Campaigns for this product are deleted too.`
              : `“${name}” will be permanently removed.`}
          </p>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy ? "Deleting…" : adCount > 0 ? "Delete product and ads" : "Delete product"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
