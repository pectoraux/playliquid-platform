import { NextResponse } from 'next/server';
import { getUploadedFile } from '@/lib/upload/upload-service';

/**
 * GET /api/uploaded-games/[slug]/[...path]
 * Serves an uploaded game file from the database.
 *
 * This replaces filesystem serving for Vercel compatibility —
 * Vercel's serverless filesystem is read-only, so uploaded game
 * files are stored as base64 in UploadedGameFileRecord and served
 * dynamically.
 *
 * Example: /api/uploaded-games/pixel-quest-f54a/index.html
 *          /api/uploaded-games/pixel-quest-f54a/game.js
 *          /api/uploaded-games/pixel-quest-f54a/style.css
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; path: string[] }> }) {
  const { slug, path } = await params;
  const filePath = path.join('/');

  const file = await getUploadedFile(slug, filePath);
  if (!file) {
    return new NextResponse('File not found', { status: 404 });
  }

  return new NextResponse(file.content, {
    headers: {
      'Content-Type': file.mimeType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
