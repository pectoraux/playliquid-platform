import { NextRequest, NextResponse } from 'next/server';
import { generateThumbnail, generateDisplayTitle } from '@/lib/thumbnails/thumbnail-service';

/**
 * POST /api/thumbnails/generate
 *   { experienceId, action: "thumbnail" | "title" | "both" }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { experienceId, action } = body;

  if (!experienceId) {
    return NextResponse.json({ error: 'experienceId is required' }, { status: 400 });
  }

  try {
    const mode = action ?? 'both';

    if (mode === 'thumbnail') {
      const result = await generateThumbnail(experienceId);
      return NextResponse.json(result);
    }

    if (mode === 'title') {
      const result = await generateDisplayTitle(experienceId);
      return NextResponse.json(result);
    }

    // both
    const [thumbResult, titleResult] = await Promise.all([
      generateThumbnail(experienceId).catch((e) => ({ error: e.message })),
      generateDisplayTitle(experienceId).catch((e) => ({ error: e.message })),
    ]);

    return NextResponse.json({
      thumbnailUrl: (thumbResult as any).thumbnailUrl,
      displayTitle: (titleResult as any).displayTitle,
      generated: true,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
