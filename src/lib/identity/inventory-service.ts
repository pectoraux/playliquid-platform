/**
 * Identity Layer v0.45 — Inventory & World Passport Service
 * -----------------------------------------------------------
 * Manages persistent item ownership and world visit tracking.
 */

import { db } from '@/lib/db';
import type { InventoryItem, WorldPassport } from '@/kernel/types';

// ─── Inventory ─────────────────────────────────────────────────────────────

export async function getInventory(userId: string): Promise<InventoryItem[]> {
  const records = await db.inventoryItemRecord.findMany({
    where: { userId },
    orderBy: { acquiredAt: 'desc' },
  });
  return records.map((r) => ({
    id: r.id,
    itemId: r.itemId,
    name: r.name,
    description: r.description,
    icon: r.icon,
    type: r.type as InventoryItem['type'],
    rarity: r.rarity as InventoryItem['rarity'],
    quantity: r.quantity,
    worldId: r.worldId ?? undefined,
    acquiredAt: r.acquiredAt.getTime(),
  }));
}

export async function addItemToInventory(params: {
  userId: string;
  itemId: string;
  name: string;
  description: string;
  icon?: string;
  type: InventoryItem['type'];
  rarity?: InventoryItem['rarity'];
  quantity?: number;
  worldId?: string;
}): Promise<void> {
  await db.inventoryItemRecord.upsert({
    where: { userId_itemId: { userId: params.userId, itemId: params.itemId } },
    create: {
      userId: params.userId,
      itemId: params.itemId,
      name: params.name,
      description: params.description,
      icon: params.icon ?? '📦',
      type: params.type,
      rarity: params.rarity ?? 'common',
      quantity: params.quantity ?? 1,
      worldId: params.worldId,
    },
    update: {
      quantity: { increment: params.quantity ?? 1 },
    },
  });
}

export async function removeItemFromInventory(userId: string, itemId: string, quantity = 1): Promise<void> {
  const item = await db.inventoryItemRecord.findUnique({
    where: { userId_itemId: { userId, itemId } },
  });
  if (!item) return;

  if (item.quantity <= quantity) {
    await db.inventoryItemRecord.delete({
      where: { userId_itemId: { userId, itemId } },
    });
  } else {
    await db.inventoryItemRecord.update({
      where: { userId_itemId: { userId, itemId } },
      data: { quantity: { decrement: quantity } },
    });
  }
}

// ─── World Passport ────────────────────────────────────────────────────────

export async function recordWorldVisit(params: {
  userId: string;
  worldId: string;
  worldName: string;
}): Promise<void> {
  const existing = await db.worldVisitRecord.findUnique({
    where: { userId_worldId: { userId: params.userId, worldId: params.worldId } },
  });

  if (existing) {
    await db.worldVisitRecord.update({
      where: { userId_worldId: { userId: params.userId, worldId: params.worldId } },
      data: {
        visitCount: { increment: 1 },
        lastVisitAt: new Date(),
      },
    });
  } else {
    await db.worldVisitRecord.create({
      data: {
        userId: params.userId,
        worldId: params.worldId,
        worldName: params.worldName,
      },
    });
  }
}

export async function getWorldPassport(userId: string): Promise<WorldPassport> {
  const records = await db.worldVisitRecord.findMany({
    where: { userId },
    orderBy: { lastVisitAt: 'desc' },
  });
  return {
    visited: records.map((r) => ({
      worldId: r.worldId,
      worldName: r.worldName,
      visitCount: r.visitCount,
      firstVisitAt: r.firstVisitAt.getTime(),
      lastVisitAt: r.lastVisitAt.getTime(),
      citizenshipStatus: r.citizenshipStatus as WorldPassport['visited'][0]['citizenshipStatus'],
    })),
    citizenships: [],
    totalWorldsVisited: records.length,
  };
}

export async function updateCitizenshipStatus(userId: string, worldId: string, status: 'visitor' | 'resident' | 'citizen' | 'leader'): Promise<void> {
  await db.worldVisitRecord.update({
    where: { userId_worldId: { userId, worldId } },
    data: { citizenshipStatus: status },
  }).catch(() => {});
}

// ─── Creator Identity ──────────────────────────────────────────────────────

export async function getCreatorIdentity(creatorId: string): Promise<any> {
  const creator = await db.creatorRecord.findUnique({
    where: { id: creatorId },
    include: { experiences: true },
  });
  if (!creator) return null;

  const publishedExps = creator.experiences.filter((e) => e.status === 'PUBLISHED');
  const totalPlayers = publishedExps.reduce((s, e) => s + e.playCount, 0);
  const totalForks = publishedExps.reduce((s, e) => s + e.forkCount, 0);

  const creatorGenome = creator.creatorGenomeJson ? JSON.parse(creator.creatorGenomeJson) : {
    strategy: 0, economy: 0, social: 0, creativity: 0, innovation: 0,
  };

  const reputation = creator.reputationJson ? JSON.parse(creator.reputationJson) : {
    quality: 50, innovation: 50, fairness: 50, community: 50,
  };

  return {
    creatorId: creator.id,
    handle: creator.handle,
    displayName: creator.displayName,
    bio: creator.bio,
    avatarUrl: creator.avatarUrl,
    level: creator.creatorLevel,
    xp: creator.creatorXP,
    creatorGenome,
    reputation,
    totalSparks: publishedExps.length,
    totalPlayers,
    totalLiquid: creator.totalLiquid,
    followers: creator.followers,
    forks: totalForks,
    createdAt: creator.createdAt.getTime(),
  };
}
