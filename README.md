# CM GAMER Store

Tienda web de **Builds Gamer Armadas**, **Servicios Técnicos** y **Panel de Administración** (inventario, bodega de componentes, ventas y control de pagos vía WhatsApp + Transferencia + SMTP).

## Stack Técnico
- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4** (Paleta CM GAMER: Negro, Gris Grafito, Rojo y Blanco)
- **Supabase** (PostgreSQL + RLS + RPCs transaccionales con reserva de stock) + modo local de respaldo para pruebas inmediatas
- **Nodemailer (SMTP)** para notificaciones automáticas por correo

## Inicio Rápido

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) para ver la tienda pública y [http://localhost:3000/admin](http://localhost:3000/admin) para el panel de administración.

- **Clave Admin por defecto:** `cmgamer-admin` (configurable vía `ADMIN_ACCESS_PIN` en `.env.local`).

## Conectar Supabase (Producción)
1. Crea un proyecto en Supabase y abre el **SQL Editor**.
2. Ejecuta el script completo de `supabase/migrations/001_cmgamer_schema.sql`.
3. Copia `.env.example` a `.env.local` y completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (o ingrésalos directamente en `/admin` → **Configuración**).
4. En **Configuración**, haz clic en **Subir Datos Locales a Supabase** si deseas cargar las builds y servicios iniciales.

## Notificaciones por Correo (SMTP)
Puedes configurar tu servidor SMTP (Gmail App Password, Brevo, Zoho, etc.) desde `.env.local` o directamente desde `/admin` → **Configuración** y probar el envío con el botón **Enviar Correo de Prueba**.
