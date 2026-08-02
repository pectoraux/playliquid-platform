import { NextRequest, NextResponse } from 'next/server';
import { processUpload, publishExperience } from '@/lib/upload/upload-service';

/**
 * POST /api/experiences/upload
 * Accepts multipart/form-data with:
 *   - file: the ZIP or HTML file
 *   - title: optional title
 *   - description: optional description
 *   - tags: optional comma-separated tags
 *
 * Also accepts JSON for the publish action:
 *   { action: "publish", experienceId: "..." }
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';

  // ── JSON mode (publish action) ──
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'publish' && body.experienceId) {
      try {
        await publishExperience(body.experienceId);
        return NextResponse.json({ ok: true, experienceId: body.experienceId, status: 'PUBLISHED' });
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 500 });
      }
    }
    return NextResponse.json({ error: 'Invalid JSON action' }, { status: 400 });
  }

  // ── Multipart mode (file upload) ──
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart/form-data or application/json' }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const title = (formData.get('title') as string | null) ?? undefined;
    const description = (formData.get('description') as string | null) ?? undefined;
    const tagsStr = formData.get('tags') as string | null;
    const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : undefined;

    const result = await processUpload({ file, title, description, tags });

    return NextResponse.json({
      ok: true,
      experienceId: result.experienceId,
      validation: result.validation,
      publicUrl: result.publicUrl,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
