'use client';

import { useCreatorProfile, useExperiences } from '@/hooks/use-studio';
import { useStudioStore } from '@/stores/studio-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Gamepad2, Boxes, GitFork, Coins, Clock } from 'lucide-react';

export function CreatorProfile() {
  const { data } = useCreatorProfile();
  const { data: expData } = useExperiences();
  const { setView } = useStudioStore();

  const profile = data?.profile;
  if (!profile) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  const experiences = (expData?.experiences ?? []).filter((e: any) => e.creatorId === profile.id);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Button onClick={() => setView('home-v3')} variant="ghost" size="sm" className="mb-4 h-8">
        <ArrowLeft className="w-4 h-4" /> Back to Studio
      </Button>

      {/* Profile header */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="bg-amber-500 text-white text-xl font-bold">
                {profile.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{profile.displayName}</h1>
              <p className="text-sm text-muted-foreground">@{profile.handle}</p>
              {profile.bio && <p className="text-sm mt-2">{profile.bio}</p>}
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold">{profile.followers}</span>
                  <span className="text-muted-foreground text-xs">followers</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Gamepad2} label="Experiences" value={profile.experienceCount} color="text-violet-500" />
        <StatCard icon={GitFork} label="Forks" value={profile.forkCount} color="text-emerald-500" />
        <StatCard icon={Coins} label="Liquid Earned" value={`${(profile.totalLiquid / 1_000_000).toFixed(1)}`} color="text-amber-500" />
        <StatCard icon={Clock} label="Player Hours" value={`${Math.floor(profile.playerHours / 3600)}h`} color="text-blue-500" />
      </div>

      {/* Creator's experiences */}
      <h2 className="text-lg font-semibold mb-3">Published Experiences</h2>
      {experiences.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No published experiences yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {experiences.map((exp: any) => (
            <Card key={exp.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{exp.title}</span>
                    {exp.parentExperienceId && (
                      <Badge variant="outline" className="text-[9px] h-4">
                        <GitFork className="w-2.5 h-2.5 mr-0.5" /> fork
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{exp.description.slice(0, 80)}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span>{exp.playCount} plays</span>
                  <span>{exp.forkCount} forks</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className="text-lg font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

import { Users } from 'lucide-react';
