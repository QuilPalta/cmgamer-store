'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BuildTier,
  CartEntry,
  DeliveryMethod,
  OrderRecord,
  PaymentMethod,
  PcBuild,
  StoreSnapshot,
  TechService,
} from '@/types/store';
import {
  BUILD_TIER_META,
  buildBuyerInquiryWhatsAppUrl,
  buildBuyerOrderWhatsAppUrl,
  buildServiceWhatsAppUrl,
  cleanWhatsAppPhone,
  DELIVERY_METHOD_LABELS,
  formatClp,
  PAYMENT_METHOD_LABELS,
  SERVICE_CATEGORY_META,
} from '@/lib/formatters';
import {
  createOrderWithReservation,
  loadStoreSnapshot,
} from '@/lib/storeRepository';
import { triggerOrderEmailNotification } from '@/lib/emailService';
import { BrandLogo } from './BrandLogo';
import { useToast } from './ToastProvider';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Gauge,
  HardDrive,
  Lock,
  MemoryStick,
  MessageCircle,
  Monitor,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Truck,
  Wrench,
  X,
  Zap,
} from 'lucide-react';

export function PublicStorefrontView() {
  const { showToast } = useToast();
  const [snapshot, setSnapshot] = useState<StoreSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<BuildTier | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'FEATURED' | 'PRICE_ASC' | 'PRICE_DESC'>(
    'FEATURED'
  );

  // Banner carousel
  const [bannerIdx, setBannerIdx] = useState(0);

  // Detail modal
  const [selectedBuild, setSelectedBuild] = useState<PcBuild | null>(null);

  // Cart & Checkout
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>('STORE_PICKUP');
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('BANK_TRANSFER');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(null);

  async function refresh() {
    const data = await loadStoreSnapshot();
    setSnapshot(data);
    setIsLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const activeBanners = useMemo(() => {
    if (!snapshot) return [];
    const list = snapshot.settings.banners.filter((b) => b.is_active);
    return list.length > 0 ? list : snapshot.settings.banners;
  }, [snapshot]);

  const activeBuilds = useMemo(() => {
    if (!snapshot) return [];
    const q = search.trim().toLowerCase();
    const filtered = snapshot.builds
      .filter((b) => b.is_active)
      .filter((b) => (tierFilter === 'ALL' ? true : b.tier === tierFilter))
      .filter((b) => {
        if (!q) return true;
        return (
          b.name.toLowerCase().includes(q) ||
          b.specs.cpu.toLowerCase().includes(q) ||
          b.specs.gpu.toLowerCase().includes(q) ||
          b.specs.ram.toLowerCase().includes(q) ||
          b.short_description.toLowerCase().includes(q)
        );
      });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'PRICE_ASC') return a.price_clp - b.price_clp;
      if (sortBy === 'PRICE_DESC') return b.price_clp - a.price_clp;
      if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
      return a.price_clp - b.price_clp;
    });
  }, [snapshot, search, tierFilter, sortBy]);

  const activeServices = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.services
      .filter((s) => s.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [snapshot]);

  const cartCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const cartSubtotal = useMemo(
    () =>
      cart.reduce((acc, item) => acc + item.quantity * item.unit_price_clp, 0),
    [cart]
  );

  const shippingCost = useMemo(() => {
    if (!snapshot) return 0;
    if (deliveryMethod === 'FLAT_RATE_SHIPPING') {
      return snapshot.settings.flat_shipping_cost_clp;
    }
    return 0;
  }, [snapshot, deliveryMethod]);

  const cartTotal = cartSubtotal + shippingCost;

  function addBuildToCart(build: PcBuild) {
    const available = Math.max(0, build.stock_quantity - build.reserved_quantity);
    if (available <= 0) {
      showToast('Esta build se encuentra agotada actualmente.', {
        type: 'warning',
      });
      return;
    }
    const key = `BUILD:${build.id}`;
    setCart((prev) => {
      const existing = prev.find((x) => x.key === key);
      if (existing) {
        if (existing.quantity >= available) {
          showToast(`Solo hay ${available} unidad(es) disponible(s) de ${build.name}.`, {
            type: 'warning',
          });
          return prev;
        }
        return prev.map((x) =>
          x.key === key ? { ...x, quantity: x.quantity + 1 } : x
        );
      }
      return [
        ...prev,
        {
          key,
          item_type: 'BUILD',
          build_id: build.id,
          name: build.name,
          summary: `${build.specs.cpu} · ${build.specs.gpu}`,
          unit_price_clp: build.price_clp,
          quantity: 1,
          max_quantity: available,
          image_url: build.image_url,
        },
      ];
    });
    setConfirmedOrder(null);
    setIsCartOpen(true);
    showToast(`${build.name} agregada al pedido`, { type: 'success' });
  }

  function addServiceToCart(service: TechService) {
    if (service.price_clp === null) {
      if (snapshot) {
        window.open(buildServiceWhatsAppUrl(snapshot.settings, service), '_blank');
      }
      return;
    }
    const key = `SERVICE:${service.id}`;
    setCart((prev) => {
      const existing = prev.find((x) => x.key === key);
      if (existing) {
        return prev.map((x) =>
          x.key === key ? { ...x, quantity: x.quantity + 1 } : x
        );
      }
      return [
        ...prev,
        {
          key,
          item_type: 'SERVICE',
          service_id: service.id,
          name: service.name,
          summary: `Servicio técnico · ${service.estimated_time}`,
          unit_price_clp: service.price_clp ?? 0,
          quantity: 1,
        },
      ];
    });
    setConfirmedOrder(null);
    setIsCartOpen(true);
    showToast(`${service.name} agregado al pedido`, { type: 'success' });
  }

  function updateCartQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.key !== key) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          if (item.max_quantity && nextQty > item.max_quantity) {
            return { ...item, quantity: item.max_quantity };
          }
          return { ...item, quantity: nextQty };
        })
        .filter((x): x is CartEntry => x !== null)
    );
  }

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!snapshot || cart.length === 0) return;

    if (
      deliveryMethod !== 'STORE_PICKUP' &&
      !shippingAddress.trim()
    ) {
      showToast('Ingresa tu dirección y comuna para coordinar el envío.', {
        type: 'warning',
      });
      return;
    }

    setIsSubmittingOrder(true);
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
        items: cart.map((c) => ({
          item_type: c.item_type,
          build_id: c.build_id || null,
          service_id: c.service_id || null,
          item_name: c.name,
          item_summary: c.summary,
          quantity: c.quantity,
          unit_price_clp: c.unit_price_clp,
        })),
      });

      // Fire-and-forget SMTP email notification if configured & email provided
      if (order.customer_email) {
        triggerOrderEmailNotification({
          event: 'ORDER_RECEIVED',
          order,
          settings: snapshot.settings,
        }).catch(() => {});
      }

      setConfirmedOrder(order);
      setCart([]);
      setOrderNotes('');
      await refresh();
      showToast(`Pedido ${order.order_code} generado con éxito`, {
        description: 'Envía tu código por WhatsApp para confirmar y coordinar.',
        type: 'success',
      });
    } catch (err) {
      showToast('No se pudo generar el pedido', {
        description:
          err instanceof Error ? err.message : 'Intenta nuevamente.',
        type: 'error',
      });
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  if (isLoading || !snapshot) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4">
        <BrandLogo size="lg" />
        <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400 animate-pulse">
          Cargando catálogo CM GAMER...
        </p>
      </div>
    );
  }

  const currentBanner =
    activeBanners[bannerIdx % Math.max(1, activeBanners.length)];
  const whatsappDirectUrl = `https://wa.me/${cleanWhatsAppPhone(
    snapshot.settings.whatsapp_number
  )}`;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* Top Announcement Bar */}
      <div className="bg-red-600 text-white text-[11px] sm:text-xs font-bold tracking-wide text-center py-2 px-4">
        {snapshot.settings.hero_announcement}
      </div>

      {/* Sticky Navbar */}
      <header className="sticky top-0 z-40 bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-800/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a href="#top" className="hover:opacity-95 transition-opacity">
            <BrandLogo
              size="md"
              showText
              subtitle="PC Builds & Servicio Técnico"
            />
          </a>

          <nav className="hidden md:flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-zinc-300">
            <a
              href="#builds"
              className="hover:text-red-400 transition-colors"
            >
              Builds Armadas
            </a>
            <a
              href="#servicios"
              className="hover:text-red-400 transition-colors"
            >
              Servicios Técnicos
            </a>
            <a
              href="#garantia"
              className="hover:text-red-400 transition-colors"
            >
              Garantía y Envíos
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <a
              href={whatsappDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-100 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5 text-red-500" />
              WhatsApp
            </a>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">Pedido</span>
              {cartCount > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-white text-red-600 text-[11px] font-black flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

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

      {/* Hero Section */}
      {currentBanner && (
        <section id="top" className="relative overflow-hidden border-b border-zinc-800/80">
          <div
            className={`absolute inset-0 pointer-events-none ${
              currentBanner.accent_style === 'RED_DARK'
                ? 'bg-[radial-gradient(ellipse_at_top_right,_rgba(220,38,38,0.22),_transparent_60%)]'
                : 'bg-[radial-gradient(ellipse_at_top_left,_rgba(161,161,170,0.16),_transparent_60%)]'
            }`}
          />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 relative">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-5">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/15 border border-red-500/35 text-red-400 text-[11px] font-extrabold tracking-widest uppercase">
                  <Zap className="w-3.5 h-3.5" />
                  {currentBanner.badge_text}
                </span>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-[1.08]">
                  {currentBanner.title}
                </h1>
                <p className="text-sm sm:text-base text-zinc-400 max-w-2xl leading-relaxed">
                  {currentBanner.subtitle}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <a
                    href={
                      currentBanner.target_section === 'SERVICES'
                        ? '#servicios'
                        : '#builds'
                    }
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-600/25 transition-colors"
                  >
                    {currentBanner.cta_text}
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  <a
                    href={whatsappDirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-bold transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 text-red-500" />
                    Hablar por WhatsApp
                  </a>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col items-center lg:items-end justify-center gap-4">
                <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-full overflow-hidden ring-4 ring-red-600/60 shadow-[0_0_50px_rgba(220,38,38,0.25)] bg-zinc-950">
                  <img
                    src="/cmgamer-logo.jpg"
                    alt="CM GAMER"
                    className="w-full h-full object-cover scale-[1.18]"
                  />
                </div>
                {activeBanners.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setBannerIdx(
                          (prev) =>
                            (prev - 1 + activeBanners.length) %
                            activeBanners.length
                        )
                      }
                      className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300"
                      aria-label="Banner anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono text-zinc-500">
                      {(bannerIdx % activeBanners.length) + 1} /{' '}
                      {activeBanners.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setBannerIdx((prev) => (prev + 1) % activeBanners.length)
                      }
                      className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300"
                      aria-label="Siguiente banner"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {/* BUILDS CATALOG */}
        <section id="builds" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-red-500">
                Catálogo Oficial
              </p>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                Builds Gamer Armadas
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Equipos listos con configuración balanceada, probados y garantizados.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 sm:flex-none sm:w-56">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar RTX, Ryzen, build..."
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as 'FEATURED' | 'PRICE_ASC' | 'PRICE_DESC'
                  )
                }
                className="rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-red-500"
              >
                <option value="FEATURED">Orden: Destacadas</option>
                <option value="PRICE_ASC">Precio: Menor a Mayor</option>
                <option value="PRICE_DESC">Precio: Mayor a Menor</option>
              </select>
            </div>
          </div>

          {/* Tier Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {(['ALL', 'ENTRADA', 'MEDIA', 'ALTA', 'ENTUSIASTA'] as const).map(
              (tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setTierFilter(tier)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    tierFilter === tier
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                  }`}
                >
                  {tier === 'ALL' ? 'Todas las Gamas' : BUILD_TIER_META[tier].label}
                </button>
              )
            )}
          </div>

          {/* Builds Grid */}
          {activeBuilds.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-12 text-center space-y-2">
              <p className="text-sm font-bold text-white">
                No encontramos builds con esos filtros.
              </p>
              <p className="text-xs text-zinc-400">
                Prueba limpiar la búsqueda o seleccionar otra gama.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {activeBuilds.map((build) => {
                const available = Math.max(
                  0,
                  build.stock_quantity - build.reserved_quantity
                );
                const isOutOfStock = available <= 0;
                const tierMeta = BUILD_TIER_META[build.tier];

                return (
                  <article
                    key={build.id}
                    className="group rounded-2xl border border-zinc-800 hover:border-red-600/60 bg-zinc-950 overflow-hidden flex flex-col transition-all duration-200 shadow-lg hover:shadow-red-950/20"
                  >
                    {/* Image Header */}
                    <div className="relative h-56 bg-zinc-900 overflow-hidden">
                      {build.image_url ? (
                        <img
                          src={build.image_url}
                          alt={build.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700">
                          <Monitor className="w-12 h-12" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />

                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${tierMeta.badgeClass}`}
                        >
                          {tierMeta.label}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/75 text-zinc-200 border border-zinc-700">
                          {build.target_resolution}
                        </span>
                      </div>

                      <div className="absolute top-3 right-3">
                        {isOutOfStock ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-zinc-900/90 text-zinc-400 border border-zinc-700">
                            Agotado
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-950/90 text-emerald-300 border border-emerald-500/40">
                            Disponible ({available})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-lg font-black text-white tracking-tight">
                            {build.name}
                          </h3>
                          <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                            {build.short_description}
                          </p>
                        </div>

                        {/* Key Specs */}
                        <div className="space-y-1.5 pt-2 border-t border-zinc-800/80 text-xs">
                          <div className="flex items-center gap-2 text-zinc-300">
                            <Cpu className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <span className="truncate">{build.specs.cpu}</span>
                          </div>
                          <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                            <Gauge className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <span className="truncate">{build.specs.gpu}</span>
                          </div>
                          <div className="flex items-center gap-2 text-zinc-400">
                            <MemoryStick className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span className="truncate">{build.specs.ram}</span>
                          </div>
                          <div className="flex items-center gap-2 text-zinc-400">
                            <HardDrive className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span className="truncate">
                              {build.specs.storage}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Price & CTAs */}
                      <div className="pt-4 border-t border-zinc-800/80 space-y-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                            Precio Transferencia
                          </span>
                          <span className="text-2xl font-black text-white">
                            {formatClp(build.price_clp)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedBuild(build)}
                            className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-100 transition-colors"
                          >
                            Ver Ficha
                          </button>
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => addBuildToCart(build)}
                            className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-xs font-bold text-white transition-colors inline-flex items-center justify-center gap-1.5"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            {isOutOfStock ? 'Agotado' : 'Reservar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* TECHNICAL SERVICES SECTION */}
        <section
          id="servicios"
          className="border-t border-zinc-800/80 bg-zinc-950/60"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-red-500 inline-flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" /> Taller CM GAMER
                </p>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                  Mantención y Servicio Técnico
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
                  Cuida tu inversión con limpieza profesional, cambio de pasta
                  térmica, optimización de sistema o armado con tus propias
                  piezas.
                </p>
              </div>
              <a
                href={whatsappDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-white transition-colors self-start"
              >
                <MessageCircle className="w-4 h-4 text-red-500" />
                Consultar Servicio por WhatsApp
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeServices.map((service) => {
                const catMeta = SERVICE_CATEGORY_META[service.category];
                return (
                  <div
                    key={service.id}
                    className="rounded-2xl border border-zinc-800 bg-[#09090b] p-5 flex flex-col justify-between gap-4 hover:border-zinc-700 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${catMeta.badgeClass}`}
                        >
                          {catMeta.label}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          {service.estimated_time}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-white">
                        {service.name}
                      </h3>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {service.description}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-zinc-800/80 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] font-bold uppercase text-zinc-500">
                          Valor
                        </span>
                        <span className="text-xl font-black text-white">
                          {service.price_clp !== null
                            ? formatClp(service.price_clp)
                            : service.price_label || 'A cotizar'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={buildServiceWhatsAppUrl(
                            snapshot.settings,
                            service
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-100 transition-colors inline-flex items-center justify-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-red-500" />
                          WhatsApp
                        </a>
                        <button
                          type="button"
                          onClick={() => addServiceToCart(service)}
                          className="py-2 px-3 rounded-xl bg-red-600/15 hover:bg-red-600 border border-red-500/40 text-xs font-bold text-red-300 hover:text-white transition-colors inline-flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Solicitar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* TRUST, WARRANTY & SHIPPING */}
        <section id="garantia" className="border-t border-zinc-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-2.5">
                <ShieldCheck className="w-7 h-7 text-red-500" />
                <h3 className="text-sm font-extrabold text-white">
                  Garantía Directa y Pruebas Reales
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Cada build se entrega con sistema operativo instalado, drivers
                  al día y test de estrés de CPU/GPU para validar temperaturas y
                  estabilidad.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-2.5">
                <Package className="w-7 h-7 text-red-500" />
                <h3 className="text-sm font-extrabold text-white">
                  Pago Seguro vía Transferencia
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Reservas directo en la web con código de pedido. Verificamos
                  stock, te enviamos los datos bancarios por WhatsApp y
                  coordinamos tu entrega.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-2.5">
                <Truck className="w-7 h-7 text-red-500" />
                <h3 className="text-sm font-extrabold text-white">
                  Retiro Presencial o Envío Protegido
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {snapshot.settings.pickup_instructions}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950">
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

      {/* BUILD DETAIL MODAL (Fixed Specs Only — No Customization Mention) */}
      {selectedBuild && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                    BUILD_TIER_META[selectedBuild.tier].badgeClass
                  }`}
                >
                  {BUILD_TIER_META[selectedBuild.tier].label}
                </span>
                <h3 className="text-lg font-black text-white">
                  {selectedBuild.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBuild(null)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 h-60 md:h-auto">
                  {selectedBuild.image_url ? (
                    <img
                      src={selectedBuild.image_url}
                      alt={selectedBuild.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                      <Monitor className="w-12 h-12" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {selectedBuild.short_description}
                    </p>
                    <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-4 space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        Precio Fijo (Transferencia)
                      </span>
                      <div className="text-3xl font-black text-white">
                        {formatClp(selectedBuild.price_clp)}
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        {selectedBuild.warranty_text}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={
                        selectedBuild.stock_quantity -
                          selectedBuild.reserved_quantity <=
                        0
                      }
                      onClick={() => {
                        addBuildToCart(selectedBuild);
                        setSelectedBuild(null);
                      }}
                      className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-sm font-bold transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {selectedBuild.stock_quantity -
                        selectedBuild.reserved_quantity <=
                      0
                        ? 'Sin Stock Disponible'
                        : 'Reservar esta Build'}
                    </button>
                    <a
                      href={buildBuyerInquiryWhatsAppUrl(
                        snapshot.settings,
                        selectedBuild
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4 text-red-500" />
                      Consultar por WhatsApp
                    </a>
                  </div>
                </div>
              </div>

              {/* Complete Specs Table */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-red-400">
                  Especificaciones Completas
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    ['Procesador (CPU)', selectedBuild.specs.cpu],
                    ['Tarjeta de Video (GPU)', selectedBuild.specs.gpu],
                    ['Placa Madre', selectedBuild.specs.motherboard],
                    ['Memoria RAM', selectedBuild.specs.ram],
                    ['Almacenamiento', selectedBuild.specs.storage],
                    ['Fuente de Poder', selectedBuild.specs.psu],
                    ['Gabinete', selectedBuild.specs.case_name],
                    ['Refrigeración', selectedBuild.specs.cooling],
                    ...(selectedBuild.specs.os
                      ? [['Sistema Operativo', selectedBuild.specs.os]]
                      : []),
                  ].map(([label, val]) => (
                    <div
                      key={label}
                      className="rounded-xl bg-zinc-900/70 border border-zinc-800/90 px-3.5 py-2.5"
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        {label}
                      </div>
                      <div className="text-xs font-semibold text-zinc-100 mt-0.5">
                        {val || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FPS Benchmarks */}
              {selectedBuild.fps_benchmarks &&
                selectedBuild.fps_benchmarks.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-red-400">
                      Rendimiento Referencial Estimado
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {selectedBuild.fps_benchmarks.map((bm, idx) => (
                        <div
                          key={`${bm.game}-${idx}`}
                          className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-center"
                        >
                          <div className="text-[11px] font-bold text-zinc-300 truncate">
                            {bm.game}
                          </div>
                          <div className="text-base font-black text-red-400 mt-1">
                            {bm.fps}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            {bm.resolution}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* CART & CHECKOUT DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 h-full flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  {confirmedOrder ? 'Pedido Confirmado' : 'Tu Pedido'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
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
                      Tu stock quedó reservado. Envíanos tu código por WhatsApp
                      para validar tu pedido y coordinar la transferencia y
                      entrega.
                    </p>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-2 text-xs">
                    <div className="font-bold uppercase tracking-wider text-red-400 text-[11px]">
                      Datos de Transferencia ({snapshot.settings.store_name})
                    </div>
                    <div className="text-zinc-300 space-y-1">
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
                  </div>

                  <a
                    href={buildBuyerOrderWhatsAppUrl(
                      snapshot.settings,
                      confirmedOrder
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Enviar Pedido por WhatsApp
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedOrder(null);
                      setIsCartOpen(false);
                    }}
                    className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200"
                  >
                    Seguir Explorando
                  </button>
                </div>
              ) : cart.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <ShoppingCart className="w-10 h-10 text-zinc-700 mx-auto" />
                  <p className="text-sm font-bold text-zinc-300">
                    Tu pedido está vacío
                  </p>
                  <p className="text-xs text-zinc-500">
                    Agrega una build armada o un servicio técnico para generar
                    tu reserva.
                  </p>
                </div>
              ) : (
                <>
                  {/* Items */}
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div
                        key={item.key}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase text-red-400">
                            {item.item_type === 'BUILD'
                              ? 'Build Armada'
                              : 'Servicio Técnico'}
                          </span>
                          <p className="text-xs font-bold text-white truncate">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-zinc-400 truncate">
                            {item.summary}
                          </p>
                          <p className="text-xs font-black text-zinc-100 mt-1">
                            {formatClp(item.unit_price_clp * item.quantity)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.key, -1)}
                            className="w-6 h-6 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold w-5 text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.key, 1)}
                            className="w-6 h-6 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.key, -item.quantity)}
                            className="p-1 text-zinc-500 hover:text-red-400 ml-1"
                            aria-label="Eliminar ítem"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Checkout Form */}
                  <form
                    id="checkout-form"
                    onSubmit={handleSubmitOrder}
                    className="space-y-3.5 pt-3 border-t border-zinc-800"
                  >
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-300">
                      Tus Datos de Contacto
                    </h4>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        Nombre completo *
                      </label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ej: Matías González"
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
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
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        Correo electrónico (opcional para notificaciones)
                      </label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="tu@correo.cl"
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
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
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                      >
                        {Object.entries(DELIVERY_METHOD_LABELS).map(
                          ([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                              {key === 'FLAT_RATE_SHIPPING'
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
                          Dirección / Comuna / Agencia *
                        </label>
                        <input
                          type="text"
                          required
                          value={shippingAddress}
                          onChange={(e) => setShippingAddress(e.target.value)}
                          placeholder="Calle, número, comuna y región"
                          className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
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
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                      >
                        {Object.entries(PAYMENT_METHOD_LABELS).map(
                          ([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        Notas adicionales (opcional)
                      </label>
                      <textarea
                        rows={2}
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="Horario preferido de retiro o comentarios..."
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </form>
                </>
              )}
            </div>

            {!confirmedOrder && cart.length > 0 && (
              <div className="p-5 border-t border-zinc-800 bg-zinc-950 space-y-3">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Subtotal</span>
                    <span>{formatClp(cartSubtotal)}</span>
                  </div>
                  {shippingCost > 0 && (
                    <div className="flex justify-between text-zinc-400">
                      <span>Envío</span>
                      <span>{formatClp(shippingCost)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black text-white pt-1 border-t border-zinc-800">
                    <span>Total</span>
                    <span className="text-red-400">{formatClp(cartTotal)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  form="checkout-form"
                  disabled={isSubmittingOrder}
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-red-600/20 transition-colors"
                >
                  {isSubmittingOrder
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
