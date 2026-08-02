/**
 * Phase 25 — Thumbnail Generator Service
 * --------------------------------------
 * Generates AI thumbnails for experiences using the image generation API.
 * Stores the generated image in the database (base64) for Vercel compatibility.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';

interface ThumbnailResult {
  thumbnailUrl: string;
  generated: boolean;
}

/**
 * Generate an AI thumbnail for an experience based on its title + description.
 * The thumbnail is stored as a base64 string in the experience record.
 */
export async function generateThumbnail(experienceId: string): Promise<ThumbnailResult> {
  const exp = await db.experienceRecord.findUnique({
    where: { id: experienceId },
    select: { title: true, displayTitle: true, description: true, format: true },
  });

  if (!exp) throw new Error('Experience not found');

  const title = exp.displayTitle ?? exp.title;
  const isSpark = exp.format === 'spark';
  const size = isSpark ? '768x1344' : '1344x768'; // portrait for sparks, landscape for games

  // Build a YouTube-style thumbnail prompt
  const prompt = buildThumbnailPrompt(title, exp.description, isSpark);

  try {
    const zai = await ZAI.create();
    const response = await zai.images.generations.create({
      prompt,
      size,
    });

    const imageBase64 = response.data[0]?.base64;
    if (!imageBase64) throw new Error('No image data returned');

    // Store as a data URL (works everywhere, no filesystem needed)
    const thumbnailUrl = `data:image/png;base64,${imageBase64}`;

    // Update the experience record
    await db.experienceRecord.update({
      where: { id: experienceId },
      data: {
        thumbnailUrl,
        thumbnailGenerated: true,
      },
    });

    return { thumbnailUrl, generated: true };
  } catch (err) {
    throw new Error(`Thumbnail generation failed: ${(err as Error).message}`);
  }
}

/**
 * Build a YouTube-style thumbnail prompt from the game title + description.
 */
function buildThumbnailPrompt(title: string, description: string, isSpark: boolean): string {
  const orientation = isSpark ? 'vertical portrait' : 'horizontal landscape 16:9';
  return `Game thumbnail, ${orientation}, vibrant eye-catching design for "${title}". ${description.slice(0, 100)}. Bold colors, dynamic action, high contrast, YouTube thumbnail style, professional game art, no text overlay, high quality, detailed`;
}

/**
 * Generate display titles using LLM.
 */
export async function generateDisplayTitle(experienceId: string): Promise<{ displayTitle: string }> {
  const exp = await db.experienceRecord.findUnique({
    where: { id: experienceId },
    select: { title: true, description: true },
  });

  if (!exp) throw new Error('Experience not found');

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `You are a YouTube title optimizer for a playable content platform called PlayLiquid. Generate 3 catchy, clickable titles for a game. They should be exciting and make people want to play. Include 1-2 emojis max. No quotes. No markdown. Return ONLY the 3 titles, one per line.`,
        },
        {
          role: 'user',
          content: `Game: ${exp.title}\nDescription: ${exp.description}\n\nGenerate 3 catchy titles:`,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const titles = (completion.choices[0]?.message?.content ?? '')
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const displayTitle = titles[0] ?? exp.title;

    await db.experienceRecord.update({
      where: { id: experienceId },
      data: { displayTitle },
    });

    return { displayTitle };
  } catch {
    // Fallback: use original title
    return { displayTitle: exp.title };
  }
}
