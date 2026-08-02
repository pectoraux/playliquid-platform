'use client';

import { useState, useEffect } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { useExperiences } from '@/hooks/use-studio';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Coins, Trophy, Package, Users, Loader2, Zap,
  Sparkles, TrendingUp, Play, Gift, Crown,
} from 'lucide-react';
import { toast } from 'sonner';

const MICRO = 1_000_000;

export function AdrEconomy() {
  const { setView } = useStudioStore();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('universe')} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Liquid Economy</h1>
              <p className="text-[10px] text-muted-foreground">ADR-006/007/008/009 aligned</p>
            </div>
            <Button size="sm" onClick={() => setView('competitive')} className="ml-auto h-8 bg-emerald-500 hover:bg-emerald-600 text-white">
              <Trophy className="w-3.5 h-3.5" /> Competitive Play
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4">
        <Tabs defaultValue="wallet">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 max-w-2xl">
            <TabsTrigger value="wallet" className="text-xs gap-1.5"><Coins className="w-3.5 h-3.5" /> Wallet</TabsTrigger>
            <TabsTrigger value="minutes" className="text-xs gap-1.5"><Zap className="w-3.5 h-3.5" /> Minutes</TabsTrigger>
            <TabsTrigger value="prizes" className="text-xs gap-1.5"><Trophy className="w-3.5 h-3.5" /> Prizes</TabsTrigger>
            <TabsTrigger value="tournaments" className="text-xs gap-1.5"><Crown className="w-3.5 h-3.5" /> Tournaments</TabsTrigger>
            <TabsTrigger value="highlights" className="text-xs gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Highlights</TabsTrigger>
          </TabsList>
          <TabsContent value="wallet" className="mt-4"><WalletTab /></TabsContent>
          <TabsContent value="minutes" className="mt-4"><MinutesTab /></TabsContent>
          <TabsContent value="prizes" className="mt-4"><PrizesTab /></TabsContent>
          <TabsContent value="tournaments" className="mt-4"><TournamentsTab /></TabsContent>
          <TabsContent value="highlights" className="mt-4"><HighlightsTab /></TabsContent>
        </Tabs>
      </main>
      <footer className="mt-auto border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground text-center">
        PlayLiquid ADR Economy — 1 Liquid = 1 XOF · Purchased value only · Players earn through competition
      </footer>
    </div>
  );
}

function WalletTab() {
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseAmount, setPurchaseAmount] = useState('100');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/economy/wallet?userId=demo-user');
      const data = await res.json();
      setWallet(data.wallet);
      setLoading(false);
    })();
  }, []);

  const handlePurchase = async () => {
    const amountXof = parseInt(purchaseAmount) * MICRO;
    const res = await fetch('/api/economy/purchase', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo-user', amountXof, paymentProvider: 'payswap' }),
    });
    const data = await res.json();
    if (data.status === 'COMPLETED') {
      toast.success(`Purchased ${purchaseAmount} Liquid!`, { description: 'Added to wallet via PaySwap' });
      const res2 = await fetch('/api/economy/wallet?userId=demo-user');
      const data2 = await res2.json();
      setWallet(data2.wallet);
    } else { toast.error('Purchase failed'); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-300">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs text-muted-foreground">Liquid Balance</div>
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                {(wallet?.balanceLiquid ?? 0).toFixed(2)}<span className="text-lg ml-1">L</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">1 Liquid = 1 XOF</div>
            </div>
            <Coins className="w-8 h-8 text-amber-500/40" />
          </div>
          <Separator className="my-3" />
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{(wallet?.totalPurchased ?? 0) / MICRO}L</div><div className="text-[9px] text-muted-foreground">Purchased</div></div>
            <div><div className="text-sm font-bold text-red-500">{(wallet?.totalSpent ?? 0) / MICRO}L</div><div className="text-[9px] text-muted-foreground">Spent</div></div>
            <div><div className="text-sm font-bold text-amber-500">{(wallet?.totalWon ?? 0) / MICRO}L</div><div className="text-[9px] text-muted-foreground">Won</div></div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Purchase Liquid</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input type="number" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value)} className="h-8" placeholder="Amount in Liquid" />
            <Button onClick={handlePurchase} className="bg-amber-500 hover:bg-amber-600 text-white h-8">Buy via PaySwap</Button>
          </div>
          <p className="text-[10px] text-muted-foreground">This is the ONLY way Liquid enters circulation. Liquid is purchased value, not minted as rewards.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function MinutesTab() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/economy/minutes?userId=demo-user');
      const data = await res.json();
      setPurchases(data.purchases ?? []);
      setLoading(false);
    })();
  }, []);
  return (
    <div className="space-y-3">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Purchased Minutes</CardTitle><CardDescription className="text-xs">Buy competitive play time. Revenue splits to platform/creator/prize pool.</CardDescription></CardHeader></Card>
      <div className="space-y-1">
        {loading ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div> :
         purchases.length === 0 ? <Card><CardContent className="py-4 text-center"><p className="text-sm text-muted-foreground">No minute purchases yet. Buy minutes for a competitive experience!</p></CardContent></Card> :
         purchases.map((p: any) => (
           <Card key={p.id}><CardContent className="p-2 flex items-center gap-3">
             <Zap className="w-4 h-4 text-amber-500 shrink-0" />
             <div className="flex-1 min-w-0"><div className="text-xs font-medium truncate">{p.experienceName}</div><div className="text-[10px] text-muted-foreground">{p.minutesRemaining} min remaining of {p.minutesPurchased}</div></div>
             <Badge variant="outline" className="text-[8px] h-3.5">{p.status}</Badge>
             <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">{p.totalPaidXof / MICRO}L</span>
           </CardContent></Card>
         ))}
      </div>
    </div>
  );
}

function PrizesTab() {
  const { data: expData } = useExperiences();
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!expData) return;
    (async () => {
      const exps = expData.experiences ?? [];
      const results: any[] = [];
      for (const exp of exps.slice(0, 5)) {
        const res = await fetch(`/api/economy/prize-pool?experienceId=${exp.id}`);
        const data = await res.json();
        results.push({ name: exp.title, pool: data.prizePool });
      }
      setPools(results);
      setLoading(false);
    })();
  }, [expData]);
  return (
    <div className="space-y-3">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Prize Pools</CardTitle><CardDescription className="text-xs">50% of competitive revenue accumulates in prize pools. Top 3 earn Liquid.</CardDescription></CardHeader></Card>
      {loading ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div> :
       pools.map((data: any, i: number) => (
         <Card key={i}><CardContent className="p-3">
           <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">{data.name}</span><Badge className="bg-amber-500 text-white">{((data.pool?.currentBalance ?? 0) / MICRO)}L</Badge></div>
           <div className="grid grid-cols-3 gap-2 text-[10px]">
             <div className="p-1.5 rounded border border-border"><div className="text-muted-foreground">🥇 1st</div><div className="font-mono font-semibold">{(data.pool?.config?.firstPlaceBps ?? 2500) / 100}%</div></div>
             <div className="p-1.5 rounded border border-border"><div className="text-muted-foreground">🥈 2nd</div><div className="font-mono font-semibold">{(data.pool?.config?.secondPlaceBps ?? 1500) / 100}%</div></div>
             <div className="p-1.5 rounded border border-border"><div className="text-muted-foreground">🥉 3rd</div><div className="font-mono font-semibold">{(data.pool?.config?.thirdPlaceBps ?? 1000) / 100}%</div></div>
           </div>
         </CardContent></Card>
       ))}
    </div>
  );
}

function TournamentsTab() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/economy/tournaments');
      const data = await res.json();
      setTournaments(data.tournaments ?? []);
      setLoading(false);
    })();
  }, []);
  return (
    <div className="space-y-3">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> Tournaments</CardTitle><CardDescription className="text-xs">Multi-experience team competitions with prize pools</CardDescription></CardHeader></Card>
      {loading ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div> :
       tournaments.length === 0 ? <Card><CardContent className="py-6 text-center"><Crown className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">No tournaments yet</p><p className="text-xs text-muted-foreground mt-1">Tournaments are separate from games — teams compete across multiple experiences</p></CardContent></Card> :
       tournaments.map((t: any) => (
         <Card key={t.id}><CardContent className="p-3">
           <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium">{t.name}</span><Badge variant="outline" className="text-[9px] h-4">{t.status}</Badge></div>
           <p className="text-[10px] text-muted-foreground">{t.description}</p>
           <div className="flex items-center gap-3 mt-1 text-[10px]"><span className="text-amber-600 dark:text-amber-400">Prize: {t.prizePoolLiquid}L</span><span>·</span><span>{t.maxTeamSize} per team</span><span>·</span><span>{t.admissionType}</span></div>
         </CardContent></Card>
       ))}
    </div>
  );
}

function HighlightsTab() {
  const [highlights, setHighlights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/economy/highlights');
      const data = await res.json();
      setHighlights(data.highlights ?? []);
      setLoading(false);
    })();
  }, []);
  return (
    <div className="space-y-3">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> Highlights</CardTitle><CardDescription className="text-xs">AI-generated clips from exceptional gameplay moments</CardDescription></CardHeader></Card>
      {loading ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div> :
       highlights.length === 0 ? <Card><CardContent className="py-6 text-center"><Sparkles className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">No highlights yet</p><p className="text-xs text-muted-foreground mt-1">Play competitively to generate highlights from leaderboard firsts, world records, and exceptional moments</p></CardContent></Card> :
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
         {highlights.map((h: any) => (
           <Card key={h.id}><CardContent className="p-3">
             <div className="flex items-start gap-2"><span className="text-2xl">{h.triggerIcon}</span>
               <div className="flex-1 min-w-0"><div className="text-xs font-medium truncate">{h.title}</div><p className="text-[10px] text-muted-foreground line-clamp-2">{h.description}</p>
                 <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground"><span>{h.displayName}</span><span>·</span><span>Score: {h.scoreAtHighlight}</span><span>·</span><span>{h.viewCount} views</span></div>
               </div>
             </div>
           </CardContent></Card>
         ))}
       </div>}
    </div>
  );
}
