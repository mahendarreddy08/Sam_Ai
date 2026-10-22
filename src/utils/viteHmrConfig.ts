/**
 * Vite HMR Configuration & AI Studio Preview Compatibility Helper
 *
 * In the Google AI Studio cloud environment, the development preview is served
 * through a reverse proxy. Vite's standalone HMR WebSocket server (default port 24678)
 * is not accessible from the browser iframe, which causes:
 *   [vite] failed to connect to websocket (Error: WebSocket closed without opened.)
 *   Unhandled Rejection: Error: WebSocket closed without opened.
 *
 * This utility provides:
 * 1. A unified detection helper for whether HMR should be disabled.
 * 2. Consistent server options for both `vite.config.ts` and `server.ts`.
 * 3. A targeted Vite dev plugin that neutralizes the client-side transport.connect()
 *    call in Vite's `client.mjs` without touching `window.WebSocket`, preserving
 *    the application's separate `/live` WebSocket connection for SAM voice streaming.
 */

export interface HmrServerOptions {
  hmr: boolean;
  ws?: false;
  watch?: null | Record<string, unknown>;
}

/**
 * Determines whether Vite HMR should be disabled based on the environment.
 * - Explicit DISABLE_HMR=true -> disabled
 * - Explicit DISABLE_HMR=false -> enabled
 * - Running in Google AI Studio (APPLET_ID or K_SERVICE present) -> disabled
 * - Local development -> enabled
 */
export function shouldDisableHmr(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.DISABLE_HMR === "true") return true;
  if (env.DISABLE_HMR === "false") return false;
  return Boolean(env.APPLET_ID || env.K_SERVICE);
}

/**
 * Returns unified Vite server options for HMR and file watching.
 */
export function getViteServerHmrConfig(env: NodeJS.ProcessEnv = process.env): HmrServerOptions {
  const disabled = shouldDisableHmr(env);
  if (disabled) {
    return {
      hmr: false,
      ws: false,
      watch: null,
    };
  }
  return {
    hmr: true,
  };
}

/**
 * Vite plugin that safely disables the Vite HMR client connection in AI Studio
 * while preserving CSS style injection, Fast Refresh context, and normal browser WebSockets.
 */
export function createDisableHmrPlugin(env: NodeJS.ProcessEnv = process.env) {
  if (!shouldDisableHmr(env)) {
    return null;
  }

  return {
    name: "vite-plugin-disable-hmr-for-ai-studio",
    apply: "serve" as const,
    transform(code: string, id: string) {
      if (id.includes("vite/dist/client/client.mjs") || (id.includes("client.mjs") && id.includes("vite"))) {
        return code.replace(
          "transport.connect(createHMRHandler(handleMessage));",
          "/* [vite-disable-hmr] In AI Studio preview, HMR WebSocket is disabled. Connection omitted. */"
        );
      }
    },
  };
}
