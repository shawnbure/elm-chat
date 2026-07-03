/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Cloudflare Turnstile site key. When set, the landing page runs an invisible
   * Turnstile challenge before creating a room. Leave unset for local dev.
   */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /**
   * Cloudflare Web Analytics token. When set, the landing page (only — never
   * room pages) loads the cookieless analytics beacon. Leave unset for local dev.
   */
  readonly VITE_CF_ANALYTICS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  turnstile?: {
    render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
    execute: (widgetId: string, options?: Record<string, unknown>) => void;
    reset: (widgetId?: string) => void;
    remove: (widgetId: string) => void;
  };
}
