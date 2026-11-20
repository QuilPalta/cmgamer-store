'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';

export default function AdminLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error || 'Clave incorrecta');
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch {
      setError('Error de conexión al iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a la Tienda
          </Link>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-600/15 text-red-400 border border-red-500/30 text-[11px] font-bold">
            <ShieldCheck className="w-3 h-3" /> Acceso Privado
          </span>
        </div>

        <div className="text-center space-y-2.5">
          <div className="flex justify-center">
            <BrandLogo size="lg" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">
            Panel Admin <span className="text-red-500">CM GAMER</span>
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Gestiona tus builds publicadas, bodega de componentes, servicios de
            mantención, ventas y pagos vía transferencia.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
              Clave de Administrador
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Por defecto: cmgamer-admin"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-700 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5">
              Clave predeterminada:{' '}
              <code className="text-red-400 font-mono">cmgamer-admin</code>{' '}
              (configurable con <code>ADMIN_ACCESS_PIN</code> en{' '}
              <code>.env.local</code>).
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-950/80 border border-red-500/40 p-3 text-xs text-red-200 font-semibold">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-red-600/20 transition-colors"
          >
            {isLoading ? 'Verificando...' : 'Ingresar al Panel Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}
