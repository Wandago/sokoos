"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { classifyDirection } from "@/lib/direction";
import { newId } from "@/lib/id";
import { categorise } from "@/lib/statements";
import { DirectionVerdictCard } from "./direction-verdict";
import type { CaptureKind } from "@/lib/types";

/**
 * The camera really opens and the photo is really kept. What it deliberately
 * does not do is pretend to read the numbers off it: that needs a server, and
 * this app does not have one. So the seller types the amount and the words,
 * and the classification — credit or debit — is done here, for real, and shows
 * its reasoning.
 */
export function CameraSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addCapture } = useStore();
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [shot, setShot] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [kind, setKind] = useState<CaptureKind>("receipt");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open || shot) return;
    let cancelled = false;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("This browser will not give a web page the camera. Upload a photo instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setCameraError(null);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) {
          setCameraError("The camera was not allowed. Upload a photo instead.");
        }
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, shot, stop]);

  const snap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    // Keep it small: this is going into localStorage, not a photo library.
    const scale = Math.min(1, 900 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setShot(canvas.toDataURL("image/jpeg", 0.7));
    stop();
  };

  const reset = () => {
    setShot(null);
    setCameraError(null);
    setAmount("");
    setMerchant("");
    setNote("");
  };

  const close = () => {
    stop();
    reset();
    onClose();
  };

  // The words on the document decide the direction, not the photo.
  const words = `${kindWords[kind]} ${merchant} ${note}`;
  const verdict = classifyDirection(words);

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Capture a receipt"
      size="lg"
      description="The photo stays on this phone."
      footer={
        shot ? (
          <Button
            full
            size="lg"
            disabled={!amount}
            onClick={() => {
              addCapture({
                id: newId("cap"),
                kind,
                fileName: `${kind}-${new Date().toISOString().slice(0, 10)}.jpg`,
                uploadedAt: new Date().toISOString(),
                status: "needs_review",
                confidence: verdict.confidence,
                via: "camera",
                direction: verdict.direction,
                directionReason: verdict.reason,
                note: note.trim() || undefined,
                extracted: {
                  amount: Number(amount) || 0,
                  date: new Date().toISOString(),
                  merchant: merchant.trim() || undefined,
                  category: categorise(words, verdict.direction),
                },
              });
              close();
              toast(
                `Captured as money ${verdict.direction === "credit" ? "in" : "out"}. Review it when you're ready.`,
              );
            }}
          >
            <Check className="size-4" strokeWidth={2.5} />
            Save for review
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4 pb-4">
        {!shot ? (
          <>
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-panel">
              <video
                ref={videoRef}
                playsInline
                muted
                className="size-full object-cover"
                aria-label="Camera viewfinder"
              />
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <Camera className="size-8 text-panel-muted" />
                  <p className="text-[13px] leading-relaxed text-panel-muted">{cameraError}</p>
                </div>
              )}
              {/* Framing guides, so the receipt lands square. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-6 rounded-xl border-2 border-dashed border-white/25"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" />
                Upload instead
              </Button>
              <Button disabled={!!cameraError} onClick={snap}>
                <Camera className="size-4" />
                Take the photo
              </Button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setShot(String(reader.result));
                reader.readAsDataURL(file);
                stop();
              }}
            />
          </>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shot}
              alt="The receipt you captured"
              className="w-full rounded-2xl border border-border-subtle object-cover"
            />
            <Button variant="secondary" full onClick={reset}>
              <RotateCcw className="size-4" />
              Take it again
            </Button>

            <div className="flex gap-3 rounded-2xl bg-surface-sunken p-3.5">
              <ShieldCheck className="size-5 shrink-0 text-text-secondary" />
              <p className="text-[12px] leading-relaxed text-text-secondary">
                We keep the photo on this phone. Reading the numbers off it would need a server,
                which this app does not have — so type the amount, and we will work out whether it
                is money in or money out.
              </p>
            </div>

            <Field label="What is it?">
              <Select value={kind} onChange={(e) => setKind(e.target.value as CaptureKind)}>
                <option value="receipt">Receipt — something you paid for</option>
                <option value="invoice">Invoice — a supplier bill</option>
                <option value="mpesa_message">M-Pesa message — a payment you received</option>
              </Select>
            </Field>

            <Field label="Amount">
              <Input
                prefix="KES"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </Field>

            <Field label="Who it was with">
              <Input
                placeholder="Gikomba Millers"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
              />
            </Field>

            <Field label="What it was for" hint="This is what we read to decide credit or debit.">
              <Input
                placeholder="Paid to the supplier for flour"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>

            <DirectionVerdictCard verdict={verdict} amount={Number(amount) || 0} />
          </>
        )}
      </div>
    </Sheet>
  );
}

/** What the chosen document type says about the direction, in plain words. */
const kindWords: Record<CaptureKind, string> = {
  receipt: "receipt paid to",
  invoice: "invoice from supplier",
  mpesa_message: "received from",
  mpesa_statement: "statement",
  bank_statement: "statement",
};
