'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DeliveryMethod,
  OrderRecord,
  PaymentMethod,
  PcBuild,
  StoreSnapshot,
} from '@/types/store';
import {
  BUILD_TIER_META,
  buildBuyerInquiryWhatsAppUrl,
  buildBuyerOrderWhatsAppUrl,
  cleanWhatsAppPhone,
  DELIVERY_METHOD_LABELS,
  formatClp,
  PAYMENT_METHOD_LABELS,
} from '@/lib/formatters';
import {
  createOrderWithReservation,
  loadStoreSnapshot,
} from '@/lib/storeRepository';
import { triggerOrderEmailNotification } from '@/lib/emailService';
import { BrandLogo } from './BrandLogo';
import { useToast } from './ToastProvider';
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  ExternalLink,
  Gamepad2,
  Gauge,
  HardDrive,
  Lock,
  MemoryStick,
  MessageCircle,
  Monitor,
  ShieldCheck,
  ShoppingCart,
  Truck,
  X,
} from 'lucide-react';

interface BuildDetailPageViewProps {
  slug: string;
}

export function BuildDetailPageView({ slug }: BuildDetailPageViewProps) {
  const { showToast } = useToast();
  const [snapshot, setSnapshot] = useState<StoreSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Direct Checkout Drawer for this build
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>('STORE_PICKUP');
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('BANK_TRANSFER');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(
    null
  );

  async function refresh() {
    const data = await loadStoreSnapshot();
    setSnapshot(data);
    setIsLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [slug]);

  const build: PcBuild | null = useMemo(() => {
    if (!snapshot) return null;
    return (
      snapshot.builds.find((b) => b.slug === slug || b.id === slug) || null
    );
  }, [snapshot, slug]);

  const allPhotos = useMemo(() => {
    if (!build) return [];
    const list: string[] = [];
    if (build.image_url?.trim()) list.push(build.image_url.trim());
    for (const url of build.gallery_urls || []) {
      const clean = url?.trim();
      if (clean && !list.includes(clean)) {
        list.push(clean);
      }
    }
    return list;
  }, [build]);

  useEffect(() => {
    setActivePhotoIdx(0);
  }, [build?.id]);

  const otherBuilds = useMemo(() => {
    if (!snapshot || !build) return [];
    return snapshot.builds
      .filter((b) => b.is_active && b.id !== build.id)
      .slice(0, 3);
  }, [snapshot, build]);

  if (isLoading || !snapshot) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4">
        <BrandLogo size="lg" />
        <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400 animate-pulse">
          Cargando PC Build...
        </p>
      </div>
    );
  }

  if (!build) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <BrandLogo size="lg" />
        <h1 className="text-2xl font-black text-white">Build no encontrada</h1>
        <p className="text-xs text-zinc-400 max-w-md">
          Es posible que esta configuración haya sido retirada o el enlace haya
          cambiado.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Catálogo CM GAMER
        </Link>
      </div>
    );
  }

  const available = Math.max(0, build.stock_quantity - build.reserved_quantity);
  const isOutOfStock = available <= 0;
  const tierMeta = BUILD_TIER_META[build.tier];
  const currentPhoto =
    allPhotos[activePhotoIdx % Math.max(1, allPhotos.length)] || '';

  const shippingCost =
    deliveryMethod === 'FLAT_RATE_SHIPPING'
      ? snapshot.settings.flat_shipping_cost_clp
      : 0;
  const subtotal = build.price_clp * qty;
  const total = subtotal + shippingCost;

  const whatsappDirectUrl = `https://wa.me/${cleanWhatsAppPhone(
    snapshot.settings.whatsapp_number
  )}`;

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!snapshot || !build) return;
    if (deliveryMethod !== 'STORE_PICKUP' && !shippingAddress.trim()) {
      showToast('Ingresa tu dirección y comuna para el envío.', {
        type: 'warning',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await createOrderWithReservation({
        customerName,
        customerContact,
        customerEmail,
        deliveryMethod,
        shippingAddress,
        shippingCostClp: shippingCost,
        paymentMethod,
        notes: orderNotes,
        items: [
          {
            item_type: 'BUILD',
            build_id: build.id,
            item_name: build.name,
            item_summary: `${build.specs.cpu} · ${build.specs.gpu}`,
            quantity: qty,
            unit_price_clp: build.price_clp,
          },
        ],
      });

      if (order.customer_email) {
        triggerOrderEmailNotification({
          event: 'ORDER_RECEIVED',
          order,
          settings: snapshot.settings,
        }).catch(() => {});
      }

      setConfirmedOrder(order);
      setOrderNotes('');
      await refresh();
      showToast(`Pedido ${order.order_code} generado con éxito`, {
        type: 'success',
      });
    } catch (err) {
      showToast('No se pudo generar la reserva', {
        description: err instanceof Error ? err.message : '',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* Top Bar */}
      <div className="bg-red-600 text-white text-[11px] sm:text-xs font-bold tracking-wide text-center py-2 px-4">
        {snapshot.settings.hero_announcement}
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-800/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="hover:opacity-95 transition-opacity">
            <BrandLogo
              size="md"
              showText
              subtitle="PC Builds & Servicio Técnico"
            />
          </Link>

          <div className="flex items-center gap-2.5">
            <Link
              href="/#builds"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-100 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-red-500" />
              Volver al Catálogo
            </Link>
            <a
              href={whatsappDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-100 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5 text-red-500" />
              WhatsApp
            </a>
            <Link
              href="/admin"
              title="Acceso Panel Administrador"
              className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <Lock className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-zinc-500">
          <Link href="/" className="hover:text-white transition-colors">
            Inicio
          </Link>
          <span>/</span>
          <Link href="/#builds" className="hover:text-white transition-colors">
            Builds Armadas
          </Link>
          <span>/</span>
          <span className="text-zinc-200 font-semibold">{build.name}</span>
        </nav>

        {/* Main 2-column Hero: Gallery + Purchase Panel */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Interactive Incremental Photo Gallery */}
          <div className="lg:col-span-7 space-y-3">
            <div className="relative aspect-[16/11] rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950">
              {currentPhoto ? (
                <img
                  src={currentPhoto}
                  alt={`${build.name} - Foto ${activePhotoIdx + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700">
                  <Monitor className="w-16 h-16" />
                </div>
              )}

              {allPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhotoIdx(
                        (prev) =>
                          (prev - 1 + allPhotos.length) % allPhotos.length
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/70 hover:bg-red-600 text-white border border-zinc-700 transition-colors"
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhotoIdx((prev) => (prev + 1) % allPhotos.length)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/70 hover:bg-red-600 text-white border border-zinc-700 transition-colors"
                    aria-label="Siguiente foto"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/75 border border-zinc-700 text-[11px] font-mono text-zinc-200">
                    {activePhotoIdx + 1} / {allPhotos.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail Strip */}
            {allPhotos.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                {allPhotos.map((url, idx) => (
                  <button
                    key={`${url}-${idx}`}
                    type="button"
                    onClick={() => setActivePhotoIdx(idx)}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all bg-zinc-900 ${
                      idx === activePhotoIdx
                        ? 'border-red-500 ring-2 ring-red-500/30'
                        : 'border-zinc-800 opacity-70 hover:opacity-100 hover:border-zinc-600'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`${build.name} miniatura ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Summary & Purchase Box */}
          <div className="lg:col-span-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${tierMeta.badgeClass}`}
                >
                  {tierMeta.label}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-900 text-zinc-200 border border-zinc-700">
                  {build.target_resolution}
                </span>
                {isOutOfStock ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-zinc-900 text-zinc-400 border border-zinc-700">
                    Agotado
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-emerald-950/90 text-emerald-300 border border-emerald-500/40">
                    Disponible ({available})
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {build.name}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                {build.short_description}
              </p>
            </div>

            {/* Key Hardware Highlights */}
            <div className="grid grid-cols-1 gap-2 pt-3 border-t border-zinc-800/80 text-xs">
              <div className="flex items-center gap-2.5 text-zinc-200">
                <Cpu className="w-4 h-4 text-red-500 shrink-0" />
                <span>{build.specs.cpu}</span>
              </div>
              <div className="flex items-center gap-2.5 text-white font-bold">
                <Gauge className="w-4 h-4 text-red-500 shrink-0" />
                <span>{build.specs.gpu}</span>
              </div>
              <div className="flex items-center gap-2.5 text-zinc-300">
                <MemoryStick className="w-4 h-4 text-zinc-500 shrink-0" />
                <span>{build.specs.ram}</span>
              </div>
              <div className="flex items-center gap-2.5 text-zinc-300">
                <HardDrive className="w-4 h-4 text-zinc-500 shrink-0" />
                <span>{build.specs.storage}</span>
              </div>
            </div>

            {/* Price Box */}
            <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-4 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Precio Fijo (Transferencia)
              </span>
              <div className="text-3xl sm:text-4xl font-black text-white">
                {formatClp(build.price_clp)}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <button
                type="button"
                disabled={isOutOfStock}
                onClick={() => {
                  setConfirmedOrder(null);
                  setQty(1);
                  setIsCheckoutOpen(true);
                }}
                className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-sm font-bold shadow-lg shadow-red-600/20 transition-colors inline-flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                {isOutOfStock ? 'Sin Stock Disponible' : 'Reservar esta Build'}
              </button>

              <a
                href={buildBuyerInquiryWhatsAppUrl(snapshot.settings, build)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-bold transition-colors inline-flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4 text-red-500" />
                Consultar por WhatsApp
              </a>
            </div>

            {/* Warranty & Delivery Pills */}
            <div className="space-y-2 pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-400">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{build.warranty_text}</span>
              </div>
              <div className="flex items-start gap-2">
                <Truck className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{snapshot.settings.pickup_instructions}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Complete Fixed Specifications */}
        <section className="space-y-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-red-500">
              Hardware Incluido
            </p>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
              Especificaciones Completas
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              ['Procesador (CPU)', build.specs.cpu],
              ['Tarjeta de Video (GPU)', build.specs.gpu],
              ['Placa Madre', build.specs.motherboard],
              ['Memoria RAM', build.specs.ram],
              ['Almacenamiento', build.specs.storage],
              ['Fuente de Poder (PSU)', build.specs.psu],
              ['Gabinete', build.specs.case_name],
              ['Refrigeración', build.specs.cooling],
              ...(build.specs.os
                ? [['Sistema Operativo', build.specs.os]]
                : []),
            ].map(([label, val]) => (
              <div
                key={label}
                className="rounded-xl bg-zinc-950 border border-zinc-800 p-4"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {label}
                </div>
                <div className="text-xs sm:text-sm font-bold text-zinc-100 mt-1">
                  {val || '—'}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FPS Benchmarks */}
        {build.fps_benchmarks && build.fps_benchmarks.length > 0 && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-red-500 inline-flex items-center gap-1.5">
                  <Gamepad2 className="w-3.5 h-3.5" /> Desempeño en Juegos
                </p>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                  Rendimiento Referencial (FPS)
                </h2>
              </div>
              <p className="text-[11px] text-zinc-500">
                Valores promedio aproximados según resolución y calidad gráfica
                indicada.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {build.fps_benchmarks.map((bm, idx) => {
                const parsedNum =
                  bm.fps_avg ??
                  (parseInt((bm.fps || '').replace(/[^0-9]/g, ''), 10) || 0);
                const barPct = Math.min(
                  100,
                  Math.max(12, Math.round((parsedNum / 240) * 100))
                );
                const tierTag =
                  parsedNum >= 240
                    ? 'Esports 240Hz+'
                    : parsedNum >= 144
                    ? 'Competitivo 144Hz+'
                    : parsedNum >= 60
                    ? 'Fluido 60+ FPS'
                    : 'Jugable';

                return (
                  <div
                    key={`${bm.game}-${idx}`}
                    className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-black text-white leading-tight">
                          {bm.game}
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 whitespace-nowrap">
                          {bm.resolution}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-red-400">
                          {bm.fps || (parsedNum ? `${parsedNum} FPS` : '—')}
                        </span>
                        {parsedNum > 0 && (
                          <span className="text-[10px] font-bold text-zinc-400">
                            {tierTag}
                          </span>
                        )}
                      </div>

                      {/* Fluency Bar */}
                      <div className="h-1.5 w-full rounded-full bg-zinc-900 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-red-700 to-red-500"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>

                      {bm.preset && (
                        <div className="text-[11px] text-zinc-400">
                          Calidad:{' '}
                          <strong className="text-zinc-200">{bm.preset}</strong>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-zinc-900 flex items-center justify-between gap-2 text-[10px]">
                      <span
                        className={
                          bm.source_type === 'WORKSHOP_TEST'
                            ? 'text-emerald-400 font-bold'
                            : 'text-zinc-500 font-semibold'
                        }
                      >
                        {bm.source_type === 'WORKSHOP_TEST'
                          ? 'Probado en taller CM GAMER'
                          : 'Referencia verificada'}
                      </span>

                      {bm.source_url && (
                        <a
                          href={bm.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 font-bold"
                        >
                          Ver prueba
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* High-Load Software & Productivity Workloads */}
        {build.workloads && build.workloads.length > 0 && (
          <section className="space-y-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-red-500 inline-flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" /> Trabajo, Estudios y
                Creación
              </p>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                Programas de Alta Carga Compatibles
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Además de gaming, esta configuración responde con solidez en
                software profesional de diseño, arquitectura, 3D y edición.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {build.workloads.map((wl, idx) => {
                const badgeClass =
                  wl.level === 'PROFESIONAL'
                    ? 'bg-red-600/20 text-red-300 border-red-500/40'
                    : wl.level === 'FLUIDO'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700';
                const levelLabel =
                  wl.level === 'PROFESIONAL'
                    ? 'Nivel Profesional'
                    : wl.level === 'FLUIDO'
                    ? 'Rendimiento Fluido'
                    : 'Uso Básico / Escolar';

                return (
                  <div
                    key={`${wl.app}-${idx}`}
                    className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-black text-white">
                        {wl.app}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border whitespace-nowrap ${badgeClass}`}
                      >
                        {levelLabel}
                      </span>
                    </div>
                    {wl.note && (
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {wl.note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Other Builds */}
        {otherBuilds.length > 0 && (
          <section className="space-y-4 pt-4 border-t border-zinc-800/80">
            <h2 className="text-lg sm:text-xl font-black text-white">
              Otras Builds Disponibles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {otherBuilds.map((ob) => (
                <Link
                  key={ob.id}
                  href={`/builds/${ob.slug}`}
                  className="group rounded-2xl border border-zinc-800 hover:border-red-600/60 bg-zinc-950 overflow-hidden transition-colors"
                >
                  <div className="h-40 bg-zinc-900 overflow-hidden">
                    {ob.image_url ? (
                      <img
                        src={ob.image_url}
                        alt={ob.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700">
                        <Monitor className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-1">
                    <div className="text-sm font-black text-white group-hover:text-red-400 transition-colors">
                      {ob.name}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate">
                      {ob.specs.gpu}
                    </div>
                    <div className="text-base font-black text-white pt-1">
                      {formatClp(ob.price_clp)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <BrandLogo
            size="sm"
            showText
            subtitle="PCs Gamer Armados & Servicio Técnico"
          />
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span>WhatsApp: {snapshot.settings.whatsapp_number}</span>
            <span>·</span>
            <Link
              href="/admin"
              className="hover:text-zinc-300 transition-colors"
            >
              Panel Admin
            </Link>
          </div>
        </div>
      </footer>

      {/* Direct Checkout Drawer */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 h-full flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                {confirmedOrder ? 'Pedido Confirmado' : 'Reservar Build'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {confirmedOrder ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-5 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                      Solicitud Registrada
                    </p>
                    <div className="text-2xl font-black text-white font-mono">
                      {confirmedOrder.order_code}
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Tu unidad quedó reservada. Envíanos tu código por WhatsApp
                      para validar tu pedido y coordinar la transferencia.
                    </p>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-1.5 text-xs text-zinc-300">
                    <div className="font-bold uppercase tracking-wider text-red-400 text-[11px] mb-2">
                      Datos de Transferencia ({snapshot.settings.store_name})
                    </div>
                    <div>
                      <span className="text-zinc-500">Titular:</span>{' '}
                      {snapshot.settings.bank_details.holder_name}
                    </div>
                    <div>
                      <span className="text-zinc-500">RUT:</span>{' '}
                      {snapshot.settings.bank_details.rut}
                    </div>
                    <div>
                      <span className="text-zinc-500">Banco:</span>{' '}
                      {snapshot.settings.bank_details.bank_name} (
                      {snapshot.settings.bank_details.account_type})
                    </div>
                    <div>
                      <span className="text-zinc-500">Cuenta:</span>{' '}
                      {snapshot.settings.bank_details.account_number}
                    </div>
                    <div>
                      <span className="text-zinc-500">Correo:</span>{' '}
                      {snapshot.settings.bank_details.notification_email}
                    </div>
                    <div className="pt-2 border-t border-zinc-800 flex justify-between text-sm font-black text-white">
                      <span>Total a Transferir:</span>
                      <span className="text-red-400">
                        {formatClp(confirmedOrder.total_clp)}
                      </span>
                    </div>
                  </div>

                  <a
                    href={buildBuyerOrderWhatsAppUrl(
                      snapshot.settings,
                      confirmedOrder
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Enviar Pedido por WhatsApp
                  </a>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-black text-white truncate">
                        {build.name}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {formatClp(build.price_clp)} c/u
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        className="w-6 h-6 rounded bg-zinc-800 text-xs font-bold text-white"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-xs font-bold">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setQty((q) => Math.min(available, q + 1))
                        }
                        className="w-6 h-6 rounded bg-zinc-800 text-xs font-bold text-white"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <form
                    id="build-checkout-form"
                    onSubmit={handleSubmitOrder}
                    className="space-y-3 text-xs"
                  >
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        Nombre completo *
                      </label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        WhatsApp *
                      </label>
                      <input
                        type="tel"
                        required
                        value={customerContact}
                        onChange={(e) => setCustomerContact(e.target.value)}
                        placeholder="+56 9 1234 5678"
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        Correo electrónico (opcional)
                      </label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        Modalidad de Entrega
                      </label>
                      <select
                        value={deliveryMethod}
                        onChange={(e) =>
                          setDeliveryMethod(e.target.value as DeliveryMethod)
                        }
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                      >
                        {Object.entries(DELIVERY_METHOD_LABELS).map(
                          ([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                              {k === 'FLAT_RATE_SHIPPING'
                                ? ` (${formatClp(
                                    snapshot.settings.flat_shipping_cost_clp
                                  )})`
                                : ''}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    {deliveryMethod !== 'STORE_PICKUP' && (
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Dirección / Comuna *
                        </label>
                        <input
                          type="text"
                          required
                          value={shippingAddress}
                          onChange={(e) => setShippingAddress(e.target.value)}
                          className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        Medio de Pago
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) =>
                          setPaymentMethod(e.target.value as PaymentMethod)
                        }
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                      >
                        {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        Notas (opcional)
                      </label>
                      <textarea
                        rows={2}
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                      />
                    </div>
                  </form>
                </>
              )}
            </div>

            {!confirmedOrder && (
              <div className="p-5 border-t border-zinc-800 space-y-3">
                <div className="flex justify-between text-base font-black text-white">
                  <span>Total</span>
                  <span className="text-red-400">{formatClp(total)}</span>
                </div>
                <button
                  type="submit"
                  form="build-checkout-form"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold"
                >
                  {isSubmitting
                    ? 'Generando Reserva...'
                    : 'Confirmar Reserva y Ver Datos'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
