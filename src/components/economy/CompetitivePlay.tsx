'use client';

import { useState, useEffect } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { useExperiences } from '@/hooks/use-studio';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Coins, Trophy, Zap, Loader2, Play, Award,
  TrendingUp, Crown, Target, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

const MICRO = 1_000_000;

export function CompetitivePlay() {
  const { setView } = useStudioStore();
  const { data: expData } = useExperiences();
  const [selectedExp, setSelectedExp] = useState<string | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [prizePool, setPrizePool] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [playerRank, setPlayerRank] = useState<any>(null);
  const [minutes, setMinutes] = useState('10');
  const [session, setSession] = useState<any>(null);
  const [scoreInput, setScoreInput] = useState('');
  const [loading, setLoading] = useState(false);

  const experiences = (expData?.experiences ?? []).filter((e: any) => true); // show all for demo

  const loadData = async (expId: string) => {
    setLoading(true);
    const [walletRes, poolRes, lbRes] = await Promise.all([
      fetch('/api/economy/wallet?userId=demo-user'),
      fetch(`/api/economy/prize-pool?experienceId=${expId}`),
      fetch(`/api/competition/leaderboard?experienceId=${expId}&cycle=all-time`),
    ]);
    const [walletData, poolData, lbData] = await Promise.all([
      walletRes.json(), poolRes.json(), lbRes.json(),
    ]);
    setWallet(walletData.wallet);
    setPrizePool(poolData.prizePool);
    setLeaderboard(lbData.leaderboard ?? []);

    const rankRes = await fetch(`/api/competition/leaderboard?experienceId=${expId}&userId=demo-user`);
    const rankData = await rankRes.json();
    setPlayerRank(rankData.rank);
    setLoading(false);
  };

  // Load data when experience changes
  useEffect(() => {
    if (!selectedExp) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [walletRes, poolRes, lbRes] = await Promise.all([
        fetch('/api/economy/wallet?userId=demo-user'),
        fetch(`/api/economy/prize-pool?experienceId=${selectedExp}`),
        fetch(`/api/competition/leaderboard?experienceId=${selectedExp}&cycle=all-time`),
      ]);
      const [walletData, poolData, lbData] = await Promise.all([
        walletRes.json(), poolRes.json(), lbRes.json(),
      ]);
      if (cancelled) return;
      setWallet(walletData.wallet);
      setPrizePool(poolData.prizePool);
      setLeaderboard(lbData.leaderboard ?? []);
      setLoading(false);

      const rankRes = await fetch(`/api/competition/leaderboard?experienceId=${selectedExp}&userId=demo-user`);
      const rankData = await rankRes.json();
      if (!cancelled) setPlayerRank(rankData.rank);
    })();
    return () => { cancelled = true; };
  }, [selectedExp]);

  const handleBuyMinutes = async () => {
    if (!selectedExp) return;
    const exp = experiences.find((e: any) => e.id === selectedExp);
    const pricePerMin = exp?.pricePerMinuteXof ?? MICRO; // default 1 Liquid/min
    const mins = parseInt(minutes);
    const totalXof = mins * pricePerMin;

    // Check wallet
    if ((wallet?.balanceXof ?? 0) < totalXof) {
      toast.error('Insufficient Liquid', { description: `Need ${totalXof / MICRO}L, have ${(wallet?.balanceXof ?? 0) / MICRO}L. Purchase more first.` });
      return;
    }

    const res = await fetch('/api/economy/minutes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo-user', experienceId: selectedExp, minutes: mins }),
    });
    const data = await res.json();
    if (data.error) { toast.error('Purchase failed', { description: data.error }); return; }
    toast.success(`Purchased ${mins} minutes!`, { description: `${totalXof / MICRO}L deducted` });
    loadData(selectedExp);
  };

  const handleStartSession = async () => {
    if (!selectedExp) return;
    // Get active minute purchase
    const minutesRes = await fetch(`/api/economy/minutes?userId=demo-user&experienceId=${selectedExp}`);
    const minutesData = await minutesRes.json();
    const active = minutesData.active;
    if (!active) { toast.error('No active minutes', { description: 'Purchase minutes first' }); return; }

    const res = await fetch('/api/competition/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo-user', experienceId: selectedExp, minutePurchaseId: active.purchaseId }),
    });
    const data = await res.json();
    if (data.error) { toast.error('Session start failed', { description: data.error }); return; }
    setSession({ sessionId: data.sessionId, attempts: 1, highestScore: 0 });
    toast.success('Competitive session started!', { description: 'Timer running. Submit your scores!' });
  };

  const handleSubmitScore = async () => {
    if (!session) return;
    const score = parseInt(scoreInput);
    if (isNaN(score) || score <= 0) { toast.error('Invalid score'); return; }

    const res = await fetch(`/api/competition/session/${session.sessionId}/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    });
    const data = await res.json();
    if (data.error) { toast.error('Submit failed', { description: data.error }); return; }

    setSession({ ...session, highestScore: data.highestScore, attempts: session.attempts + 1 });
    setScoreInput('');
    if (data.newHighest) {
      toast.success(`New high score: ${data.highestScore}!`, { description: `Attempt ${session.attempts + 1}` });
    } else {
      toast.info(`Score ${score} submitted`, { description: `Best remains ${data.highestScore}` });
    }
    // Refresh leaderboard
    if (selectedExp) loadData(selectedExp);
  };

  const handleEndSession = async () => {
    if (!session) return;
    const res = await fetch(`/api/competition/session/${session.sessionId}/end`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (data.error) { toast.error('End failed', { description: data.error }); return; }

    setSession(null);
    toast.success('Session ended!', {
      description: `Final: ${data.highestScore} pts, ${data.attempts} attempts, ${data.minutesUsed} min used. Revenue split processed.`,
    });
    if (selectedExp) loadData(selectedExp);
  };

  const handleSettle = async () => {
    if (!selectedExp) return;
    const res = await fetch('/api/competition/settle', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experienceId: selectedExp }),
    });
    const data = await res.json();
    if (data.error) { toast.error('Settlement failed', { description: data.error }); return; }
    toast.success('Prize pool settled!', {
      description: `${data.payouts?.length || 0} players paid, ${data.totalDistributed / MICRO}L distributed`,
    });
    if (selectedExp) loadData(selectedExp);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('adr-economy')} className="h-8">
            <ArrowLeft className="w-4 h-4" /> Economy
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h1 className="text-sm font-semibold">Competitive Play</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 space-y-4">
        {/* Experience selector */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {experiences.map((exp: any) => (
            <button key={exp.id} onClick={() => { setSelectedExp(exp.id); setSession(null); }}
              className={`px-3 py-1.5 rounded-lg border-2 text-xs shrink-0 ${selectedExp === exp.id ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-border'}`}>
              {exp.title}
            </button>
          ))}
        </div>

        {!selectedExp ? (
          <Card><CardContent className="py-8 text-center"><p className="text-sm text-muted-foreground">Select an experience above</p></CardContent></Card>
        ) : loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <>
            {/* Wallet + Prize Pool */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-300">
                <CardContent className="p-3">
                  <div className="text-[10px] text-muted-foreground">Your Wallet</div>
                  <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{(wallet?.balanceLiquid ?? 0).toFixed(1)}L</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border-purple-300">
                <CardContent className="p-3">
                  <div className="text-[10px] text-muted-foreground">Prize Pool</div>
                  <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{((prizePool?.currentBalance ?? 0) / MICRO).toFixed(1)}L</div>
                </CardContent>
              </Card>
            </div>

            {/* Active Session */}
            {session ? (
              <Card className="border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Competitive Session Active
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><div className="text-lg font-bold">{session.highestScore}</div><div className="text-[9px] text-muted-foreground">Best Score</div></div>
                    <div><div className="text-lg font-bold">{session.attempts}</div><div className="text-[9px] text-muted-foreground">Attempts</div></div>
                    <div><div className="text-lg font-bold text-emerald-600">#?</div><div className="text-[9px] text-muted-foreground">Rank</div></div>
                  </div>
                  <div className="flex gap-2">
                    <Input type="number" value={scoreInput} onChange={(e) => setScoreInput(e.target.value)} placeholder="Enter score..." className="h-8" />
                    <Button onClick={handleSubmitScore} className="bg-emerald-500 hover:bg-emerald-600 text-white h-8">
                      <Target className="w-3.5 h-3.5" /> Submit
                    </Button>
                    <Button onClick={handleEndSession} variant="destructive" className="h-8">End</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Purchase Minutes */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Purchase Competitive Minutes</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex gap-2 items-center">
                      <Input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="h-8 w-24" />
                      <span className="text-xs text-muted-foreground">minutes</span>
                      <Button onClick={handleBuyMinutes} className="bg-amber-500 hover:bg-amber-600 text-white h-8">
                        <Coins className="w-3.5 h-3.5" /> Buy
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Revenue split: 20% platform / 30% creator / 50% prize pool</p>
                  </CardContent>
                </Card>

                {/* Start Session */}
                <Button onClick={handleStartSession} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-10">
                  <Play className="w-4 h-4" /> Start Competitive Session
                </Button>
              </>
            )}

            {/* Leaderboard */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Leaderboard</CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboard.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No entries yet. Be the first!</p>
                ) : (
                  <div className="space-y-1">
                    {leaderboard.slice(0, 10).map((entry: any, i: number) => (
                      <div key={entry.userId} className={`flex items-center gap-2 p-1.5 rounded text-xs ${entry.userId === 'demo-user' ? 'border border-amber-400 bg-amber-50 dark:bg-amber-950/30' : 'border border-border'}`}>
                        <span className={`font-bold w-5 ${i < 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>{i + 1}</span>
                        <span className="flex-1 truncate">{entry.displayName}</span>
                        <span className="font-mono font-semibold">{entry.score}</span>
                      </div>
                    ))}
                  </div>
                )}
                {playerRank && (
                  <div className="mt-2 p-2 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-xs">
                    <span className="font-medium">Your rank: #{playerRank.rank}</span>
                    <span className="text-muted-foreground ml-2">Score: {playerRank.score} · {playerRank.totalPlayers} players</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Settle Prize Pool */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> Prize Settlement</CardTitle>
                <CardDescription className="text-xs">Distribute prize pool to top 3. This is the ONLY way players earn Liquid.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleSettle} variant="outline" className="w-full h-8">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Settle Prize Pool
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1">
                  1st: {(prizePool?.config?.firstPlaceBps ?? 2500) / 100}% · 2nd: {(prizePool?.config?.secondPlaceBps ?? 1500) / 100}% · 3rd: {(prizePool?.config?.thirdPlaceBps ?? 1000) / 100}%
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
