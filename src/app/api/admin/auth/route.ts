import { NextRequest, NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'cmgamer_admin_session';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { pin?: string };
    const expectedPin = process.env.ADMIN_ACCESS_PIN || 'cmgamer-admin';

    if (!body.pin || body.pin.trim() !== expectedPin) {
      return NextResponse.json(
        { error: 'Clave de administrador incorrecta.' },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE_NAME, 'authenticated', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
    });
    return res;
  } catch {
    return NextResponse.json(
      { error: 'Solicitud inválida.' },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
