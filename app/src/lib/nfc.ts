import { CapacitorNfc, type NdefRecord } from "@capgo/capacitor-nfc";
import { isNativeApp } from "@/lib/native";

export type NfcCapability = {
  supported: boolean;
  enabled: boolean;
  message?: string;
};

function encodeTextRecord(text: string, lang = "pt"): NdefRecord {
  const encoder = new TextEncoder();
  const langBytes = Array.from(encoder.encode(lang));
  const textBytes = Array.from(encoder.encode(text));
  const payload = [langBytes.length & 0x3f, ...langBytes, ...textBytes];
  return { tnf: 0x01, type: [0x54], id: [], payload };
}

function encodeUriRecord(uri: string): NdefRecord {
  const encoder = new TextEncoder();
  const uriBytes = Array.from(encoder.encode(uri));
  const payload = [0x00, ...uriBytes];
  return { tnf: 0x01, type: [0x55], id: [], payload };
}

export async function getNfcCapability(): Promise<NfcCapability> {
  if (!isNativeApp()) {
    return {
      supported: false,
      enabled: false,
      message: "NFC só está disponível no app instalado (iOS/Android).",
    };
  }

  try {
    const { status } = await CapacitorNfc.getStatus();
    if (status === "NO_NFC") {
      return {
        supported: false,
        enabled: false,
        message: "Este aparelho não tem hardware NFC.",
      };
    }
    if (status === "NFC_DISABLED") {
      return {
        supported: true,
        enabled: false,
        message: "NFC está desligado. Ative nas configurações do aparelho.",
      };
    }
    return { supported: true, enabled: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao verificar NFC.";
    return { supported: false, enabled: false, message };
  }
}

export async function openNfcSettings(): Promise<void> {
  if (!isNativeApp()) return;
  await CapacitorNfc.showSettings();
}

async function writeRecords(records: NdefRecord[], alertMessage: string): Promise<void> {
  const capability = await getNfcCapability();
  if (!capability.supported) throw new Error(capability.message ?? "NFC indisponível.");
  if (!capability.enabled) throw new Error(capability.message ?? "Ative o NFC.");

  await CapacitorNfc.startScanning({
    invalidateAfterFirstRead: false,
    alertMessage,
  });

  try {
    await CapacitorNfc.write({ allowFormat: true, records });
  } finally {
    try {
      await CapacitorNfc.stopScanning();
    } catch {
      // ignore
    }
  }
}

export async function writeTextToNfcTag(
  text: string,
  options?: { alertMessage?: string },
): Promise<void> {
  const value = text.trim();
  if (!value) throw new Error("Informe um valor para gravar na tag.");
  await writeRecords(
    [encodeTextRecord(value)],
    options?.alertMessage ?? "Aproxime a tag NFC para gravar.",
  );
}

export async function writeUrlToNfcTag(
  url: string,
  options?: { alertMessage?: string },
): Promise<void> {
  const value = url.trim();
  if (!value) throw new Error("Informe uma URL para gravar na tag.");
  await writeRecords(
    [encodeUriRecord(value)],
    options?.alertMessage ?? "Aproxime a tag NFC para gravar a URL.",
  );
}
