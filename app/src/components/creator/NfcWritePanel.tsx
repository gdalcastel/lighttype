"use client";

import { useEffect, useState } from "react";
import { Nfc, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { isNativeApp } from "@/lib/native";
import {
  getNfcCapability,
  openNfcSettings,
  writeTextToNfcTag,
  writeUrlToNfcTag,
  type NfcCapability,
} from "@/lib/nfc";
import { cn } from "@/lib/utils";

type Mode = "text" | "url";

export function NfcWritePanel({
  defaultText = "",
  className,
}: {
  defaultText?: string;
  className?: string;
}) {
  const native = isNativeApp();
  const [capability, setCapability] = useState<NfcCapability | null>(null);
  const [mode, setMode] = useState<Mode>("text");
  const [value, setValue] = useState(defaultText);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getNfcCapability().then((next) => {
      if (!cancelled) setCapability(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (defaultText && !value) setValue(defaultText);
  }, [defaultText, value]);

  async function handleWrite() {
    setWriting(true);
    try {
      if (mode === "url") {
        await writeUrlToNfcTag(value);
      } else {
        await writeTextToNfcTag(value);
      }
      toast.success("Tag NFC gravada");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao gravar a tag.";
      toast.error(message);
    } finally {
      setWriting(false);
    }
  }

  return (
    <Section
      title="NFC"
      description={
        native
          ? "Grave um texto ou URL em uma tag NFC aproximando o aparelho."
          : "Disponível no app iOS/Android (Capacitor). Na web esta função fica desativada."
      }
      className={className}
    >
      <div className="space-y-3 rounded-[14px] border border-border bg-background p-3">
        <div className="flex gap-1.5 rounded-[12px] border border-border bg-surface p-1">
          {(
            [
              ["text", "Texto"],
              ["url", "URL"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                "min-h-10 flex-1 rounded-[9px] px-3 py-2 text-[13px] font-medium transition",
                mode === id ? "bg-white text-foreground shadow-sm" : "text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={mode === "url" ? "https://…" : "Valor para gravar"}
          aria-label={mode === "url" ? "URL NFC" : "Texto NFC"}
        />

        {capability && !capability.enabled ? (
          <p className="text-[12px] leading-snug text-muted">{capability.message}</p>
        ) : null}

        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={!native || writing || !value.trim() || capability?.enabled === false}
            onClick={() => void handleWrite()}
          >
            {writing ? <Loader2 className="size-4 animate-spin" /> : <Nfc className="size-4" />}
            {writing ? "Aproxime a tag…" : "Gravar tag NFC"}
          </Button>
          {native && capability?.supported && !capability.enabled ? (
            <Button
              variant="secondary"
              size="icon"
              aria-label="Abrir configurações NFC"
              onClick={() => void openNfcSettings()}
            >
              <Settings2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
