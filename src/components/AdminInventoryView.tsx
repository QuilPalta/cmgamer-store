'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BenchmarkSourceType,
  BuildTier,
  ComponentCategory,
  ComponentCondition,
  ComponentInventoryItem,
  FpsBenchmark,
  PcBuild,
  ServiceCategory,
  TechService,
  WorkloadCapability,
  WorkloadLevel,
} from '@/types/store';
import {
  BUILD_TIER_META,
  COMPONENT_CATEGORY_META,
  COMPONENT_CONDITION_META,
  formatClp,
  SERVICE_CATEGORY_META,
} from '@/lib/formatters';
import { useToast } from './ToastProvider';
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Cpu,
  Edit3,
  ExternalLink,
  ImagePlus,
  Monitor,
  Plus,
  Save,
  Star,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';

async function compressImageFileToDataUrl(
  file: File,
  maxWidth = 1280,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagen inválida.'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface AdminInventoryViewProps {
  builds: PcBuild[];
  components: ComponentInventoryItem[];
  services: TechService[];
  onSaveBuild: (
    input: Omit<PcBuild, 'id' | 'slug' | 'reserved_quantity'> & {
      id?: string;
      slug?: string;
      reserved_quantity?: number;
    }
  ) => Promise<void>;
  onDeleteBuild: (id: string) => Promise<void>;
  onSaveComponent: (
    input: Omit<ComponentInventoryItem, 'id'> & { id?: string }
  ) => Promise<void>;
  onDeleteComponent: (id: string) => Promise<void>;
  onSaveService: (
    input: Omit<TechService, 'id'> & { id?: string }
  ) => Promise<void>;
  onDeleteService: (id: string) => Promise<void>;
}

type InventorySubTab = 'BUILDS' | 'COMPONENTS' | 'SERVICES';

const EMPTY_BUILD_FORM = {
  id: undefined as string | undefined,
  slug: undefined as string | undefined,
  reserved_quantity: 0,
  name: '',
  tier: 'MEDIA' as BuildTier,
  target_resolution: '1080p Ultra',
  price_clp: 699990,
  stock_quantity: 1,
  image_url: '',
  gallery_urls: [] as string[],
  short_description: '',
  specs: {
    cpu: '',
    gpu: '',
    motherboard: '',
    ram: '',
    storage: '',
    psu: '',
    case_name: '',
    cooling: '',
    os: 'Windows 11 Pro + Drivers actualizados',
  },
  fps_benchmarks: [] as FpsBenchmark[],
  workloads: [] as WorkloadCapability[],
  warranty_text: '6 meses de garantía directa CM GAMER en armado y componentes.',
  is_featured: false,
  is_active: true,
};

const EMPTY_COMP_FORM = {
  id: undefined as string | undefined,
  category: 'GPU' as ComponentCategory,
  brand: '',
  model: '',
  sku: '',
  condition: 'NEW' as ComponentCondition,
  quantity: 1,
  notes: '',
};

const EMPTY_SERVICE_FORM = {
  id: undefined as string | undefined,
  name: '',
  category: 'MANTENCION' as ServiceCategory,
  description: '',
  price_clp: 29990 as number | null,
  price_label: '$29.990',
  estimated_time: '24 hrs',
  is_active: true,
  sort_order: 1,
};

export function AdminInventoryView({
  builds,
  components,
  services,
  onSaveBuild,
  onDeleteBuild,
  onSaveComponent,
  onDeleteComponent,
  onSaveService,
  onDeleteService,
}: AdminInventoryViewProps) {
  const { showToast, confirmAction } = useToast();
  const [subTab, setSubTab] = useState<InventorySubTab>('BUILDS');

  // Build Modal
  const [isBuildModalOpen, setIsBuildModalOpen] = useState(false);
  const [buildForm, setBuildForm] = useState(EMPTY_BUILD_FORM);
  const [isSavingBuild, setIsSavingBuild] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);

  const buildPhotos = useMemo(() => {
    const list: string[] = [];
    if (buildForm.image_url?.trim()) list.push(buildForm.image_url.trim());
    for (const url of buildForm.gallery_urls || []) {
      const clean = url?.trim();
      if (clean && !list.includes(clean)) list.push(clean);
    }
    return list;
  }, [buildForm.image_url, buildForm.gallery_urls]);

  function setBuildPhotosList(nextPhotos: string[]) {
    const cleaned = nextPhotos.map((x) => x.trim()).filter(Boolean);
    setBuildForm((prev) => ({
      ...prev,
      image_url: cleaned[0] || '',
      gallery_urls: cleaned.slice(1),
    }));
  }

  function handleAddPhotoByUrl() {
    const url = newPhotoUrl.trim();
    if (!url) return;
    if (buildPhotos.includes(url)) {
      showToast('Esa foto ya está agregada a la galería.', { type: 'info' });
      return;
    }
    setBuildPhotosList([...buildPhotos, url]);
    setNewPhotoUrl('');
  }

  async function handleUploadPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsProcessingPhotos(true);
    try {
      const encoded: string[] = [];
      for (const file of files) {
        const dataUrl = await compressImageFileToDataUrl(file);
        encoded.push(dataUrl);
      }
      setBuildPhotosList([...buildPhotos, ...encoded]);
      showToast(
        `${encoded.length} foto(s) agregada(s) a la galería`,
        { type: 'success' }
      );
    } catch (err) {
      showToast('Error al procesar imagen', {
        description: err instanceof Error ? err.message : '',
        type: 'error',
      });
    } finally {
      setIsProcessingPhotos(false);
      e.target.value = '';
    }
  }

  function handleSetCoverPhoto(idx: number) {
    if (idx <= 0 || idx >= buildPhotos.length) return;
    const copy = [...buildPhotos];
    const [picked] = copy.splice(idx, 1);
    copy.unshift(picked);
    setBuildPhotosList(copy);
  }

  function handleMovePhoto(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= buildPhotos.length) return;
    const copy = [...buildPhotos];
    const tmp = copy[idx];
    copy[idx] = copy[target];
    copy[target] = tmp;
    setBuildPhotosList(copy);
  }

  function handleRemovePhoto(idx: number) {
    setBuildPhotosList(buildPhotos.filter((_, i) => i !== idx));
  }

  // Component Modal
  const [compCatFilter, setCompCatFilter] = useState<ComponentCategory | 'ALL'>(
    'ALL'
  );
  const [isCompModalOpen, setIsCompModalOpen] = useState(false);
  const [compForm, setCompForm] = useState(EMPTY_COMP_FORM);
  const [isSavingComp, setIsSavingComp] = useState(false);

  // Service Modal
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE_FORM);
  const [isSavingService, setIsSavingService] = useState(false);

  const filteredComponents = useMemo(() => {
    if (compCatFilter === 'ALL') return components;
    return components.filter((c) => c.category === compCatFilter);
  }, [components, compCatFilter]);

  function openEditBuild(b: PcBuild) {
    setBuildForm({
      id: b.id,
      slug: b.slug,
      reserved_quantity: b.reserved_quantity,
      name: b.name,
      tier: b.tier,
      target_resolution: b.target_resolution,
      price_clp: b.price_clp,
      stock_quantity: b.stock_quantity,
      image_url: b.image_url,
      gallery_urls: b.gallery_urls || [],
      short_description: b.short_description,
      specs: {
        cpu: b.specs.cpu || '',
        gpu: b.specs.gpu || '',
        motherboard: b.specs.motherboard || '',
        ram: b.specs.ram || '',
        storage: b.specs.storage || '',
        psu: b.specs.psu || '',
        case_name: b.specs.case_name || '',
        cooling: b.specs.cooling || '',
        os: b.specs.os || '',
      },
      fps_benchmarks: b.fps_benchmarks || [],
      workloads: b.workloads || [],
      warranty_text: b.warranty_text,
      is_featured: b.is_featured,
      is_active: b.is_active,
    });
    setIsBuildModalOpen(true);
  }

  async function handleSaveBuildSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingBuild(true);
    try {
      await onSaveBuild(buildForm);
      showToast(`Build "${buildForm.name}" guardada`, { type: 'success' });
      setIsBuildModalOpen(false);
    } catch (err) {
      showToast('Error al guardar build', {
        description: err instanceof Error ? err.message : '',
        type: 'error',
      });
    } finally {
      setIsSavingBuild(false);
    }
  }

  async function handleDeleteBuildClick(b: PcBuild) {
    const ok = await confirmAction({
      title: `¿Eliminar "${b.name}"?`,
      description:
        'Si tiene pedidos históricos asociados en Supabase, te recomendamos desactivarla en vez de eliminarla.',
      confirmLabel: 'Eliminar Build',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await onDeleteBuild(b.id);
      showToast('Build eliminada', { type: 'info' });
    } catch (err) {
      showToast('No se pudo eliminar', {
        description: err instanceof Error ? err.message : '',
        type: 'error',
      });
    }
  }

  async function handleQuickComponentQty(
    item: ComponentInventoryItem,
    delta: number
  ) {
    const nextQty = Math.max(0, item.quantity + delta);
    try {
      await onSaveComponent({ ...item, quantity: nextQty });
    } catch (err) {
      showToast('Error al actualizar stock', {
        description: err instanceof Error ? err.message : '',
        type: 'error',
      });
    }
  }

  async function handleSaveCompSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingComp(true);
    try {
      await onSaveComponent(compForm);
      showToast(`Componente "${compForm.model}" guardado`, { type: 'success' });
      setIsCompModalOpen(false);
    } catch (err) {
      showToast('Error al guardar componente', {
        description: err instanceof Error ? err.message : '',
        type: 'error',
      });
    } finally {
      setIsSavingComp(false);
    }
  }

  async function handleSaveServiceSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingService(true);
    try {
      await onSaveService({
        ...serviceForm,
        price_label:
          serviceForm.price_clp !== null
            ? formatClp(serviceForm.price_clp)
            : serviceForm.price_label || 'A cotizar',
      });
      showToast(`Servicio "${serviceForm.name}" guardado`, { type: 'success' });
      setIsServiceModalOpen(false);
    } catch (err) {
      showToast('Error al guardar servicio', {
        description: err instanceof Error ? err.message : '',
        type: 'error',
      });
    } finally {
      setIsSavingService(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-xl bg-zinc-950 border border-zinc-800 p-1 gap-1">
          <button
            type="button"
            onClick={() => setSubTab('BUILDS')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
              subTab === 'BUILDS'
                ? 'bg-red-600 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            Builds Publicadas ({builds.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('COMPONENTS')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
              subTab === 'COMPONENTS'
                ? 'bg-red-600 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            Bodega de Piezas ({components.reduce((a, c) => a + c.quantity, 0)})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('SERVICES')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
              subTab === 'SERVICES'
                ? 'bg-red-600 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Servicios Técnicos ({services.length})
          </button>
        </div>

        {subTab === 'BUILDS' && (
          <button
            type="button"
            onClick={() => {
              setBuildForm(EMPTY_BUILD_FORM);
              setIsBuildModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            Nueva Build
          </button>
        )}

        {subTab === 'COMPONENTS' && (
          <button
            type="button"
            onClick={() => {
              setCompForm(EMPTY_COMP_FORM);
              setIsCompModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            Agregar Pieza a Bodega
          </button>
        )}

        {subTab === 'SERVICES' && (
          <button
            type="button"
            onClick={() => {
              setServiceForm({
                ...EMPTY_SERVICE_FORM,
                sort_order: services.length + 1,
              });
              setIsServiceModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            Nuevo Servicio
          </button>
        )}
      </div>

      {/* TAB 1: BUILDS */}
      {subTab === 'BUILDS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {builds.map((b) => {
            const avail = Math.max(0, b.stock_quantity - b.reserved_quantity);
            return (
              <div
                key={b.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 flex gap-4"
              >
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0">
                  {b.image_url ? (
                    <img
                      src={b.image_url}
                      alt={b.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                      <Monitor className="w-7 h-7" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-white truncate">
                          {b.name}
                        </h3>
                        {!b.is_active && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400">
                            Oculta
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        {BUILD_TIER_META[b.tier].label} · {b.target_resolution}
                      </span>
                    </div>
                    <span className="text-base font-black text-red-400 whitespace-nowrap">
                      {formatClp(b.price_clp)}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 truncate">
                    {b.specs.cpu} · {b.specs.gpu}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                    <div className="text-[11px] text-zinc-300">
                      Stock total: <strong>{b.stock_quantity}</strong> ·
                      Reservado: <strong>{b.reserved_quantity}</strong> ·
                      Disponible:{' '}
                      <strong
                        className={
                          avail > 0 ? 'text-emerald-400' : 'text-red-400'
                        }
                      >
                        {avail}
                      </strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/builds/${b.slug}`}
                        target="_blank"
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white"
                        title="Abrir página del PC"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => openEditBuild(b)}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200"
                        title="Editar build"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBuildClick(b)}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-950 border border-zinc-700 text-zinc-400 hover:text-red-400"
                        title="Eliminar build"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: WAREHOUSE COMPONENTS */}
      {subTab === 'COMPONENTS' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                'ALL',
                'CPU',
                'GPU',
                'MOTHERBOARD',
                'RAM',
                'STORAGE',
                'PSU',
                'CASE',
                'COOLING',
                'OTHER',
              ] as const
            ).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCompCatFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border ${
                  compCatFilter === cat
                    ? 'bg-red-600 border-red-500 text-white'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {cat === 'ALL'
                  ? 'Todas'
                  : COMPONENT_CATEGORY_META[cat].shortLabel}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Marca / Modelo</th>
                  <th className="py-3 px-4">Condición</th>
                  <th className="py-3 px-4">Cantidad</th>
                  <th className="py-3 px-4">Notas</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {filteredComponents.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-900/40">
                    <td className="py-3 px-4 font-bold text-zinc-300">
                      <span className="inline-flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-red-500" />
                        {COMPONENT_CATEGORY_META[c.category].shortLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">
                        {c.brand} {c.model}
                      </div>
                      {c.sku && (
                        <div className="text-[10px] font-mono text-zinc-500">
                          SKU: {c.sku}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          COMPONENT_CONDITION_META[c.condition].badgeClass
                        }`}
                      >
                        {COMPONENT_CONDITION_META[c.condition].label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickComponentQty(c, -1)}
                          className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 font-bold text-white"
                        >
                          -
                        </button>
                        <span className="w-7 text-center font-black text-white">
                          {c.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuickComponentQty(c, 1)}
                          className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 font-bold text-white"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-zinc-400 max-w-xs truncate">
                      {c.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setCompForm({
                              id: c.id,
                              category: c.category,
                              brand: c.brand,
                              model: c.model,
                              sku: c.sku,
                              condition: c.condition,
                              quantity: c.quantity,
                              notes: c.notes,
                            });
                            setIsCompModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await confirmAction({
                              title: `¿Eliminar ${c.brand} ${c.model}?`,
                              description:
                                'Se quitará este registro de la bodega.',
                              confirmLabel: 'Eliminar',
                              tone: 'danger',
                            });
                            if (!ok) return;
                            await onDeleteComponent(c.id);
                            showToast('Pieza eliminada', { type: 'info' });
                          }}
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-950 border border-zinc-700 text-zinc-400 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredComponents.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-zinc-500 text-xs"
                    >
                      No hay componentes registrados en esta categoría.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TECH SERVICES */}
      {subTab === 'SERVICES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        SERVICE_CATEGORY_META[s.category].badgeClass
                      }`}
                    >
                      {SERVICE_CATEGORY_META[s.category].label}
                    </span>
                    {!s.is_active && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-800 text-zinc-400">
                        Pausado
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-black text-white mt-1.5">
                    {s.name}
                  </h3>
                </div>
                <span className="text-base font-black text-red-400 whitespace-nowrap">
                  {s.price_clp !== null ? formatClp(s.price_clp) : s.price_label}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {s.description}
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500">
                <span>Tiempo estimado: {s.estimated_time}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setServiceForm({
                        id: s.id,
                        name: s.name,
                        category: s.category,
                        description: s.description,
                        price_clp: s.price_clp,
                        price_label: s.price_label,
                        estimated_time: s.estimated_time,
                        is_active: s.is_active,
                        sort_order: s.sort_order,
                      });
                      setIsServiceModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: `¿Eliminar servicio "${s.name}"?`,
                        description: 'Dejará de mostrarse en la tienda pública.',
                        confirmLabel: 'Eliminar',
                        tone: 'danger',
                      });
                      if (!ok) return;
                      await onDeleteService(s.id);
                      showToast('Servicio eliminado', { type: 'info' });
                    }}
                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-950 border border-zinc-700 text-zinc-400 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BUILD MODAL */}
      {isBuildModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl my-auto max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-base font-black text-white">
                {buildForm.id ? 'Editar Build Armada' : 'Nueva Build Armada'}
              </h3>
              <button
                type="button"
                onClick={() => setIsBuildModalOpen(false)}
                className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveBuildSubmit}
              className="p-6 overflow-y-auto space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                    Nombre de la Build *
                  </label>
                  <input
                    type="text"
                    required
                    value={buildForm.name}
                    onChange={(e) =>
                      setBuildForm({ ...buildForm, name: e.target.value })
                    }
                    placeholder="Ej: CM PULSE 4060"
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                    Gama
                  </label>
                  <select
                    value={buildForm.tier}
                    onChange={(e) =>
                      setBuildForm({
                        ...buildForm,
                        tier: e.target.value as BuildTier,
                      })
                    }
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                  >
                    {Object.entries(BUILD_TIER_META).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                    Precio Fijo (CLP) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={buildForm.price_clp}
                    onChange={(e) =>
                      setBuildForm({
                        ...buildForm,
                        price_clp: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                    Stock Total *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={buildForm.stock_quantity}
                    onChange={(e) =>
                      setBuildForm({
                        ...buildForm,
                        stock_quantity: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                    Resolución Objetivo
                  </label>
                  <input
                    type="text"
                    value={buildForm.target_resolution}
                    onChange={(e) =>
                      setBuildForm({
                        ...buildForm,
                        target_resolution: e.target.value,
                      })
                    }
                    placeholder="1080p Ultra / 1440p"
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Incremental Photo Gallery Manager */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-red-400 inline-flex items-center gap-1.5">
                      <ImagePlus className="w-3.5 h-3.5" />
                      Galería de Fotos ({buildPhotos.length})
                    </h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Agrega fotos de a una o varias a la vez. La primera foto
                      será la portada en el catálogo.
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    {isProcessingPhotos
                      ? 'Procesando...'
                      : 'Subir Foto(s)'}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isProcessingPhotos}
                      onChange={handleUploadPhotos}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Add by URL */}
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newPhotoUrl}
                    onChange={(e) => setNewPhotoUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPhotoByUrl();
                      }
                    }}
                    placeholder="O pega la URL de una foto (https://...) y agrega"
                    className="flex-1 rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-white placeholder:text-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddPhotoByUrl}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar
                  </button>
                </div>

                {/* Thumbnails */}
                {buildPhotos.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-800 py-5 text-center text-[11px] text-zinc-500">
                    Aún no hay fotos cargadas para esta build.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {buildPhotos.map((url, idx) => (
                      <div
                        key={`${url.slice(0, 32)}-${idx}`}
                        className={`rounded-xl overflow-hidden border bg-zinc-950 flex flex-col ${
                          idx === 0
                            ? 'border-red-500 ring-1 ring-red-500/40'
                            : 'border-zinc-800'
                        }`}
                      >
                        <div className="relative h-24 bg-zinc-900">
                          <img
                            src={url}
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {idx === 0 && (
                            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-red-600 text-[9px] font-black uppercase text-white">
                              Portada
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(idx)}
                            className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/80 hover:bg-red-600 text-white"
                            title="Quitar foto"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="p-1.5 flex items-center justify-between gap-1 bg-zinc-950 border-t border-zinc-800">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMovePhoto(idx, -1)}
                              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 text-zinc-300"
                              title="Mover a la izquierda"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === buildPhotos.length - 1}
                              onClick={() => handleMovePhoto(idx, 1)}
                              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 text-zinc-300"
                              title="Mover a la derecha"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>

                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleSetCoverPhoto(idx)}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-red-600/20 text-[10px] font-bold text-zinc-300 hover:text-red-300"
                              title="Definir como portada"
                            >
                              <Star className="w-2.5 h-2.5" />
                              Portada
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Descripción corta
                </label>
                <textarea
                  rows={2}
                  value={buildForm.short_description}
                  onChange={(e) =>
                    setBuildForm({
                      ...buildForm,
                      short_description: e.target.value,
                    })
                  }
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2 border-t border-zinc-800">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-red-400 mb-2.5">
                  Componentes Fijos de la Build
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(
                    [
                      ['cpu', 'Procesador (CPU)'],
                      ['gpu', 'Tarjeta de Video (GPU)'],
                      ['motherboard', 'Placa Madre'],
                      ['ram', 'Memoria RAM'],
                      ['storage', 'Almacenamiento (SSD)'],
                      ['psu', 'Fuente de Poder'],
                      ['case_name', 'Gabinete'],
                      ['cooling', 'Refrigeración'],
                      ['os', 'Sistema Operativo'],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                        {label}
                      </label>
                      <input
                        type="text"
                        value={buildForm.specs[field] || ''}
                        onChange={(e) =>
                          setBuildForm({
                            ...buildForm,
                            specs: {
                              ...buildForm.specs,
                              [field]: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-2.5 py-1.5 text-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* FPS Benchmarks Editor with 1-Click Research Shortcuts */}
              <div className="pt-3 border-t border-zinc-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-red-400">
                      Rendimiento en Juegos (FPS con Fundamento)
                    </h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Investiga el combo CPU + GPU en 1 clic y registra FPS
                      reales con resolución, calidad y enlace opcional de
                      respaldo.
                    </p>
                  </div>

                  {/* 1-Click Research Links */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <a
                      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                        `${buildForm.specs.cpu || 'Ryzen'} ${
                          buildForm.specs.gpu || 'RTX'
                        } gaming benchmark`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600/15 hover:bg-red-600/25 border border-red-500/40 text-[10px] font-bold text-red-300"
                    >
                      <ExternalLink className="w-3 h-3" />
                      YouTube Benchmark
                    </a>
                    <a
                      href="https://howmanyfps.com/games"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-300"
                    >
                      <ExternalLink className="w-3 h-3" />
                      HowManyFPS
                    </a>
                    <a
                      href="https://www.techpowerup.com/gpu-specs/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-300"
                    >
                      <ExternalLink className="w-3 h-3" />
                      TechPowerUp
                    </a>
                  </div>
                </div>

                {/* Quick-add popular games */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-zinc-500 font-semibold">
                    Agregar rápido:
                  </span>
                  {[
                    'Valorant',
                    'CS2',
                    'Fortnite',
                    'Warzone',
                    'Cyberpunk 2077',
                    'GTA V',
                    'Apex Legends',
                  ].map((game) => (
                    <button
                      key={game}
                      type="button"
                      onClick={() =>
                        setBuildForm((prev) => ({
                          ...prev,
                          fps_benchmarks: [
                            ...prev.fps_benchmarks,
                            {
                              game,
                              fps: '120 FPS',
                              fps_avg: 120,
                              resolution: '1080p',
                              preset: 'Alto',
                              source_type: 'EXTERNAL_REF',
                              source_url: '',
                            },
                          ],
                        }))
                      }
                      className="px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-bold text-zinc-300"
                    >
                      + {game}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setBuildForm((prev) => ({
                        ...prev,
                        fps_benchmarks: [
                          ...prev.fps_benchmarks,
                          {
                            game: '',
                            fps: '',
                            fps_avg: 100,
                            resolution: '1080p',
                            preset: 'Alto',
                            source_type: 'EXTERNAL_REF',
                            source_url: '',
                          },
                        ],
                      }))
                    }
                    className="px-2 py-0.5 rounded-md bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-[10px] font-bold text-red-300"
                  >
                    + Otro juego
                  </button>
                </div>

                {buildForm.fps_benchmarks.length > 0 && (
                  <div className="space-y-2">
                    {buildForm.fps_benchmarks.map((bm, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-2"
                      >
                        <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center">
                          <input
                            type="text"
                            placeholder="Juego"
                            value={bm.game}
                            onChange={(e) =>
                              setBuildForm((prev) => ({
                                ...prev,
                                fps_benchmarks: prev.fps_benchmarks.map(
                                  (item, i) =>
                                    i === idx
                                      ? { ...item, game: e.target.value }
                                      : item
                                ),
                              }))
                            }
                            className="sm:col-span-4 rounded-lg bg-zinc-950 border border-zinc-700 px-2.5 py-1.5 text-white"
                          />
                          <input
                            type="number"
                            min={1}
                            placeholder="FPS (ej: 145)"
                            value={bm.fps_avg ?? ''}
                            onChange={(e) => {
                              const num = parseInt(e.target.value, 10) || 0;
                              setBuildForm((prev) => ({
                                ...prev,
                                fps_benchmarks: prev.fps_benchmarks.map(
                                  (item, i) =>
                                    i === idx
                                      ? {
                                          ...item,
                                          fps_avg: num,
                                          fps: num > 0 ? `${num} FPS` : '',
                                        }
                                      : item
                                ),
                              }));
                            }}
                            className="sm:col-span-2 rounded-lg bg-zinc-950 border border-zinc-700 px-2.5 py-1.5 text-white"
                          />
                          <select
                            value={bm.resolution}
                            onChange={(e) =>
                              setBuildForm((prev) => ({
                                ...prev,
                                fps_benchmarks: prev.fps_benchmarks.map(
                                  (item, i) =>
                                    i === idx
                                      ? { ...item, resolution: e.target.value }
                                      : item
                                ),
                              }))
                            }
                            className="sm:col-span-2 rounded-lg bg-zinc-950 border border-zinc-700 px-2 py-1.5 text-white"
                          >
                            <option value="1080p">1080p</option>
                            <option value="1440p">1440p</option>
                            <option value="4K">4K</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Calidad (Alto / Ultra + DLSS)"
                            value={bm.preset || ''}
                            onChange={(e) =>
                              setBuildForm((prev) => ({
                                ...prev,
                                fps_benchmarks: prev.fps_benchmarks.map(
                                  (item, i) =>
                                    i === idx
                                      ? { ...item, preset: e.target.value }
                                      : item
                                ),
                              }))
                            }
                            className="sm:col-span-3 rounded-lg bg-zinc-950 border border-zinc-700 px-2.5 py-1.5 text-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setBuildForm((prev) => ({
                                ...prev,
                                fps_benchmarks: prev.fps_benchmarks.filter(
                                  (_, i) => i !== idx
                                ),
                              }))
                            }
                            className="sm:col-span-1 p-1.5 rounded-lg bg-zinc-950 hover:bg-red-950 text-zinc-400 hover:text-red-400 justify-self-end"
                            title="Quitar benchmark"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <select
                            value={bm.source_type || 'EXTERNAL_REF'}
                            onChange={(e) =>
                              setBuildForm((prev) => ({
                                ...prev,
                                fps_benchmarks: prev.fps_benchmarks.map(
                                  (item, i) =>
                                    i === idx
                                      ? {
                                          ...item,
                                          source_type: e.target
                                            .value as BenchmarkSourceType,
                                        }
                                      : item
                                ),
                              }))
                            }
                            className="sm:col-span-4 rounded-lg bg-zinc-950 border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300"
                          >
                            <option value="EXTERNAL_REF">
                              Origen: Referencia verificada
                            </option>
                            <option value="WORKSHOP_TEST">
                              Origen: Probado en taller CM GAMER
                            </option>
                          </select>
                          <input
                            type="url"
                            placeholder="Link opcional de respaldo (ej: video YouTube del benchmark)"
                            value={bm.source_url || ''}
                            onChange={(e) =>
                              setBuildForm((prev) => ({
                                ...prev,
                                fps_benchmarks: prev.fps_benchmarks.map(
                                  (item, i) =>
                                    i === idx
                                      ? { ...item, source_url: e.target.value }
                                      : item
                                ),
                              }))
                            }
                            className="sm:col-span-8 rounded-lg bg-zinc-950 border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 placeholder:text-zinc-600"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* High-Load Productivity Software Editor */}
              <div className="pt-3 border-t border-zinc-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-red-400">
                      Programas de Alta Carga y Productividad (AutoCAD, Blender,
                      Edición)
                    </h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Indica qué software pesado corre bien en este equipo para
                      clientes de arquitectura, diseño, 3D o edición.
                    </p>
                  </div>

                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                      `${buildForm.specs.cpu || 'Ryzen'} ${
                        buildForm.specs.gpu || 'RTX'
                      } Blender Premiere AutoCAD benchmark`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-300"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Buscar pruebas de software
                  </a>
                </div>

                {/* Quick-add software pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-zinc-500 font-semibold">
                    Agregar rápido:
                  </span>
                  {[
                    'AutoCAD 2D / 3D',
                    'Blender',
                    'Adobe Premiere Pro',
                    'Photoshop / Illustrator',
                    'DaVinci Resolve',
                    'Revit / SketchUp',
                    'SolidWorks',
                    'Streaming (OBS)',
                  ].map((app) => (
                    <button
                      key={app}
                      type="button"
                      onClick={() =>
                        setBuildForm((prev) => ({
                          ...prev,
                          workloads: [
                            ...prev.workloads,
                            {
                              app,
                              level: 'FLUIDO',
                              note: '',
                            },
                          ],
                        }))
                      }
                      className="px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-bold text-zinc-300"
                    >
                      + {app}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setBuildForm((prev) => ({
                        ...prev,
                        workloads: [
                          ...prev.workloads,
                          { app: '', level: 'FLUIDO', note: '' },
                        ],
                      }))
                    }
                    className="px-2 py-0.5 rounded-md bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-[10px] font-bold text-red-300"
                  >
                    + Otro programa
                  </button>
                </div>

                {buildForm.workloads.length > 0 && (
                  <div className="space-y-2">
                    {buildForm.workloads.map((wl, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-2"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <input
                            type="text"
                            placeholder="Programa (ej: AutoCAD 2D / 3D)"
                            value={wl.app}
                            onChange={(e) =>
                              setBuildForm((prev) => ({
                                ...prev,
                                workloads: prev.workloads.map((item, i) =>
                                  i === idx
                                    ? { ...item, app: e.target.value }
                                    : item
                                ),
                              }))
                            }
                            className="sm:col-span-6 rounded-lg bg-zinc-950 border border-zinc-700 px-2.5 py-1.5 text-white"
                          />
                          <select
                            value={wl.level}
                            onChange={(e) =>
                              setBuildForm((prev) => ({
                                ...prev,
                                workloads: prev.workloads.map((item, i) =>
                                  i === idx
                                    ? {
                                        ...item,
                                        level: e.target.value as WorkloadLevel,
                                      }
                                    : item
                                ),
                              }))
                            }
                            className="sm:col-span-5 rounded-lg bg-zinc-950 border border-zinc-700 px-2.5 py-1.5 text-white"
                          >
                            <option value="BASICO">
                              Nivel: Básico / Escolar
                            </option>
                            <option value="FLUIDO">
                              Nivel: Rendimiento Fluido
                            </option>
                            <option value="PROFESIONAL">
                              Nivel: Profesional / Pesado
                            </option>
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setBuildForm((prev) => ({
                                ...prev,
                                workloads: prev.workloads.filter(
                                  (_, i) => i !== idx
                                ),
                              }))
                            }
                            className="sm:col-span-1 p-1.5 rounded-lg bg-zinc-950 hover:bg-red-950 text-zinc-400 hover:text-red-400 justify-self-end"
                            title="Quitar programa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Explicación breve (ej: Aceleración RTX OptiX para renders 3D rápidos)"
                          value={wl.note}
                          onChange={(e) =>
                            setBuildForm((prev) => ({
                              ...prev,
                              workloads: prev.workloads.map((item, i) =>
                                i === idx
                                  ? { ...item, note: e.target.value }
                                  : item
                              ),
                            }))
                          }
                          className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 placeholder:text-zinc-600"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={buildForm.is_active}
                    onChange={(e) =>
                      setBuildForm({
                        ...buildForm,
                        is_active: e.target.checked,
                      })
                    }
                    className="accent-red-600"
                  />
                  <span className="font-semibold text-zinc-200">
                    Visible en tienda pública
                  </span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={buildForm.is_featured}
                    onChange={(e) =>
                      setBuildForm({
                        ...buildForm,
                        is_featured: e.target.checked,
                      })
                    }
                    className="accent-red-600"
                  />
                  <span className="font-semibold text-zinc-200">
                    Destacar primero
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsBuildModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 font-bold text-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingBuild}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold inline-flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingBuild ? 'Guardando...' : 'Guardar Build'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPONENT MODAL */}
      {isCompModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">
                {compForm.id ? 'Editar Pieza en Bodega' : 'Nueva Pieza en Bodega'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCompModalOpen(false)}
                className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCompSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                    Categoría
                  </label>
                  <select
                    value={compForm.category}
                    onChange={(e) =>
                      setCompForm({
                        ...compForm,
                        category: e.target.value as ComponentCategory,
                      })
                    }
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                  >
                    {Object.entries(COMPONENT_CATEGORY_META).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                    Condición
                  </label>
                  <select
                    value={compForm.condition}
                    onChange={(e) =>
                      setCompForm({
                        ...compForm,
                        condition: e.target.value as ComponentCondition,
                      })
                    }
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                  >
                    {Object.entries(COMPONENT_CONDITION_META).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                    Marca *
                  </label>
                  <input
                    type="text"
                    required
                    value={compForm.brand}
                    onChange={(e) =>
                      setCompForm({ ...compForm, brand: e.target.value })
                    }
                    placeholder="Ej: ASUS, AMD, MSI"
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={compForm.quantity}
                    onChange={(e) =>
                      setCompForm({
                        ...compForm,
                        quantity: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Modelo *
                </label>
                <input
                  type="text"
                  required
                  value={compForm.model}
                  onChange={(e) =>
                    setCompForm({ ...compForm, model: e.target.value })
                  }
                  placeholder="Ej: Dual RTX 4060 8GB OC"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  SKU / Código interno (opcional)
                </label>
                <input
                  type="text"
                  value={compForm.sku}
                  onChange={(e) =>
                    setCompForm({ ...compForm, sku: e.target.value })
                  }
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Notas
                </label>
                <input
                  type="text"
                  value={compForm.notes}
                  onChange={(e) =>
                    setCompForm({ ...compForm, notes: e.target.value })
                  }
                  placeholder="Ej: Caja sellada, estante B"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCompModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 font-bold text-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingComp}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold"
                >
                  {isSavingComp ? 'Guardando...' : 'Guardar Pieza'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SERVICE MODAL */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">
                {serviceForm.id ? 'Editar Servicio' : 'Nuevo Servicio Técnico'}
              </h3>
              <button
                type="button"
                onClick={() => setIsServiceModalOpen(false)}
                className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveServiceSubmit}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Nombre del Servicio *
                </label>
                <input
                  type="text"
                  required
                  value={serviceForm.name}
                  onChange={(e) =>
                    setServiceForm({ ...serviceForm, name: e.target.value })
                  }
                  placeholder="Ej: Mantención Preventiva Completa"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                    Categoría
                  </label>
                  <select
                    value={serviceForm.category}
                    onChange={(e) =>
                      setServiceForm({
                        ...serviceForm,
                        category: e.target.value as ServiceCategory,
                      })
                    }
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                  >
                    {Object.entries(SERVICE_CATEGORY_META).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                    Precio CLP (vacío = A cotizar)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={serviceForm.price_clp ?? ''}
                    onChange={(e) =>
                      setServiceForm({
                        ...serviceForm,
                        price_clp:
                          e.target.value === ''
                            ? null
                            : parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Tiempo estimado
                </label>
                <input
                  type="text"
                  value={serviceForm.estimated_time}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      estimated_time: e.target.value,
                    })
                  }
                  placeholder="Ej: 24 hrs"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  value={serviceForm.description}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                />
              </div>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={serviceForm.is_active}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      is_active: e.target.checked,
                    })
                  }
                  className="accent-red-600"
                />
                <span className="font-semibold text-zinc-200">
                  Visible en tienda pública
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 font-bold text-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingService}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold"
                >
                  {isSavingService ? 'Guardando...' : 'Guardar Servicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
