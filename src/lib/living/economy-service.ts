/**
 * v0.52 Living Economies — Resources, Markets, Trade Routes, Buildings, Roles
 * --------------------------------------------------------------------------
 * Time creates change. Change creates consequences. Consequences create economies.
 *
 * When a migration wave arrives → population increases → food demand rises
 * → food price goes up → trade routes become profitable → creators build
 * markets → civilization grows.
 *
 * This is the causal chain that makes civilizations feel alive.
 */

import { db } from '@/lib/db';
import { ledger } from '@/lib/token-store';
import { ACCOUNTS } from '@/kernel/ledger';

// ─── Resource Types ────────────────────────────────────────────────────────

export const RESOURCE_TYPES = {
  food: { label: 'Food', icon: '🌾', basePrice: 100, baseProduction: 15, baseConsumption: 8 },
  wood: { label: 'Wood', icon: '🪵', basePrice: 80, baseProduction: 10, baseConsumption: 4 },
  metal: { label: 'Metal', icon: '⛏️', basePrice: 200, baseProduction: 5, baseConsumption: 3 },
  knowledge: { label: 'Knowledge', icon: '📚', basePrice: 300, baseProduction: 3, baseConsumption: 2 },
  culture: { label: 'Culture', icon: '🎭', basePrice: 250, baseProduction: 4, baseConsumption: 1 },
  energy: { label: 'Energy', icon: '⚡', basePrice: 150, baseProduction: 8, baseConsumption: 6 },
  technology: { label: 'Technology', icon: '🔬', basePrice: 500, baseProduction: 2, baseConsumption: 1 },
};

// ─── Initialize Resources for a World ──────────────────────────────────────

export async function initializeResources(worldId: string, worldName: string): Promise<void> {
  const existing = await db.civilizationResourceRecord.findFirst({ where: { worldId } });
  if (existing) return;

  for (const [type, config] of Object.entries(RESOURCE_TYPES)) {
    await db.civilizationResourceRecord.create({
      data: {
        worldId,
        worldName,
        resourceType: type,
        supply: 100 + Math.floor(Math.random() * 50),
        demand: 40 + Math.floor(Math.random() * 30),
        productionRate: config.baseProduction,
        consumptionRate: config.baseConsumption,
        price: config.basePrice,
        priceHistory: JSON.stringify([{ tick: 0, price: config.basePrice }]),
      },
    });
  }
}

// ─── Get Resources ─────────────────────────────────────────────────────────

export async function getResources(worldId: string): Promise<any[]> {
  const resources = await db.civilizationResourceRecord.findMany({
    where: { worldId },
    orderBy: { resourceType: 'asc' },
  });

  return resources.map((r) => {
    const config = RESOURCE_TYPES[r.resourceType as keyof typeof RESOURCE_TYPES];
    return {
      id: r.id,
      resourceType: r.resourceType,
      label: config?.label ?? r.resourceType,
      icon: config?.icon ?? '📦',
      supply: r.supply,
      demand: r.demand,
      productionRate: r.productionRate,
      consumptionRate: r.consumptionRate,
      price: r.price,
      priceHistory: JSON.parse(r.priceHistory),
      supplyDemandRatio: r.demand > 0 ? r.supply / r.demand : 0,
      lastTickUpdated: r.lastTickUpdated,
    };
  });
}

// ─── Update Resources Per Tick ─────────────────────────────────────────────

export async function updateResourcesOnTick(worldId: string, worldName: string, tickNumber: number, population: number): Promise<{
  priceChanges: Array<{ resource: string; oldPrice: number; newPrice: number; change: number }>;
}> {
  const resources = await db.civilizationResourceRecord.findMany({ where: { worldId } });
  const priceChanges: Array<{ resource: string; oldPrice: number; newPrice: number; change: number }> = [];

  // Population affects demand
  const demandMultiplier = 1 + (population / 200); // 100 pop = 1.5x demand

  for (const resource of resources) {
    const config = RESOURCE_TYPES[resource.resourceType as keyof typeof RESOURCE_TYPES];
    if (!config) continue;

    // Production: base + random variation, modified by buildings
    const buildingBonus = await getBuildingBonus(worldId, resource.resourceType);
    const production = resource.productionRate + Math.floor(Math.random() * 5) + buildingBonus;

    // Consumption: scales with population
    const consumption = Math.floor(resource.consumptionRate * demandMultiplier);

    // Update supply
    const newSupply = Math.max(0, resource.supply + production - consumption);

    // Price: based on supply/demand ratio
    const oldPrice = resource.price;
    const supplyDemandRatio = newSupply / Math.max(resource.demand, 1);
    let newPrice = config.basePrice;

    if (supplyDemandRatio > 2) {
      newPrice = Math.floor(config.basePrice * 0.6); // oversupply → cheap
    } else if (supplyDemandRatio > 1.5) {
      newPrice = Math.floor(config.basePrice * 0.8);
    } else if (supplyDemandRatio > 1.0) {
      newPrice = config.basePrice;
    } else if (supplyDemandRatio > 0.5) {
      newPrice = Math.floor(config.basePrice * 1.5); // shortage → expensive
    } else {
      newPrice = Math.floor(config.basePrice * 2.5); // severe shortage
    }

    // Smooth price change (max 30% per tick)
    const maxChange = Math.floor(oldPrice * 0.3);
    newPrice = Math.max(oldPrice - maxChange, Math.min(oldPrice + maxChange, newPrice));

    // Update price history
    const history = JSON.parse(resource.priceHistory);
    history.push({ tick: tickNumber, price: newPrice });
    if (history.length > 30) history.shift();

    await db.civilizationResourceRecord.update({
      where: { id: resource.id },
      data: {
        supply: newSupply,
        demand: Math.floor(resource.demand * demandMultiplier),
        price: newPrice,
        priceHistory: JSON.stringify(history),
        lastTickUpdated: tickNumber,
      },
    });

    if (newPrice !== oldPrice) {
      priceChanges.push({
        resource: resource.resourceType,
        oldPrice,
        newPrice,
        change: Math.round(((newPrice - oldPrice) / oldPrice) * 100),
      });
    }
  }

  // Process active trade routes
  await processTradeRoutes(worldId, tickNumber);

  return { priceChanges };
}

// ─── Building Bonus ────────────────────────────────────────────────────────

async function getBuildingBonus(worldId: string, resourceType: string): Promise<number> {
  const buildings = await db.civilizationBuildingRecord.findMany({
    where: { worldId, status: 'ACTIVE' },
  });

  let bonus = 0;
  for (const building of buildings) {
    const modifiers = JSON.parse(building.economicModifier);
    if (modifiers[resourceType]) bonus += modifiers[resourceType];
    if (modifiers.all) bonus += modifiers.all;
  }
  return bonus;
}

// ─── Market Transactions ───────────────────────────────────────────────────

export async function executeMarketTransaction(params: {
  worldId: string;
  worldName: string;
  resourceType: string;
  action: 'buy' | 'sell';
  quantity: number;
  userId: string;
  tickNumber?: number;
}): Promise<{ ok: boolean; totalPrice: number; error?: string }> {
  const resource = await db.civilizationResourceRecord.findUnique({
    where: { worldId_resourceType: { worldId: params.worldId, resourceType: params.resourceType } },
  });
  if (!resource) return { ok: false, totalPrice: 0, error: 'Resource not found' };

  const totalPrice = resource.price * params.quantity;

  if (params.action === 'buy') {
    if (resource.supply < params.quantity) {
      return { ok: false, totalPrice: 0, error: 'Insufficient supply' };
    }
    // Decrease supply, increase price (demand-driven)
    const newSupply = resource.supply - params.quantity;
    const priceIncrease = Math.floor(resource.price * 0.05); // 5% price increase per transaction
    await db.civilizationResourceRecord.update({
      where: { id: resource.id },
      data: {
        supply: newSupply,
        price: resource.price + priceIncrease,
      },
    });
  } else {
    // Selling: increase supply, decrease price
    const newSupply = resource.supply + params.quantity;
    const priceDecrease = Math.floor(resource.price * 0.03);
    await db.civilizationResourceRecord.update({
      where: { id: resource.id },
      data: {
        supply: newSupply,
        price: Math.max(10, resource.price - priceDecrease),
      },
    });
  }

  // Record transaction
  await db.civilizationMarketRecord.create({
    data: {
      worldId: params.worldId,
      worldName: params.worldName,
      resourceType: params.resourceType,
      action: params.action,
      quantity: params.quantity,
      pricePerUnit: resource.price,
      totalValue: totalPrice,
      buyerId: params.action === 'buy' ? params.userId : params.worldId,
      sellerId: params.action === 'sell' ? params.userId : params.worldId,
      tickNumber: params.tickNumber,
    },
  });

  // Update player contribution
  await updatePlayerContribution(params.userId, params.worldId, totalPrice);

  return { ok: true, totalPrice };
}

export async function getMarketHistory(worldId: string, limit = 20): Promise<any[]> {
  const transactions = await db.civilizationMarketRecord.findMany({
    where: { worldId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return transactions.map((t) => ({
    id: t.id,
    resourceType: t.resourceType,
    action: t.action,
    quantity: t.quantity,
    pricePerUnit: t.pricePerUnit,
    totalValue: t.totalValue,
    tickNumber: t.tickNumber,
    createdAt: t.createdAt.getTime(),
  }));
}

// ─── Trade Routes ──────────────────────────────────────────────────────────

export async function createTradeRoute(params: {
  fromWorldId: string;
  fromWorldName: string;
  toWorldId: string;
  toWorldName: string;
  resourceType: string;
  quantity?: number;
}): Promise<{ routeId: string }> {
  const resource = await db.civilizationResourceRecord.findUnique({
    where: { worldId_resourceType: { worldId: params.fromWorldId, resourceType: params.resourceType } },
  });

  const route = await db.tradeRouteRecord.create({
    data: {
      fromWorldId: params.fromWorldId,
      fromWorldName: params.fromWorldName,
      toWorldId: params.toWorldId,
      toWorldName: params.toWorldName,
      resourceType: params.resourceType,
      quantity: params.quantity ?? 10,
      pricePerUnit: resource?.price ?? 100,
    },
  });

  return { routeId: route.id };
}

export async function getTradeRoutes(worldId: string): Promise<any[]> {
  const routes = await db.tradeRouteRecord.findMany({
    where: { OR: [{ fromWorldId: worldId }, { toWorldId: worldId }], status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  return routes.map((r) => ({
    id: r.id,
    fromWorldName: r.fromWorldName,
    toWorldName: r.toWorldName,
    resourceType: r.resourceType,
    quantity: r.quantity,
    pricePerUnit: r.pricePerUnit,
    totalGenerated: r.totalGenerated,
    ticksActive: r.ticksActive,
    perTickValue: r.quantity * r.pricePerUnit,
    status: r.status,
    createdAt: r.createdAt.getTime(),
  }));
}

async function processTradeRoutes(worldId: string, tickNumber: number): Promise<void> {
  const routes = await db.tradeRouteRecord.findMany({
    where: { fromWorldId: worldId, status: 'ACTIVE' },
  });

  for (const route of routes) {
    const perTickValue = route.quantity * route.pricePerUnit;

    // Deduct from source world's supply
    const sourceResource = await db.civilizationResourceRecord.findUnique({
      where: { worldId_resourceType: { worldId: route.fromWorldId, resourceType: route.resourceType } },
    });
    if (sourceResource && sourceResource.supply >= route.quantity) {
      await db.civilizationResourceRecord.update({
        where: { id: sourceResource.id },
        data: { supply: { decrement: route.quantity } },
      });

      // Add to destination world's supply
      const destResource = await db.civilizationResourceRecord.findUnique({
        where: { worldId_resourceType: { worldId: route.toWorldId, resourceType: route.resourceType } },
      });
      if (destResource) {
        await db.civilizationResourceRecord.update({
          where: { id: destResource.id },
          data: { supply: { increment: route.quantity } },
        });
      } else {
        // Create resource for destination world
        const config = RESOURCE_TYPES[route.resourceType as keyof typeof RESOURCE_TYPES];
        if (config) {
          await db.civilizationResourceRecord.create({
            data: {
              worldId: route.toWorldId,
              worldName: route.toWorldName,
              resourceType: route.resourceType,
              supply: route.quantity,
              price: route.pricePerUnit,
            },
          });
        }
      }
    }

    // Update route stats
    await db.tradeRouteRecord.update({
      where: { id: route.id },
      data: {
        totalGenerated: { increment: perTickValue },
        ticksActive: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }
}

// ─── Buildings ─────────────────────────────────────────────────────────────

const BUILDING_TYPES: Record<string, { name: string; icon: string; modifiers: Record<string, number>; minPop: number }> = {
  townhall: { name: 'Town Hall', icon: '🏛️', modifiers: { all: 2 }, minPop: 0 },
  farm: { name: 'Farm', icon: '🌾', modifiers: { food: 10 }, minPop: 10 },
  market: { name: 'Market', icon: '🏪', modifiers: { all: 3, culture: 5 }, minPop: 20 },
  mine: { name: 'Mine', icon: '⛏️', modifiers: { metal: 8 }, minPop: 30 },
  library: { name: 'Library', icon: '📚', modifiers: { knowledge: 10 }, minPop: 40 },
  temple: { name: 'Temple', icon: '⛩️', modifiers: { culture: 12 }, minPop: 50 },
  barracks: { name: 'Barracks', icon: '🏰', modifiers: { all: 1, metal: 3 }, minPop: 60 },
  port: { name: 'Trade Port', icon: '⚓', modifiers: { all: 5 }, minPop: 80 },
  monument: { name: 'Monument', icon: '🗿', modifiers: { culture: 20, all: 2 }, minPop: 100 },
  district: { name: 'New District', icon: '🏘️', modifiers: { all: 3, food: 5 }, minPop: 150 },
};

export async function initializeBuildings(worldId: string, worldName: string): Promise<void> {
  const existing = await db.civilizationBuildingRecord.findFirst({ where: { worldId } });
  if (existing) return;

  // Start with a Town Hall
  await db.civilizationBuildingRecord.create({
    data: {
      worldId,
      worldName,
      name: 'Town Hall',
      type: 'townhall',
      icon: '🏛️',
      level: 1,
      economicModifier: JSON.stringify(BUILDING_TYPES.townhall.modifiers),
      builtAtTick: 0,
      builtBy: 'system',
    },
  });
}

export async function getBuildings(worldId: string): Promise<any[]> {
  const buildings = await db.civilizationBuildingRecord.findMany({
    where: { worldId, status: 'ACTIVE' },
    orderBy: { builtAtTick: 'asc' },
  });
  return buildings.map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type,
    icon: b.icon,
    level: b.level,
    economicModifier: JSON.parse(b.economicModifier),
    builtAtTick: b.builtAtTick,
    builtBy: b.builtBy,
    createdAt: b.createdAt.getTime(),
  }));
}

export async function buildBuilding(params: {
  worldId: string;
  worldName: string;
  type: string;
  tickNumber: number;
  builtBy: string;
}): Promise<{ buildingId: string; error?: string }> {
  const config = BUILDING_TYPES[params.type];
  if (!config) return { buildingId: '', error: 'Unknown building type' };

  // Check if world has enough population
  const identity = await db.worldIdentityRecord.findUnique({ where: { worldId: params.worldId } });
  if (!identity) return { buildingId: '', error: 'World not found' };
  if (identity.population < config.minPop) {
    return { buildingId: '', error: `Requires ${config.minPop} population (currently ${identity.population})` };
  }

  const building = await db.civilizationBuildingRecord.create({
    data: {
      worldId: params.worldId,
      worldName: params.worldName,
      name: config.name,
      type: params.type,
      icon: config.icon,
      level: 1,
      economicModifier: JSON.stringify(config.modifiers),
      builtAtTick: params.tickNumber,
      builtBy: params.builtBy,
    },
  });

  return { buildingId: building.id };
}

export async function checkBuildingUnlocks(worldId: string, worldName: string, population: number, tickNumber: number): Promise<string[]> {
  const unlocked: string[] = [];
  const existing = await db.civilizationBuildingRecord.findMany({ where: { worldId } });
  const existingTypes = new Set(existing.map((b) => b.type));

  for (const [type, config] of Object.entries(BUILDING_TYPES)) {
    if (existingTypes.has(type)) continue;
    if (population >= config.minPop) {
      await buildBuilding({ worldId, worldName, type, tickNumber, builtBy: 'system' });
      unlocked.push(type);
    }
  }

  return unlocked;
}

export function getAvailableBuildings(): any[] {
  return Object.entries(BUILDING_TYPES).map(([type, config]) => ({
    type,
    name: config.name,
    icon: config.icon,
    modifiers: config.modifiers,
    minPop: config.minPop,
  }));
}

// ─── Player Roles ──────────────────────────────────────────────────────────

export async function getPlayerRole(userId: string, worldId: string): Promise<any | null> {
  const role = await db.playerRoleRecord.findUnique({
    where: { userId_worldId: { userId, worldId } },
  });
  if (!role) return null;
  return {
    id: role.id,
    role: role.role,
    specialty: role.specialty,
    contribution: role.contribution,
    influenceInWorld: role.influenceInWorld,
    joinedAt: role.joinedAt.getTime(),
  };
}

export async function updatePlayerRole(userId: string, worldId: string, worldName: string, displayName: string): Promise<void> {
  const existing = await db.playerRoleRecord.findUnique({
    where: { userId_worldId: { userId, worldId } },
  });

  if (!existing) {
    // New: start as visitor
    await db.playerRoleRecord.create({
      data: { userId, displayName, worldId, worldName, role: 'visitor' },
    });
  } else {
    // Check for role promotion based on contribution
    let newRole = existing.role;
    if (existing.contribution > 1_000_000 && existing.role === 'visitor') {
      newRole = 'citizen';
    } else if (existing.contribution > 5_000_000 && existing.role === 'citizen') {
      newRole = 'specialist';
      // Assign specialty based on dominant activity
      const specialty = determineSpecialty(existing.contribution);
      await db.playerRoleRecord.update({
        where: { id: existing.id },
        data: { role: newRole, specialty },
      });
      return;
    } else if (existing.contribution > 20_000_000 && existing.role === 'specialist') {
      newRole = 'guild_member';
    } else if (existing.contribution > 50_000_000 && existing.role === 'guild_member') {
      newRole = 'leader';
    }

    if (newRole !== existing.role) {
      await db.playerRoleRecord.update({
        where: { id: existing.id },
        data: { role: newRole },
      });
    }
  }
}

function determineSpecialty(contribution: number): string {
  // Simple: rotate based on contribution ranges (in production, track actual activity types)
  const specialties = ['trading', 'farming', 'building', 'exploration', 'governance'];
  return specialties[Math.floor(contribution / 5_000_000) % specialties.length];
}

async function updatePlayerContribution(userId: string, worldId: string, amount: number): Promise<void> {
  const existing = await db.playerRoleRecord.findUnique({
    where: { userId_worldId: { userId, worldId } },
  });

  if (existing) {
    await db.playerRoleRecord.update({
      where: { id: existing.id },
      data: {
        contribution: { increment: amount },
        influenceInWorld: { increment: Math.floor(amount / 100_000) },
      },
    });
    // Check for promotion
    await updatePlayerRole(userId, worldId, existing.worldName ?? '', '');
  }
}

export async function getPlayerRoles(userId: string): Promise<any[]> {
  const roles = await db.playerRoleRecord.findMany({
    where: { userId },
    orderBy: { contribution: 'desc' },
  });
  return roles.map((r) => ({
    id: r.id,
    worldId: r.worldId,
    worldName: r.worldName,
    role: r.role,
    specialty: r.specialty,
    contribution: r.contribution,
    influenceInWorld: r.influenceInWorld,
    joinedAt: r.joinedAt.getTime(),
  }));
}
