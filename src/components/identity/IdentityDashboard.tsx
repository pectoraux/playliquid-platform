'use client';

import { useState } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import {
  usePlayerIdentity, useCompanionInsight, useChatWithCompanion,
  useCompanionMessages, useAchievements, useCheckAchievements,
  useInventory, useWorldPassport,
} from '@/hooks/use-identity';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, User, Sparkles, Trophy, Package, Globe, Star,
  Send, Loader2, Bot, TrendingUp, Award, Zap, Heart, Coins,
} from 'lucide-react';
import { toast } from 'sonner';

const RARITY_COLORS: Record<string, string> = {
  common: 'border-slate-300 bg-slate-50 dark:bg-slate-900',
  rare: 'border-blue-300 bg-blue-50 dark:bg-blue-950/30',
  epic: 'border-purple-300 bg-purple-50 dark:bg-purple-950/30',
  legendary: 'border-amber-300 bg-amber-50 dark:bg-amber-950/30',
  mythic: 'border-rose-300 bg-rose-50 dark:bg-rose-950/30',
};

export function IdentityDashboard() {
  const { setView } = useStudioStore();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('universe')} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Player Identity</h1>
              <p className="text-[10px] text-muted-foreground">Your persistent self in the PlayLiquid universe</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4">
        <IdentityOverview />

        <Tabs defaultValue="companion" className="mt-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 max-w-2xl">
            <TabsTrigger value="companion" className="text-xs gap-1.5"><Bot className="w-3.5 h-3.5" /> AI Companion</TabsTrigger>
            <TabsTrigger value="achievements" className="text-xs gap-1.5"><Trophy className="w-3.5 h-3.5" /> Achievements</TabsTrigger>
            <TabsTrigger value="inventory" className="text-xs gap-1.5"><Package className="w-3.5 h-3.5" /> Inventory</TabsTrigger>
            <TabsTrigger value="passport" className="text-xs gap-1.5"><Globe className="w-3.5 h-3.5" /> Passport</TabsTrigger>
            <TabsTrigger value="reputation" className="text-xs gap-1.5"><Star className="w-3.5 h-3.5" /> Reputation</TabsTrigger>
          </TabsList>

          <TabsContent value="companion" className="mt-4"><CompanionTab /></TabsContent>
          <TabsContent value="achievements" className="mt-4"><AchievementsTab /></TabsContent>
          <TabsContent value="inventory" className="mt-4"><InventoryTab /></TabsContent>
          <TabsContent value="passport" className="mt-4"><PassportTab /></TabsContent>
          <TabsContent value="reputation" className="mt-4"><ReputationTab /></TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid Identity Layer v0.45 — You are a citizen, not an account
      </footer>
    </div>
  );
}

// ─── Overview ──────────────────────────────────────────────────────────────

function IdentityOverview() {
  const { data, isLoading } = usePlayerIdentity();
  const identity = data?.identity;

  if (isLoading || !identity) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-300">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="w-16 h-16">
            <AvatarFallback className="bg-indigo-500 text-white text-xl font-bold">
              {identity.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">{identity.displayName}</h2>
              <Badge className="bg-indigo-500 text-white">Level {identity.level}</Badge>
            </div>
            {identity.bio && <p className="text-xs text-muted-foreground mt-0.5">{identity.bio}</p>}

            {/* XP Progress */}
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-muted-foreground">XP: {identity.xp} / {identity.xpToNextLevel}</span>
                <span className="text-muted-foreground">{Math.round(identity.xp / identity.xpToNextLevel * 100)}%</span>
              </div>
              <Progress value={identity.xp / identity.xpToNextLevel * 100} className="h-1.5" />
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-4 gap-2 mt-3">
              <QuickStat label="Sessions" value={identity.totalSessions} icon={Zap} />
              <QuickStat label="Achievements" value={identity.achievements.length} icon={Trophy} />
              <QuickStat label="Worlds" value={identity.worldPassport.totalWorldsVisited} icon={Globe} />
              <QuickStat label="Liquid" value={`${(identity.liquidBalance / 1_000_000).toFixed(1)}`} icon={Coins} />
            </div>
          </div>
        </div>

        {/* Top skills */}
        {Object.keys(identity.skills).length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground uppercase">Skills:</span>
            {Object.entries(identity.skills)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .slice(0, 4)
              .map(([skill, value]) => (
                <Badge key={skill} variant="outline" className="text-[9px] h-4">
                  {skill} {value as number}
                </Badge>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickStat({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3 text-indigo-500" />
      <div>
        <div className="text-xs font-bold">{value}</div>
        <div className="text-[9px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

// ─── AI Companion Tab ──────────────────────────────────────────────────────

function CompanionTab() {
  const { data: insightData } = useCompanionInsight();
  const { data: msgData } = useCompanionMessages();
  const chat = useChatWithCompanion();
  const [message, setMessage] = useState('');

  const messages = msgData?.messages ?? [];

  const handleSend = async () => {
    if (!message.trim()) return;
    const msg = message;
    setMessage('');
    try {
      await chat.mutateAsync({ userId: 'demo-user', message: msg });
    } catch (e) {
      toast.error('Chat failed', { description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-3">
      {/* Proactive Insight */}
      {insightData && (
        <Card className="bg-gradient-to-r from-amber-50 to-rose-50 dark:from-amber-950/30 dark:to-rose-950/30 border-amber-300">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <Bot className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase mb-1">AI Companion Insight</div>
                <p className="text-sm">{insightData.insight}</p>
                {insightData.suggestions?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {insightData.suggestions.map((s: string, i: number) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Bot className="w-4 h-4" /> Chat with your Companion</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 rounded border border-border p-2 mb-2">
            <div className="space-y-2">
              {messages.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Say hello to your AI companion!</p>
              ) : (
                messages.map((msg: any) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-2 rounded-lg text-xs ${
                      msg.role === 'user'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-muted text-foreground'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {chat.isPending && (
                <div className="flex justify-start">
                  <div className="bg-muted p-2 rounded-lg text-xs">
                    <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> thinking...
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask your companion anything..."
              className="h-8 text-xs"
            />
            <Button size="sm" onClick={handleSend} disabled={chat.isPending || !message.trim()} className="h-8">
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Achievements Tab ──────────────────────────────────────────────────────

function AchievementsTab() {
  const { data } = useAchievements('demo-user');
  const check = useCheckAchievements();

  const catalog = data?.catalog ?? [];
  const earned = data?.earned ?? [];
  const earnedIds = new Set(earned.map((e: any) => e.achievementId));

  const handleCheck = async () => {
    try {
      const result = await check.mutateAsync('demo-user');
      if (result.awarded.length > 0) {
        toast.success(`Earned ${result.awarded.length} new achievement(s)!`);
      } else {
        toast.info('No new achievements yet — keep playing!');
      }
    } catch (e) {
      toast.error('Check failed', { description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-3">
      <Button onClick={handleCheck} disabled={check.isPending} size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
        {check.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trophy className="w-3.5 h-3.5" />}
        Check for New Achievements
      </Button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {catalog.map((ach: any) => {
          const isEarned = earnedIds.has(ach.id);
          return (
            <div
              key={ach.id}
              className={`p-3 rounded-lg border-2 ${RARITY_COLORS[ach.rarity] ?? RARITY_COLORS.common} ${
                isEarned ? '' : 'opacity-50 grayscale'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-2xl">{ach.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{ach.title}</span>
                    {isEarned && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{ach.description}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="outline" className="text-[8px] h-3.5 px-1">{ach.category}</Badge>
                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 capitalize">{ach.rarity}</Badge>
                    <span className="text-[9px] text-amber-600 dark:text-amber-400">+{ach.xpReward} XP</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckCircle2({ className }: { className?: string }) {
  return <span className={className}>✓</span>;
}

// ─── Inventory Tab ─────────────────────────────────────────────────────────

function InventoryTab() {
  const { data } = useInventory();
  const inventory = data?.inventory ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4" /> Inventory ({inventory.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {inventory.map((item: any) => (
            <div key={item.id} className={`p-2 rounded-lg border-2 ${RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common}`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{item.name}</div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[8px] h-3 px-1">{item.type}</Badge>
                    {item.quantity > 1 && <span className="text-[9px] text-muted-foreground">x{item.quantity}</span>}
                  </div>
                </div>
              </div>
              {item.description && (
                <p className="text-[9px] text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
              )}
            </div>
          ))}
          {inventory.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-4">
              No items yet. Play Sparks and earn achievements to fill your inventory!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Passport Tab ──────────────────────────────────────────────────────────

function PassportTab() {
  const { data } = useWorldPassport();
  const passport = data?.passport;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4" /> World Passport</CardTitle>
        <CardDescription className="text-xs">Worlds you've visited and your citizenship status</CardDescription>
      </CardHeader>
      <CardContent>
        {passport && passport.visited.length > 0 ? (
          <div className="space-y-2">
            {passport.visited.map((v: any) => (
              <div key={v.worldId} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                <span className="text-xl">🌍</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{v.worldName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Visited {v.visitCount}x · Last: {new Date(v.lastVisitAt).toLocaleDateString()}
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] h-4 capitalize">{v.citizenshipStatus}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            You haven't visited any worlds yet. Explore the Civilization Engine to get your passport stamped!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Reputation Tab ────────────────────────────────────────────────────────

function ReputationTab() {
  const { data } = usePlayerIdentity();
  const rep = data?.identity?.reputation;

  if (!rep) return <p className="text-sm text-muted-foreground">Loading reputation...</p>;

  const dimensions = [
    { label: 'Builder', value: rep.builder, icon: '🔨', color: 'bg-violet-500' },
    { label: 'Trader', value: rep.trader, icon: '💰', color: 'bg-amber-500' },
    { label: 'Explorer', value: rep.explorer, icon: '🧭', color: 'bg-emerald-500' },
    { label: 'Competitor', value: rep.competitor, icon: '⚔️', color: 'bg-rose-500' },
    { label: 'Creator', value: rep.creator, icon: '🎨', color: 'bg-blue-500' },
    { label: 'Social', value: rep.social, icon: '👥', color: 'bg-teal-500' },
    { label: 'Trust', value: rep.trust, icon: '🛡️', color: 'bg-indigo-500' },
    { label: 'Toxicity', value: rep.toxicity, icon: '⚠️', color: 'bg-red-500', invert: true },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Star className="w-4 h-4" /> Reputation Graph</CardTitle>
        <CardDescription className="text-xs">Multi-dimensional reputation across the universe</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {dimensions.map((d) => (
            <div key={d.label} className="flex items-center gap-2">
              <span className="text-lg">{d.icon}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-mono font-semibold">{d.value}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${d.color} ${d.invert ? 'opacity-60' : ''}`}
                    style={{ width: `${d.invert ? 100 - d.value : d.value}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
