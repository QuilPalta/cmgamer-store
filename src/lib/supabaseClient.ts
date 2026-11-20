import { createClient, SupabaseClient } from '@supabase/supabase-js';

const LS_SUPABASE_CONFIG_KEY = 'cmgamer_supabase_config_v1';

export interface SupabaseRuntimeConfig {
  url: string;
  anonKey: string;
}

export function getEffectiveSupabaseConfig(): SupabaseRuntimeConfig | null {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (
    envUrl &&
    envKey &&
    envUrl.startsWith('http') &&
    !envUrl.includes('tu-proyecto.supabase.co')
  ) {
    return { url: envUrl, anonKey: envKey };
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(LS_SUPABASE_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SupabaseRuntimeConfig;
        if (
          parsed.url &&
          parsed.anonKey &&
          parsed.url.startsWith('https://') &&
          parsed.url.includes('.supabase.co')
        ) {
          return parsed;
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return null;
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const cfg = getEffectiveSupabaseConfig();
  if (!cfg) {
    cachedClient = null;
    cachedConfigKey = '';
    return null;
  }

  const nextKey = `${cfg.url}::${cfg.anonKey}`;
  if (!cachedClient || cachedConfigKey !== nextKey) {
    cachedClient = createClient(cfg.url, cfg.anonKey);
    cachedConfigKey = nextKey;
  }
  return cachedClient;
}

export function saveRuntimeSupabaseConfig(
  config: SupabaseRuntimeConfig | null
): void {
  if (typeof window === 'undefined') return;
  if (!config || !config.url.trim() || !config.anonKey.trim()) {
    window.localStorage.removeItem(LS_SUPABASE_CONFIG_KEY);
  } else {
    window.localStorage.setItem(
      LS_SUPABASE_CONFIG_KEY,
      JSON.stringify({
        url: config.url.trim(),
        anonKey: config.anonKey.trim(),
      })
    );
  }
  cachedClient = null;
  cachedConfigKey = '';
}
