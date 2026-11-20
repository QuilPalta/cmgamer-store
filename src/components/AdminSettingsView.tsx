'use client';

import React, { useState } from 'react';
import { SmtpConfig, StoreBanner, StoreSettings } from '@/types/store';
import {
  getEffectiveSupabaseConfig,
  saveRuntimeSupabaseConfig,
} from '@/lib/supabaseClient';
import { triggerOrderEmailNotification } from '@/lib/emailService';
import { useToast } from './ToastProvider';
import {
  Building2,
  CloudUpload,
  Database,
  Mail,
  Plus,
  Save,
  Send,
  Trash2,
  Truck,
} from 'lucide-react';

interface AdminSettingsViewProps {
  settings: StoreSettings;
  storageBackend: 'SUPABASE' | 'LOCAL';
  supabaseError?: string;
  onSaveSettings: (next: StoreSettings) => Promise<void>;
  onSyncLocalToSupabase: () => Promise<number>;
  onRefreshSnapshot: () => Promise<void>;
}

export function AdminSettingsView({
  settings,
  storageBackend,
  supabaseError,
  onSaveSettings,
  onSyncLocalToSupabase,
  onRefreshSnapshot,
}: AdminSettingsViewProps) {
  const { showToast } = useToast();
  const [formState, setFormState] = useState<StoreSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);

  const existingCfg = getEffectiveSupabaseConfig();
  const [sbUrl, setSbUrl] = useState(existingCfg?.url || '');
  const [sbAnonKey, setSbAnonKey] = useState(existingCfg?.anonKey || '');
  const [isSyncingSb, setIsSyncingSb] = useState(false);

  const [testEmailTo, setTestEmailTo] = useState(
    settings.smtp_config?.admin_copy_email ||
      settings.bank_details.notification_email ||
      ''
  );
  const [isSendingTest, setIsSendingTest] = useState(false);

  const smtp: SmtpConfig = formState.smtp_config || {
    enabled: false,
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: '',
    pass: '',
    from_name: formState.store_name || 'CM GAMER',
    from_email: '',
    admin_copy_email: '',
  };

  function updateSmtp(patch: Partial<SmtpConfig>) {
    setFormState((prev) => ({
      ...prev,
      smtp_config: { ...smtp, ...patch },
    }));
  }

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveSettings(formState);
      showToast('Configuración guardada correctamente', { type: 'success' });
    } catch (err) {
      showToast('Error al guardar configuración', {
        description: err instanceof Error ? err.message : '',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendTestEmail() {
    setIsSendingTest(true);
    try {
      const res = await triggerOrderEmailNotification({
        event: 'TEST_EMAIL',
        settings: formState,
        testRecipient: testEmailTo,
      });
      if (res.sent) {
        showToast(`Correo de prueba enviado a ${res.to}`, { type: 'success' });
      } else {
        showToast('No se pudo enviar el correo de prueba', {
          description: res.error || res.reason || 'Verifica tus datos SMTP.',
          type: 'error',
        });
      }
    } finally {
      setIsSendingTest(false);
    }
  }

  async function handleConnectSupabase(e: React.FormEvent) {
    e.preventDefault();
    if (!sbUrl.trim() || !sbAnonKey.trim()) {
      saveRuntimeSupabaseConfig(null);
      await onRefreshSnapshot();
      showToast('Desconectado de Supabase (modo almacenamiento local)', {
        type: 'info',
      });
      return;
    }
    saveRuntimeSupabaseConfig({
      url: sbUrl.trim(),
      anonKey: sbAnonKey.trim(),
    });
    await onRefreshSnapshot();
    showToast('Credenciales de Supabase guardadas', {
      description:
        'Asegúrate de haber ejecutado supabase/migrations/001_cmgamer_schema.sql en tu proyecto.',
      type: 'success',
    });
  }

  async function handlePushToSupabase() {
    setIsSyncingSb(true);
    try {
      const count = await onSyncLocalToSupabase();
      await onRefreshSnapshot();
      showToast(`Datos sincronizados con Supabase (${count} registros)`, {
        type: 'success',
      });
    } catch (err) {
      showToast('Error al sincronizar con Supabase', {
        description: err instanceof Error ? err.message : '',
        type: 'error',
      });
    } finally {
      setIsSyncingSb(false);
    }
  }

  function addBanner() {
    const next: StoreBanner = {
      id: `banner-${Date.now()}`,
      badge_text: 'CM GAMER · HARDWARE PRO',
      title: 'Nuevo Banner Promocional',
      subtitle: 'Descripción corta del anuncio principal.',
      cta_text: 'Ver Builds',
      target_section: 'BUILDS',
      accent_style: 'RED_DARK',
      is_active: true,
    };
    setFormState((prev) => ({ ...prev, banners: [...prev.banners, next] }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white">
          Configuración de Tienda, Pagos y Nube
        </h2>
        <p className="text-xs text-zinc-400">
          Edita los datos de transferencia bancaria, WhatsApp, envíos, banners,
          correos SMTP y conexión con Supabase.
        </p>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* General & Shipping */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
          <h3 className="text-sm font-black text-white inline-flex items-center gap-2">
            <Truck className="w-4 h-4 text-red-500" />
            Datos Generales, WhatsApp y Entregas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Nombre de la Tienda
              </label>
              <input
                type="text"
                value={formState.store_name}
                onChange={(e) =>
                  setFormState({ ...formState, store_name: e.target.value })
                }
                className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Número de WhatsApp (con código país)
              </label>
              <input
                type="text"
                value={formState.whatsapp_number}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    whatsapp_number: e.target.value,
                  })
                }
                placeholder="+56912345678"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Barra de anuncio superior
              </label>
              <input
                type="text"
                value={formState.hero_announcement}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    hero_announcement: e.target.value,
                  })
                }
                className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Costo Envío Tarifa Plana (CLP)
              </label>
              <input
                type="number"
                min={0}
                value={formState.flat_shipping_cost_clp}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    flat_shipping_cost_clp: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Instrucciones de Retiro / Entrega
              </label>
              <input
                type="text"
                value={formState.pickup_instructions}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    pickup_instructions: e.target.value,
                  })
                }
                className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
          <h3 className="text-sm font-black text-white inline-flex items-center gap-2">
            <Building2 className="w-4 h-4 text-red-500" />
            Datos de Transferencia Bancaria (WhatsApp y Correos)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {(
              [
                ['holder_name', 'Titular'],
                ['rut', 'RUT'],
                ['bank_name', 'Banco'],
                ['account_type', 'Tipo de Cuenta'],
                ['account_number', 'N° de Cuenta'],
                ['notification_email', 'Correo Comprobantes'],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  {label}
                </label>
                <input
                  type="text"
                  value={formState.bank_details[field]}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      bank_details: {
                        ...formState.bank_details,
                        [field]: e.target.value,
                      },
                    })
                  }
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                />
              </div>
            ))}
          </div>
        </div>

        {/* SMTP Email Config */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-black text-white inline-flex items-center gap-2">
              <Mail className="w-4 h-4 text-red-500" />
              Notificaciones Automáticas por Correo (SMTP / Nodemailer)
            </h3>
            <label className="inline-flex items-center gap-2 text-xs font-bold text-zinc-200 cursor-pointer">
              <input
                type="checkbox"
                checked={smtp.enabled}
                onChange={(e) => updateSmtp({ enabled: e.target.checked })}
                className="accent-red-600"
              />
              Habilitar SMTP
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Host SMTP
              </label>
              <input
                type="text"
                value={smtp.host}
                onChange={(e) => updateSmtp({ host: e.target.value })}
                placeholder="smtp.gmail.com"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Puerto
              </label>
              <input
                type="number"
                value={smtp.port}
                onChange={(e) =>
                  updateSmtp({ port: parseInt(e.target.value, 10) || 465 })
                }
                className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smtp.secure}
                  onChange={(e) => updateSmtp({ secure: e.target.checked })}
                  className="accent-red-600"
                />
                SSL/TLS (Puerto 465)
              </label>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Usuario SMTP
              </label>
              <input
                type="text"
                value={smtp.user}
                onChange={(e) => updateSmtp({ user: e.target.value })}
                placeholder="tu-correo@gmail.com"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Contraseña / App Password
              </label>
              <input
                type="password"
                value={smtp.pass}
                onChange={(e) => updateSmtp({ pass: e.target.value })}
                placeholder="16 caracteres App Password"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Copia Oculta Admin (BCC)
              </label>
              <input
                type="email"
                value={smtp.admin_copy_email}
                onChange={(e) =>
                  updateSmtp({ admin_copy_email: e.target.value })
                }
                placeholder="admin@cmgamer.cl"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/80">
            <input
              type="email"
              value={testEmailTo}
              onChange={(e) => setTestEmailTo(e.target.value)}
              placeholder="Correo destino de prueba"
              className="rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white w-64"
            />
            <button
              type="button"
              disabled={isSendingTest}
              onClick={handleSendTestEmail}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white"
            >
              <Send className="w-3.5 h-3.5 text-red-400" />
              {isSendingTest ? 'Enviando...' : 'Enviar Correo de Prueba'}
            </button>
          </div>
        </div>

        {/* Hero Banners */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white">Banners del Hero</h3>
            <button
              type="button"
              onClick={addBanner}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-white"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar Banner
            </button>
          </div>

          <div className="space-y-3">
            {formState.banners.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 space-y-2.5 text-xs"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={b.badge_text}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        banners: prev.banners.map((x) =>
                          x.id === b.id
                            ? { ...x, badge_text: e.target.value }
                            : x
                        ),
                      }))
                    }
                    placeholder="Etiqueta superior"
                    className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-white"
                  />
                  <input
                    type="text"
                    value={b.cta_text}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        banners: prev.banners.map((x) =>
                          x.id === b.id ? { ...x, cta_text: e.target.value } : x
                        ),
                      }))
                    }
                    placeholder="Texto botón CTA"
                    className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-white"
                  />
                </div>
                <input
                  type="text"
                  value={b.title}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      banners: prev.banners.map((x) =>
                        x.id === b.id ? { ...x, title: e.target.value } : x
                      ),
                    }))
                  }
                  placeholder="Título principal"
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-white font-bold"
                />
                <input
                  type="text"
                  value={b.subtitle}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      banners: prev.banners.map((x) =>
                        x.id === b.id ? { ...x, subtitle: e.target.value } : x
                      ),
                    }))
                  }
                  placeholder="Subtítulo"
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-zinc-300"
                />
                <div className="flex items-center justify-between pt-1">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={b.is_active}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          banners: prev.banners.map((x) =>
                            x.id === b.id
                              ? { ...x, is_active: e.target.checked }
                              : x
                          ),
                        }))
                      }
                      className="accent-red-600"
                    />
                    <span className="text-zinc-300 font-semibold">Activo</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((prev) => ({
                        ...prev,
                        banners: prev.banners.filter((x) => x.id !== b.id),
                      }))
                    }
                    className="text-zinc-500 hover:text-red-400 inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-600/20"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Guardando...' : 'Guardar Toda la Configuración'}
          </button>
        </div>
      </form>

      {/* Supabase Cloud Connection */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black text-white inline-flex items-center gap-2">
            <Database className="w-4 h-4 text-red-500" />
            Base de Datos en la Nube (Supabase)
          </h3>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              storageBackend === 'SUPABASE'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
            }`}
          >
            Modo actual:{' '}
            {storageBackend === 'SUPABASE'
              ? 'Supabase Conectado'
              : 'Almacenamiento Local (Demo)'}
          </span>
        </div>

        {supabaseError && (
          <div className="rounded-xl bg-red-950/60 border border-red-500/40 p-3 text-xs text-red-200">
            Error Supabase: {supabaseError}
          </div>
        )}

        <form onSubmit={handleConnectSupabase} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Project URL (https://xxx.supabase.co)
              </label>
              <input
                type="text"
                value={sbUrl}
                onChange={(e) => setSbUrl(e.target.value)}
                placeholder="https://tu-proyecto.supabase.co"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Anon Public Key
              </label>
              <input
                type="password"
                value={sbAnonKey}
                onChange={(e) => setSbAnonKey(e.target.value)}
                placeholder="eyJhbGci..."
                className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold"
            >
              Guardar Credenciales Supabase
            </button>
            <button
              type="button"
              disabled={isSyncingSb}
              onClick={handlePushToSupabase}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-bold"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              {isSyncingSb
                ? 'Sincronizando...'
                : 'Subir Datos Locales a Supabase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
