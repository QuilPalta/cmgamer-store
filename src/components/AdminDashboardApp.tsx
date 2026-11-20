'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StoreSnapshot } from '@/types/store';
import {
  createOrderWithReservation,
  deleteComponentItem,
  deletePcBuild,
  deleteTechService,
  loadStoreSnapshot,
  saveStoreSettings,
  syncLocalDataToSupabase,
  updateOrderWorkflow,
  upsertComponentItem,
  upsertPcBuild,
  upsertTechService,
} from '@/lib/storeRepository';
import { BrandLogo } from './BrandLogo';
import { AdminOrdersView } from './AdminOrdersView';
import { AdminInventoryView } from './AdminInventoryView';
import { AdminMetricsView } from './AdminMetricsView';
import { AdminSettingsView } from './AdminSettingsView';
import {
  BarChart3,
  ExternalLink,
  LogOut,
  Package,
  Settings,
  ShoppingBag,
} from 'lucide-react';

type AdminTab = 'ORDERS' | 'INVENTORY' | 'METRICS' | 'SETTINGS';

export function AdminDashboardApp() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<StoreSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('ORDERS');

  async function refresh() {
    const data = await loadStoreSnapshot();
    setSnapshot(data);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.push('/admin/login');
    router.refresh();
  }

  if (!snapshot) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-3">
        <BrandLogo size="lg" />
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 animate-pulse">
          Cargando panel CM GAMER...
        </p>
      </div>
    );
  }

  const pendingCount = snapshot.orders.filter(
    (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
  ).length;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" showText subtitle="Panel de Administración" />
            <span
              className={`hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                snapshot.backend === 'SUPABASE'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              {snapshot.backend === 'SUPABASE' ? 'Nube Supabase' : 'Modo Local'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-red-500" />
              <span className="hidden sm:inline">Ver Tienda</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-red-950 border border-zinc-700 hover:border-red-500/40 text-xs font-bold text-zinc-300 hover:text-red-300 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto border-t border-zinc-900">
          {(
            [
              {
                id: 'ORDERS' as const,
                label: 'Ventas y Pagos',
                icon: ShoppingBag,
                badge: pendingCount > 0 ? pendingCount : undefined,
              },
              {
                id: 'INVENTORY' as const,
                label: 'Inventario',
                icon: Package,
              },
              {
                id: 'METRICS' as const,
                label: 'Métricas',
                icon: BarChart3,
              },
              {
                id: 'SETTINGS' as const,
                label: 'Configuración',
                icon: Settings,
              },
            ]
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-xs font-bold inline-flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? 'border-red-600 text-white'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    active ? 'text-red-500' : 'text-zinc-500'
                  }`}
                />
                {tab.label}
                {tab.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'ORDERS' && (
          <AdminOrdersView
            orders={snapshot.orders}
            builds={snapshot.builds}
            services={snapshot.services}
            settings={snapshot.settings}
            onUpdateWorkflow={async (id, patch) => {
              await updateOrderWorkflow(id, patch);
              await refresh();
            }}
            onCreateManualOrder={async (input) => {
              const created = await createOrderWithReservation(input);
              await refresh();
              return created;
            }}
          />
        )}

        {activeTab === 'INVENTORY' && (
          <AdminInventoryView
            builds={snapshot.builds}
            components={snapshot.components}
            services={snapshot.services}
            onSaveBuild={async (input) => {
              await upsertPcBuild(input);
              await refresh();
            }}
            onDeleteBuild={async (id) => {
              await deletePcBuild(id);
              await refresh();
            }}
            onSaveComponent={async (input) => {
              await upsertComponentItem(input);
              await refresh();
            }}
            onDeleteComponent={async (id) => {
              await deleteComponentItem(id);
              await refresh();
            }}
            onSaveService={async (input) => {
              await upsertTechService(input);
              await refresh();
            }}
            onDeleteService={async (id) => {
              await deleteTechService(id);
              await refresh();
            }}
          />
        )}

        {activeTab === 'METRICS' && (
          <AdminMetricsView
            builds={snapshot.builds}
            components={snapshot.components}
            services={snapshot.services}
            orders={snapshot.orders}
          />
        )}

        {activeTab === 'SETTINGS' && (
          <AdminSettingsView
            settings={snapshot.settings}
            storageBackend={snapshot.backend}
            supabaseError={snapshot.supabaseError}
            onSaveSettings={async (next) => {
              await saveStoreSettings(next);
              await refresh();
            }}
            onSyncLocalToSupabase={async () => {
              return syncLocalDataToSupabase();
            }}
            onRefreshSnapshot={refresh}
          />
        )}
      </main>
    </div>
  );
}
