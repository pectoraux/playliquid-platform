/**
 * Phase 24 — Upload Service (Vercel-compatible)
 * ---------------------------------------------
 * Handles real file uploads (multipart/form-data), ZIP extraction,
 * and experience creation — all in-memory with DB-backed file storage.
 *
 * Vercel's serverless filesystem is read-only, so we:
 *   1. Extract the ZIP in memory (Buffer)
 *   2. Store each file's content as base64 in UploadedGameFileRecord
 *   3. Serve files via /api/uploaded-games/[slug]/[...path] API route
 *
 * This works on both local dev and Vercel serverless.
 */

import { db } from '@/lib/db';
import { ensureDemoCreator } from '@/lib/studio-service';
import { updateContainmentConfig } from '@/lib/economy/containment-service';
import { validateBundle, generateManifest, type BundleValidation } from './bundle-validator';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (DB storage has practical limits)

export interface UploadResult {
  experienceId: string;
  validation: BundleValidation;
  publicUrl: string;
}

interface ExtractedFile {
  path: string;
  content: Buffer;
}

/**
 * Process an uploaded ZIP file:
 *   1. Read file into memory
 *   2. Extract ZIP in memory
 *   3. Validate the bundle
 *   4. Store each file as base64 in UploadedGameFileRecord
 *   5. Create ExperienceRecord (draft status)
 *   6. Return result
 */
export async function processUpload(params: {
  file: File;
  title?: string;
  description?: string;
  tags?: string[];
}): Promise<UploadResult> {
  const { file } = params;

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${file.size} bytes (max ${MAX_FILE_SIZE})`);
  }

  // Generate a slug from the filename or title
  const baseName = params.title ?? file.name.replace(/\.zip$/i, '');
  const slug = `${baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36).slice(-4)}`;

  // Read the file into memory
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Extract ZIP in memory
  const extractedFiles = extractZip(buffer);

  if (extractedFiles.length === 0) {
    throw new Error('No files found in the uploaded archive');
  }

  // Read file contents for validation (text files only, < 100KB each)
  const fileContents: Record<string, string> = {};
  for (const f of extractedFiles) {
    const ext = f.path.split('.').pop()?.toLowerCase() ?? '';
    if (['html', 'js', 'css', 'json', 'txt'].includes(ext) && f.content.length < 100_000) {
      fileContents[f.path] = f.content.toString('utf-8');
    }
  }

  // Validate
  const validation = validateBundle(extractedFiles.map((f) => f.path), fileContents);
  if (!validation.valid) {
    throw new Error(`Bundle validation failed: ${validation.errors.join(', ')}`);
  }

  // Store files in the database (base64-encoded)
  const creator = await ensureDemoCreator();
  const publicUrl = `/api/uploaded-games/${slug}/`;

  // Create experience record (draft status)
  const experience = await db.experienceRecord.create({
    data: {
      slug,
      title: params.title ?? baseName,
      description: params.description ?? `Uploaded HTML5 game: ${baseName} (${validation.engine})`,
      creatorId: creator.id,
      intentJson: JSON.stringify({
        kind: 'GAME',
        emotions: ['excitement'],
        goals: ['play'],
        audience: 'general',
        description: params.description ?? '',
        tags: params.tags ?? validation.detectedExtensions,
        runtime: 'html5',
        engine: validation.engine,
        uploaded: true,
      }),
      status: 'DRAFT',
      format: 'game',
    },
  });

  // Create containment config
  await updateContainmentConfig(experience.id, {
    runtimeType: 'html5',
    aspectRatio: '16:9',
    orientation: 'landscape',
    html5BundleUrl: publicUrl,
  });

  // Create imported game bundle record
  await db.importedGameBundleRecord.create({
    data: {
      experienceId: experience.id,
      filename: file.name,
      storageUrl: publicUrl,
      manifestJson: JSON.stringify(generateManifest(baseName, validation)),
      runtimeType: 'html5',
      uploadedBy: creator.id,
      status: 'VALIDATED',
    },
  });

  // Store each file in the database
  for (const f of extractedFiles) {
    const ext = f.path.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = getMimeType(ext);
    await db.uploadedGameFileRecord.create({
      data: {
        experienceId: experience.id,
        slug,
        filePath: f.path,
        content: f.content.toString('base64'),
        mimeType,
        size: f.content.length,
      },
    });
  }

  // If no manifest exists, generate one and store it
  if (!validation.hasManifest) {
    const manifest = generateManifest(baseName, validation);
    await db.uploadedGameFileRecord.create({
      data: {
        experienceId: experience.id,
        slug,
        filePath: 'manifest.json',
        content: Buffer.from(JSON.stringify(manifest, null, 2)).toString('base64'),
        mimeType: 'application/json',
        size: JSON.stringify(manifest).length,
      },
    });
  }

  return {
    experienceId: experience.id,
    validation,
    publicUrl,
  };
}

/**
 * Publish a draft experience.
 */
export async function publishExperience(experienceId: string): Promise<void> {
  await db.experienceRecord.update({
    where: { id: experienceId },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });
}

/**
 * Get a file from the database by slug + path.
 */
export async function getUploadedFile(slug: string, filePath: string): Promise<{
  content: Buffer;
  mimeType: string;
} | null> {
  const record = await db.uploadedGameFileRecord.findFirst({
    where: { slug, filePath },
  });
  if (!record) return null;
  return {
    content: Buffer.from(record.content, 'base64'),
    mimeType: record.mimeType,
  };
}

/**
 * List all files for a slug.
 */
export async function listUploadedFiles(slug: string): Promise<string[]> {
  const records = await db.uploadedGameFileRecord.findMany({
    where: { slug },
    select: { filePath: true },
  });
  return records.map((r) => r.filePath);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getMimeType(ext: string): string {
  const types: Record<string, string> = {
    html: 'text/html',
    htm: 'text/html',
    js: 'application/javascript',
    css: 'text/css',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    mp4: 'video/mp4',
    webm: 'video/webm',
    txt: 'text/plain',
  };
  return types[ext] ?? 'application/octet-stream';
}

// ─── In-memory ZIP extraction (zero external deps) ─────────────────────────

function extractZip(buffer: Buffer): ExtractedFile[] {
  const files: ExtractedFile[] = [];

  // Check if it's a ZIP (PK magic bytes)
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;

  if (!isZip) {
    // Treat as a single HTML file
    files.push({ path: 'index.html', content: buffer });
    return files;
  }

  // Find End of Central Directory record
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65536); i--) {
    if (buffer[i] === 0x50 && buffer[i + 1] === 0x4b && buffer[i + 2] === 0x05 && buffer[i + 3] === 0x06) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Invalid ZIP file: End of Central Directory not found');
  }

  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
  const cdEntries = buffer.readUInt16LE(eocdOffset + 10);

  let offset = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (buffer[offset] !== 0x50 || buffer[offset + 1] !== 0x4b || buffer[offset + 2] !== 0x01 || buffer[offset + 3] !== 0x02) {
      break;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);

    const fileName = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);

    // Skip directories
    if (!fileName.endsWith('/')) {
      const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraFieldLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
      const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);

      let fileData: Buffer;
      if (compressionMethod === 0) {
        fileData = compressedData;
      } else if (compressionMethod === 8) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const zlib = require('zlib');
        fileData = zlib.inflateRawSync(compressedData);
      } else {
        offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
        continue;
      }

      files.push({ path: fileName, content: fileData });
    }

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  // Strip common leading directory prefix (e.g. "pixel-quest-adventure/index.html" → "index.html")
  // This happens when the ZIP contains a top-level folder with all files inside.
  if (files.length > 0) {
    const allPaths = files.map((f) => f.path);
    // Check if all files share a common first path segment
    const firstSegs = allPaths.map((p) => p.split('/')[0]);
    const allSameFirstSeg = firstSegs.every((s) => s === firstSegs[0]);
    const hasSubdirs = allPaths.every((p) => p.includes('/'));
    if (allSameFirstSeg && hasSubdirs) {
      const prefix = firstSegs[0] + '/';
      for (const f of files) {
        f.path = f.path.slice(prefix.length);
      }
    }
  }

  return files;
}
