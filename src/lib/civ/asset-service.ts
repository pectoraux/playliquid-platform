/**
 * Civilization Engine — Asset Service
 * -------------------------------------
 * Manages ownable world assets: land, buildings, businesses, items.
 * Assets generate resources/reputation per tick for their owners.
 * All transactions flow through the double-entry ledger.
 */

import { db } from '@/lib/db';
import { ledger } from '@/lib/token-store';
import type { Asset } from '@/kernel/types';

/**
 * List all assets in a world.
 */
export async function listAssets(worldId: string): Promise<Asset[]> {
  const records = await db.assetRecord.findMany({
    where: { worldId },
    orderBy: { createdAt: 'desc' },
  });
  return records.map(toAsset);
}

/**
 * List assets owned by an entity.
 */
export async function getOwnedAssets(entityId: string): Promise<Asset[]> {
  const records = await db.assetRecord.findMany({
    where: { ownerId: entityId },
  });
  return records.map(toAsset);
}

/**
 * List assets for sale.
 */
export async function getAssetsForSale(worldId: string): Promise<Asset[]> {
  const records = await db.assetRecord.findMany({
    where: { worldId, forSale: true },
    orderBy: { askingPrice: 'asc' },
  });
  return records.map(toAsset);
}

/**
 * Buy an asset. Transfers Liquid from buyer to seller (or treasury).
 */
export async function buyAsset(params: {
  assetId: string;
  buyerEntityId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const asset = await db.assetRecord.findUnique({ where: { id: params.assetId } });
  if (!asset) return { ok: false, error: 'Asset not found' };
  if (!asset.forSale) return { ok: false, error: 'Asset not for sale' };
  if (asset.ownerId === params.buyerEntityId) return { ok: false, error: 'Already owned' };

  const buyer = await db.worldEntityRecord.findUnique({ where: { id: params.buyerEntityId } });
  if (!buyer) return { ok: false, error: 'Buyer not found' };

  const price = asset.askingPrice ?? asset.purchasePrice;
  if (buyer.wealth < price) return { ok: false, error: 'Insufficient funds' };

  // Transfer via ledger
  const sellerAccount = asset.ownerId
    ? `entity:${asset.ownerId}:wallet`
    : `world:${asset.worldId}:treasury`;

  await ledger.post([
    { account: `entity:${params.buyerEntityId}:wallet`, debit: 0, credit: price, memo: `bought ${asset.name}` },
    { account: sellerAccount, debit: price, credit: 0, memo: `sold ${asset.name}` },
  ], `asset sale: ${asset.name}`);

  // Update asset ownership
  await db.assetRecord.update({
    where: { id: params.assetId },
    data: {
      ownerId: params.buyerEntityId,
      forSale: false,
      askingPrice: null,
      purchasePrice: price,
    },
  });

  // Update buyer wealth
  await db.worldEntityRecord.update({
    where: { id: params.buyerEntityId },
    data: { wealth: { decrement: price } },
  });

  // Update seller wealth if not treasury
  if (asset.ownerId) {
    await db.worldEntityRecord.update({
      where: { id: asset.ownerId },
      data: { wealth: { increment: price } },
    }).catch(() => {});
  }

  return { ok: true };
}

/**
 * List an asset for sale.
 */
export async function listForSale(params: {
  assetId: string;
  askingPrice: number;
}): Promise<void> {
  await db.assetRecord.update({
    where: { id: params.assetId },
    data: { forSale: true, askingPrice: params.askingPrice },
  });
}

/**
 * Generate resources from all owned assets (called per tick).
 */
export async function processAssetGeneration(worldId: string, tick: number): Promise<void> {
  const assets = await db.assetRecord.findMany({
    where: { worldId, ownerId: { not: null } },
  });

  for (const asset of assets) {
    if (!asset.ownerId) continue;
    const generationRate: Record<string, number> = JSON.parse(asset.generationRateJson);
    const entity = await db.worldEntityRecord.findUnique({ where: { id: asset.ownerId } });
    if (!entity || !entity.alive) continue;

    const resources: Record<string, number> = JSON.parse(entity.resourcesJson);
    for (const [resource, rate] of Object.entries(generationRate)) {
      if (tick % 5 === 0) {  // generate every 5 ticks
        resources[resource] = (resources[resource] ?? 0) + rate;
      }
    }

    await db.worldEntityRecord.update({
      where: { id: asset.ownerId },
      data: { resourcesJson: JSON.stringify(resources) },
    });
  }
}

/**
 * Get asset market summary.
 */
export async function getAssetMarketSummary(worldId: string): Promise<{
  totalAssets: number;
  forSale: number;
  totalValue: number;
  byType: Record<string, number>;
}> {
  const assets = await db.assetRecord.findMany({ where: { worldId } });
  const forSale = assets.filter((a) => a.forSale);
  const totalValue = assets.reduce((s, a) => s + (a.askingPrice ?? a.purchasePrice), 0);
  const byType: Record<string, number> = {};
  for (const a of assets) byType[a.type] = (byType[a.type] ?? 0) + 1;

  return {
    totalAssets: assets.length,
    forSale: forSale.length,
    totalValue,
    byType,
  };
}

function toAsset(r: any): Asset {
  return {
    id: r.id,
    worldId: r.worldId,
    name: r.name,
    type: r.type,
    ownerId: r.ownerId ?? undefined,
    purchasePrice: r.purchasePrice,
    generationRate: JSON.parse(r.generationRateJson),
    forSale: r.forSale,
    askingPrice: r.askingPrice ?? undefined,
    createdAt: r.createdAt.getTime(),
  };
}
