"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "cn";

export function VoiceInput({
  value,
  onChange,
  language,
  placeholder,
  multiline = false,
  rows = 2,
  className,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  language?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
  id?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("voice");
  const [status, setStatus] = useState<"idle" | "recording" | "sending">("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const supported =
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const toggle = async () => {
    if (status === "recording") {
      recorderRef.current?.stop();
      return;
    }
    if (!supported) {
      toast.error(t("unsupported"));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await sendAudio(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
    } catch {
      toast.error(t("failed"));
    }
  };

  const sendAudio = async (blob: Blob) => {
    setStatus("sending");
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      form.append("language", language || (locale === "mr" ? "mr" : "hi"));
      const res = await apiFetch<{ text: string }>("/voice/asr", {
        method: "POST",
        body: form,
      });
      onChange((value ? value + " " : "") + (res.text || ""));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed"));
    } finally {
      setStatus("idle");
    }
  };

  const Field = multiline ? Textarea : Input;
  const isBusy = status !== "idle";

  return (
    <div className={cn("relative", className)}>
      <Field
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={multiline ? rows : undefined}
        disabled={isBusy}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={isBusy}
        title={t("speak")}
        aria-label={t("speak")}
        className={cn(
          "absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-sm border transition-colors",
          status === "recording"
            ? "border-red-300 bg-red-50 text-red-600 animate-pulse"
            : "border-border bg-background text-muted-foreground hover:bg-accent/20 hover:text-foreground"
        )}
      >
        {status === "sending" ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : status === "recording" ? (
          <Mic className="h-4 w-4" aria-hidden="true" />
        ) : !supported ? (
          <MicOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Mic className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}