import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  if (typeof email !== 'string' || !EMAIL.test(email.trim())) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const normalized = email.trim().toLowerCase();

  try {
    await prisma.subscriber.upsert({
      where: { email: normalized },
      create: { email: normalized },
      update: { unsubscribedAt: null },
    });
  } catch (error) {
    console.error('Subscribe failed:', error);
    return NextResponse.json({ error: 'Could not save your subscription.' }, { status: 500 });
  }

  return NextResponse.json({ message: "You're in — the next issue lands Monday." });
}
