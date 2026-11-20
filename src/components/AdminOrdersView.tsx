'use client';

import React, { useMemo, useState } from 'react';
import {
  DeliveryMethod,
  OrderRecord,
  OrderStatus,
  PaymentMethod,
  PcBuild,
  StoreSettings,
  TechService,
} from '@/types/store';
import {
  buildSellerToCustomerWhatsAppUrl,
  DELIVERY_METHOD_LABELS,
  formatClp,
  ORDER_STATUS_META,
  PAYMENT_METHOD_LABELS,
} from '@/lib/formatters';
import { CreateOrderInput } from '@/lib/storeRepository';
import { triggerOrderEmailNotification } from '@/lib/emailService';
import { useToast } from './ToastProvider';
import {
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Mail,
  MessageCircle,
  PackageCheck,
  Plus,
  Truck,
  X,
  XCircle,
} from 'lucide-react';

interface AdminOrdersViewProps {
  orders: OrderRecord[];
  builds: PcBuild[];
  services: TechService[];
  settings: StoreSettings;
  onUpdateWorkflow: (
    orderId: string,
    patch: {
      status?: OrderStatus;
      tracking_code?: string;
      notes?: string;
    }
  ) => Promise<void>;
  onCreateManualOrder: (input: CreateOrderInput) => Promise<OrderRecord>;
}

export function AdminOrdersView({
  orders,
  builds,
  services,
  settings,
  onUpdateWorkflow,
  onCreateManualOrder,
}: AdminOrdersViewProps) {
  const { showToast, confirmAction } = useToast();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, string>>(
    {}
  );

  // Manual POS / WhatsApp Sale Modal
  const [isPosOpen, setIsPosOpen] = useState(false);
  const [posName, setPosName] = useState('');
  const [posPhone, setPosPhone] = useState('');
  const [posEmail, setPosEmail] = useState('');
  const [posDelivery, setPosDelivery] =
    useState<DeliveryMethod>('STORE_PICKUP');
  const [posPayment, setPosPayment] = useState<PaymentMethod>('BANK_TRANSFER');
  const [posNotes, setPosNotes] = useState('');
  const [posItemKind, setPosItemKind] = useState<'BUILD' | 'SERVICE'>('BUILD');
  const [posSelectedId, setPosSelectedId] = useState('');
  const [posQty, setPosQty] = useState(1);
  const [isCreatingPos, setIsCreatingPos] = useState(false);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const countsByStatus = useMemo(() => {
    const map: Record<string, number> = { ALL: orders.length };
    for (const o of orders) {
      map[o.status] = (map[o.status] || 0) + 1;
    }
    return map;
  }, [orders]);

  const sellableBuilds = useMemo(
    () => builds.filter((b) => b.stock_quantity - b.reserved_quantity > 0),
    [builds]
  );

  async function advanceOrder(
    order: OrderRecord,
    nextStatus: OrderStatus,
    emailEvent?:
      | 'STOCK_CONFIRMED_AWAITING_PAYMENT'
      | 'PAID_READY_FOR_DELIVERY'
      | 'ORDER_COMPLETED'
      | 'ORDER_CANCELLED'
  ) {
    if (nextStatus === 'COMPLETED' || nextStatus === 'CANCELLED') {
      const ok = await confirmAction({
        title:
          nextStatus === 'COMPLETED'
            ? `¿Marcar ${order.order_code} como Entregado?`
            : `¿Cancelar pedido ${order.order_code}?`,
        description:
          nextStatus === 'COMPLETED'
            ? 'Esta acción cierra el pedido de forma definitiva y descuenta el stock físico de las builds incluidas.'
            : 'Esta acción cierra el pedido como cancelado y libera el stock reservado para volver a venderlo.',
        confirmLabel:
          nextStatus === 'COMPLETED'
            ? 'Sí, Entregado y Descontar Stock'
            : 'Sí, Cancelar y Liberar Stock',
        tone: nextStatus === 'CANCELLED' ? 'danger' : 'primary',
      });
      if (!ok) return;
    }

    setBusyId(order.id);
    try {
      const tracking = trackingDrafts[order.id];
      await onUpdateWorkflow(order.id, {
        status: nextStatus,
        ...(tracking !== undefined ? { tracking_code: tracking } : {}),
      });

      if (emailEvent && order.customer_email) {
        const updatedOrder: OrderRecord = {
          ...order,
          status: nextStatus,
          tracking_code:
            tracking !== undefined ? tracking : order.tracking_code,
        };
        const res = await triggerOrderEmailNotification({
          event: emailEvent,
          order: updatedOrder,
          settings,
        });
        if (res.sent) {
          showToast(`Estado actualizado y correo enviado a ${res.to}`, {
            type: 'success',
          });
        } else {
          showToast(`Pedido ${order.order_code} actualizado`, {
            type: 'success',
          });
        }
      } else {
        showToast(`Pedido ${order.order_code} actualizado`, {
          type: 'success',
        });
      }
    } catch (err) {
      showToast('Error al actualizar pedido', {
        description: err instanceof Error ? err.message : 'Intenta de nuevo',
        type: 'error',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveTracking(order: OrderRecord) {
    const val = trackingDrafts[order.id] ?? order.tracking_code;
    setBusyId(order.id);
    try {
      await onUpdateWorkflow(order.id, { tracking_code: val });
      showToast('Código de seguimiento guardado', { type: 'success' });
    } catch (err) {
      showToast('Error al guardar seguimiento', {
        description: err instanceof Error ? err.message : '',
        type: 'error',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleManualEmail(order: OrderRecord) {
    if (!order.customer_email) {
      showToast('Este pedido no tiene correo electrónico registrado.', {
        type: 'warning',
      });
      return;
    }
    const event =
      order.status === 'PENDING_VERIFICATION'
        ? 'ORDER_RECEIVED'
        : order.status === 'AWAITING_PAYMENT'
        ? 'STOCK_CONFIRMED_AWAITING_PAYMENT'
        : order.status === 'PAID_READY'
        ? 'PAID_READY_FOR_DELIVERY'
        : order.status === 'COMPLETED'
        ? 'ORDER_COMPLETED'
        : 'ORDER_CANCELLED';

    setBusyId(order.id);
    try {
      const res = await triggerOrderEmailNotification({
        event,
        order,
        settings,
      });
      if (res.sent) {
        showToast(`Correo reenviado a ${res.to}`, { type: 'success' });
      } else {
        showToast('No se envió el correo', {
          description: res.error || res.reason || 'Revisa tu config SMTP.',
          type: 'warning',
        });
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreatePos(e: React.FormEvent) {
    e.preventDefault();
    if (!posSelectedId) {
      showToast('Selecciona una build o servicio.', { type: 'warning' });
      return;
    }

    setIsCreatingPos(true);
    try {
      let itemPayload: CreateOrderInput['items'][number];
      if (posItemKind === 'BUILD') {
        const b = builds.find((x) => x.id === posSelectedId);
        if (!b) throw new Error('Build no encontrada.');
        itemPayload = {
          item_type: 'BUILD',
          build_id: b.id,
          item_name: b.name,
          item_summary: `${b.specs.cpu} · ${b.specs.gpu}`,
          quantity: posQty,
          unit_price_clp: b.price_clp,
        };
      } else {
        const s = services.find((x) => x.id === posSelectedId);
        if (!s) throw new Error('Servicio no encontrado.');
        itemPayload = {
          item_type: 'SERVICE',
          service_id: s.id,
          item_name: s.name,
          item_summary: `Servicio técnico · ${s.estimated_time}`,
          quantity: posQty,
          unit_price_clp: s.price_clp ?? 0,
        };
      }

      const created = await onCreateManualOrder({
        customerName: posName,
        customerContact: posPhone,
        customerEmail: posEmail,
        deliveryMethod: posDelivery,
        shippingCostClp:
          posDelivery === 'FLAT_RATE_SHIPPING'
            ? settings.flat_shipping_cost_clp
            : 0,
        paymentMethod: posPayment,
        notes: posNotes,
        items: [itemPayload],
      });

      showToast(`Venta manual ${created.order_code} registrada`, {
        description: 'Puedes avanzar su estado de pago o entrega aquí mismo.',
        type: 'success',
      });
      setIsPosOpen(false);
      setPosName('');
      setPosPhone('');
      setPosEmail('');
      setPosNotes('');
      setPosSelectedId('');
      setPosQty(1);
    } catch (err) {
      showToast('Error al registrar venta manual', {
        description: err instanceof Error ? err.message : '',
        type: 'error',
      });
    } finally {
      setIsCreatingPos(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white">
            Ventas y Control de Pagos
          </h2>
          <p className="text-xs text-zinc-400">
            Flujo de verificación de stock, envío de datos bancarios por
            WhatsApp, confirmación de transferencia y cierre con descuento real
            de stock.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsPosOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 transition-colors self-start"
        >
          <Plus className="w-4 h-4" />
          Registrar Venta Manual (WhatsApp / Taller)
        </button>
      </div>

      {/* Status Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            'ALL',
            'PENDING_VERIFICATION',
            'AWAITING_PAYMENT',
            'PAID_READY',
            'COMPLETED',
            'CANCELLED',
          ] as const
        ).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              statusFilter === st
                ? 'bg-red-600 border-red-500 text-white'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {st === 'ALL' ? 'Todos' : ORDER_STATUS_META[st].shortLabel} (
            {countsByStatus[st] || 0})
          </button>
        ))}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-12 text-center space-y-2">
          <p className="text-sm font-bold text-white">
            No hay pedidos en esta vista.
          </p>
          <p className="text-xs text-zinc-400">
            Los pedidos de la tienda pública o ventas manuales aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const meta = ORDER_STATUS_META[order.status];
            const isClosed =
              order.status === 'COMPLETED' || order.status === 'CANCELLED';
            const isBusy = busyId === order.id;

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-4"
              >
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black text-white">
                        {order.order_code}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {new Date(order.created_at).toLocaleString('es-CL')}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-300">
                      <strong className="text-white">
                        {order.customer_name}
                      </strong>{' '}
                      · {order.customer_contact}
                      {order.customer_email ? ` · ${order.customer_email}` : ''}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {DELIVERY_METHOD_LABELS[order.delivery_method]}
                      {order.shipping_address
                        ? ` (${order.shipping_address})`
                        : ''}{' '}
                      · {PAYMENT_METHOD_LABELS[order.payment_method]}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] font-bold uppercase text-zinc-500">
                      Total Pedido
                    </div>
                    <div className="text-xl font-black text-red-400">
                      {formatClp(order.total_clp)}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="rounded-xl bg-zinc-900/70 border border-zinc-800/80 divide-y divide-zinc-800/80">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">
                          {item.quantity}x {item.item_name}
                        </span>
                        {item.item_summary && (
                          <div className="text-[11px] text-zinc-400">
                            {item.item_summary}
                          </div>
                        )}
                      </div>
                      <span className="font-bold text-zinc-200 whitespace-nowrap">
                        {formatClp(item.quantity * item.unit_price_clp)}
                      </span>
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <p className="text-xs text-zinc-400 bg-zinc-900/40 rounded-lg px-3 py-2 border border-zinc-800/60">
                    <strong className="text-zinc-300">Nota:</strong>{' '}
                    {order.notes}
                  </p>
                )}

                {/* Tracking input for shipping orders */}
                {order.delivery_method !== 'STORE_PICKUP' && !isClosed && (
                  <div className="flex items-center gap-2 max-w-md">
                    <Truck className="w-4 h-4 text-zinc-500 shrink-0" />
                    <input
                      type="text"
                      value={trackingDrafts[order.id] ?? order.tracking_code}
                      onChange={(e) =>
                        setTrackingDrafts((prev) => ({
                          ...prev,
                          [order.id]: e.target.value,
                        }))
                      }
                      placeholder="N° Seguimiento Starken / Chilexpress"
                      className="flex-1 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                    />
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSaveTracking(order)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white"
                    >
                      Guardar
                    </button>
                  </div>
                )}

                {/* Action Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/80">
                  {/* 1-Click Seller WhatsApp with Bank Details */}
                  <a
                    href={buildSellerToCustomerWhatsAppUrl(settings, order)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp + Datos Transferencia
                  </a>

                  {order.customer_email && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleManualEmail(order)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5 text-red-400" />
                      Reenviar Correo
                    </button>
                  )}

                  {!isClosed && (
                    <div className="flex flex-wrap items-center gap-2 ml-auto">
                      {order.status === 'PENDING_VERIFICATION' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            advanceOrder(
                              order,
                              'AWAITING_PAYMENT',
                              'STOCK_CONFIRMED_AWAITING_PAYMENT'
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          1. Confirmar Stock (Esperar Pago)
                        </button>
                      )}

                      {(order.status === 'PENDING_VERIFICATION' ||
                        order.status === 'AWAITING_PAYMENT') && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            advanceOrder(
                              order,
                              'PAID_READY',
                              'PAID_READY_FOR_DELIVERY'
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          2. Confirmar Transferencia
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          advanceOrder(order, 'COMPLETED', 'ORDER_COMPLETED')
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        3. Entregado (Descontar Stock)
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          advanceOrder(order, 'CANCELLED', 'ORDER_CANCELLED')
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-red-950/60 border border-zinc-700 hover:border-red-500/40 text-zinc-400 hover:text-red-300 text-xs font-bold transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MANUAL POS / WHATSAPP ORDER MODAL */}
      {isPosOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">
                Registrar Venta Manual (WhatsApp / Taller)
              </h3>
              <button
                type="button"
                onClick={() => setIsPosOpen(false)}
                className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePos} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPosItemKind('BUILD');
                    setPosSelectedId('');
                  }}
                  className={`py-2 rounded-xl text-xs font-bold border ${
                    posItemKind === 'BUILD'
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                  }`}
                >
                  Build Armada
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPosItemKind('SERVICE');
                    setPosSelectedId('');
                  }}
                  className={`py-2 rounded-xl text-xs font-bold border ${
                    posItemKind === 'SERVICE'
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                  }`}
                >
                  Servicio Técnico
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-3">
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    {posItemKind === 'BUILD' ? 'Build *' : 'Servicio *'}
                  </label>
                  <select
                    required
                    value={posSelectedId}
                    onChange={(e) => setPosSelectedId(e.target.value)}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="">Seleccionar...</option>
                    {posItemKind === 'BUILD'
                      ? sellableBuilds.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} — {formatClp(b.price_clp)} (Disp:{' '}
                            {b.stock_quantity - b.reserved_quantity})
                          </option>
                        ))
                      : services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} —{' '}
                            {s.price_clp !== null
                              ? formatClp(s.price_clp)
                              : s.price_label}
                          </option>
                        ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Cant.
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={posQty}
                    onChange={(e) =>
                      setPosQty(Math.max(1, parseInt(e.target.value, 10) || 1))
                    }
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Nombre Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={posName}
                    onChange={(e) => setPosName(e.target.value)}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={posPhone}
                    onChange={(e) => setPosPhone(e.target.value)}
                    placeholder="+569..."
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Entrega
                  </label>
                  <select
                    value={posDelivery}
                    onChange={(e) =>
                      setPosDelivery(e.target.value as DeliveryMethod)
                    }
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white"
                  >
                    {Object.entries(DELIVERY_METHOD_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Pago
                  </label>
                  <select
                    value={posPayment}
                    onChange={(e) =>
                      setPosPayment(e.target.value as PaymentMethod)
                    }
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white"
                  >
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Correo (opcional)
                </label>
                <input
                  type="email"
                  value={posEmail}
                  onChange={(e) => setPosEmail(e.target.value)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Notas internas
                </label>
                <input
                  type="text"
                  value={posNotes}
                  onChange={(e) => setPosNotes(e.target.value)}
                  placeholder="Ej: Cerrado por WhatsApp, retira viernes"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPosOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-bold text-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPos}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isCreatingPos ? 'Guardando...' : 'Registrar Venta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
