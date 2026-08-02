/**
 * Phase 23 — Upload Service
 * -------------------------
 * Handles real file uploads (multipart/form-data), ZIP extraction,
 * storage, and experience creation.
 *
 * Flow:
 *   File upload → extract ZIP → validate → store in /public/uploaded-games/
 *   → create ExperienceRecord (draft) → return experienceId
 *
 * Uses Node's built-in zlib + a minimal ZIP reader (no external deps).
 */

import { promises as fs } from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { ensureDemoCreator } from '@/lib/studio-service';
import { updateContainmentConfig } from '@/lib/economy/containment-service';
import { validateBundle, generateManifest, type BundleValidation } from './bundle-validator';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploaded-games');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export interface UploadResult {
  experienceId: string;
  validation: BundleValidation;
  storagePath: string;
  publicUrl: string;
}

/**
 * Process an uploaded ZIP file:
 *   1. Save to temp
 *   2. Extract to /public/uploaded-games/{slug}/
 *   3. Validate the bundle
 *   4. Create ExperienceRecord (draft status)
 *   5. Create containment config (html5)
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
  const experienceDir = path.join(UPLOAD_DIR, slug);

  // Ensure upload dir exists
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(experienceDir, { recursive: true });

  // Read the file buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Extract ZIP
  const extractedFiles = await extractZip(buffer, experienceDir);

  // Read file contents for validation (text files only, < 100KB each)
  const fileContents: Record<string, string> = {};
  for (const filePath of extractedFiles) {
    const ext = path.extname(filePath).toLowerCase();
    if (['.html', '.js', '.css', '.json', '.txt'].includes(ext)) {
      try {
        const fullPath = path.join(experienceDir, filePath);
        const stat = await fs.stat(fullPath);
        if (stat.size < 100_000) {
          fileContents[filePath] = await fs.readFile(fullPath, 'utf-8');
        }
      } catch { /* skip binary/large files */ }
    }
  }

  // Validate
  const validation = validateBundle(extractedFiles, fileContents);
  if (!validation.valid) {
    // Clean up invalid bundle
    await fs.rm(experienceDir, { recursive: true, force: true }).catch(() => {});
    throw new Error(`Bundle validation failed: ${validation.errors.join(', ')}`);
  }

  // Generate manifest if missing
  if (!validation.hasManifest) {
    const manifest = generateManifest(baseName, validation);
    await fs.writeFile(path.join(experienceDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }

  // Create experience record (draft status)
  const creator = await ensureDemoCreator();
  const publicUrl = `/uploaded-games/${slug}/`;

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
      status: 'DRAFT', // Start as draft — creator must publish
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

  return {
    experienceId: experience.id,
    validation,
    storagePath: experienceDir,
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

// ─── Minimal ZIP extraction (no external deps) ─────────────────────────────
// Uses Node's zlib to decompress. Parses the ZIP Central Directory.

async function extractZip(buffer: Buffer, destDir: string): Promise<string[]> {
  // For simplicity and reliability, we use the 'unzipper' approach via
  // Node's built-in zlib + manual ZIP parsing. However, since we want
  // zero external deps, we'll use a different approach:
  // If the file is actually a ZIP, we parse it; otherwise we treat it
  // as a single HTML file.

  // Check if it's a ZIP (PK magic bytes)
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;

  if (!isZip) {
    // Treat as a single HTML file
    const fileName = 'index.html';
    await fs.writeFile(path.join(destDir, fileName), buffer);
    return [fileName];
  }

  // Parse ZIP using the Central Directory
  const files: string[] = [];

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
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);

    const fileName = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);

    // Skip directories
    if (!fileName.endsWith('/')) {
      // Read local file header to find data offset
      const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraFieldLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
      const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);

      let fileData: Buffer;
      if (compressionMethod === 0) {
        // Stored (no compression)
        fileData = compressedData;
      } else if (compressionMethod === 8) {
        // Deflate (raw) — ZIP uses raw deflate without zlib headers
        const zlib = await import('zlib');
        fileData = zlib.inflateRawSync(compressedData);
      } else {
        // Unsupported compression — skip
        offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
        continue;
      }

      // Ensure directory exists
      const filePath = path.join(destDir, fileName);
      const fileDir = path.dirname(filePath);
      await fs.mkdir(fileDir, { recursive: true });

      // Write file
      await fs.writeFile(filePath, fileData);
      files.push(fileName);
    }

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return files;
}
