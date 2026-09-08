import type { CapacitorConfig } from "@capacitor/cli";

/**
 * LightType — Capacitor
 *
 * - Produção mobile: `npm run build:mobile` gera `out/` e `npx cap sync`
 * - Dev no device apontando pro Next local:
 *     CAP_SERVER_URL=http://SEU_IP:43127 npx cap sync
 */
const serverUrl = process.env.CAP_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.lighttype.app",
  appName: "LightType",
  webDir: "out",
  backgroundColor: "#f7f3ee",
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: true,
      }
    : {
        androidScheme: "https",
      },
  android: {
    allowMixedContent: true,
  },
};

export default config;
