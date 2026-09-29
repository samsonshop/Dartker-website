import { NextResponse } from 'next/server';
import { searchSuggestions } from '@/server/catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const term = (searchParams.get('q') ?? '').slice(0, 80);
  if (term.trim().length < 2) return NextResponse.json({ results: [] });

  try {
    const results = await searchSuggestions(term, 6);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('[search/suggestions]', error);
    return NextResponse.json({ results: [] }, { status: 200 });
  }
}
