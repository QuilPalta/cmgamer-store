'use client';

import React, { useMemo } from 'react';
import {
  ComponentInventoryItem,
  OrderRecord,
  PcBuild,
  TechService,
} from '@/types/store';
import { formatClp, ORDER_STATUS_META } from '@/lib/formatters';
import {
  Boxes,
  Clock,
  DollarSign,
  Monitor,
  TrendingUp,
} from 'lucide-react';

interface AdminMetricsViewProps {
  builds: PcBuild[];
  components: ComponentInventoryItem[];
  services: TechService[];
  orders: OrderRecord[];
}

export function AdminMetricsView({
  builds,
  components,
  orders,
}: AdminMetricsViewProps) {
  const stats = useMemo(() => {
    const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
    const activeOrders = orders.filter(
      (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
    );
    const totalRevenue = completedOrders.reduce((a, o) => a + o.total_clp, 0);
    const pipelineRevenue = activeOrders.reduce((a, o) => a + o.total_clp, 0);
    const buildsAvailable = builds.reduce(
      (a, b) => a + Math.max(0, b.stock_quantity - b.reserved_quantity),
      0
    );
    const buildsReserved = builds.reduce((a, b) => a + b.reserved_quantity, 0);
    const totalWarehouseParts = components.reduce((a, c) => a + c.quantity, 0);

    const itemSales = new Map<string, { name: string; qty: number; rev: number }>();
    for (const o of completedOrders) {
      for (const i of o.items) {
        const cur = itemSales.get(i.item_name) || {
          name: i.item_name,
          qty: 0,
          rev: 0,
        };
        cur.qty += i.quantity;
        cur.rev += i.quantity * i.unit_price_clp;
        itemSales.set(i.item_name, cur);
      }
    }

    const topItems = Array.from(itemSales.values())
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 6);

    return {
      completedCount: completedOrders.length,
      activeCount: activeOrders.length,
      totalRevenue,
      pipelineRevenue,
      buildsAvailable,
      buildsReserved,
      totalWarehouseParts,
      topItems,
    };
  }, [builds, components, orders]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white">Resumen y Métricas</h2>
        <p className="text-xs text-zinc-400">
          Estado general de ventas cerradas, pedidos en curso y disponibilidad
          de stock.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
            <span>Ventas Completadas</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {formatClp(stats.totalRevenue)}
          </div>
          <div className="text-[11px] text-zinc-500">
            {stats.completedCount} pedido(s) entregado(s)
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
            <span>En Curso (Por Cerrar)</span>
            <Clock className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {formatClp(stats.pipelineRevenue)}
          </div>
          <div className="text-[11px] text-zinc-500">
            {stats.activeCount} pedido(s) activo(s)
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
            <span>Builds Disponibles</span>
            <Monitor className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-white">
            {stats.buildsAvailable}
          </div>
          <div className="text-[11px] text-zinc-500">
            {stats.buildsReserved} unidad(es) reservada(s)
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
            <span>Piezas en Bodega</span>
            <Boxes className="w-4 h-4 text-zinc-300" />
          </div>
          <div className="text-2xl font-black text-white">
            {stats.totalWarehouseParts}
          </div>
          <div className="text-[11px] text-zinc-500">
            {components.length} modelo(s) registrado(s)
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
          <h3 className="text-sm font-black text-white inline-flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-red-500" />
            Pedidos por Estado
          </h3>
          <div className="space-y-2.5">
            {(
              [
                'PENDING_VERIFICATION',
                'AWAITING_PAYMENT',
                'PAID_READY',
                'COMPLETED',
                'CANCELLED',
              ] as const
            ).map((status) => {
              const count = orders.filter((o) => o.status === status).length;
              const meta = ORDER_STATUS_META[status];
              return (
                <div
                  key={status}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-800/70 last:border-0"
                >
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${meta.badgeClass}`}
                  >
                    {meta.shortLabel}
                  </span>
                  <span className="font-black text-white">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
          <h3 className="text-sm font-black text-white">
            Builds y Servicios Más Vendidos
          </h3>
          {stats.topItems.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">
              Aún no hay ventas completadas registradas.
            </p>
          ) : (
            <div className="space-y-2.5">
              {stats.topItems.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-800/70 last:border-0"
                >
                  <div>
                    <div className="font-bold text-white">{item.name}</div>
                    <div className="text-[11px] text-zinc-500">
                      {item.qty} unidad(es) vendida(s)
                    </div>
                  </div>
                  <span className="font-black text-emerald-400">
                    {formatClp(item.rev)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
