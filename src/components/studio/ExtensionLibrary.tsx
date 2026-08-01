'use client';

import { useExtensions } from '@/hooks/use-kernel';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Boxes } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { ExtensionManifest } from '@/kernel/types';

const CATEGORY_COLORS: Record<string, string> = {
  PHYSICS: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  MECHANIC: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  ECONOMY: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  AI: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  SOCIAL: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  RENDER: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
};

const CATEGORIES = ['ALL', 'PHYSICS', 'MECHANIC', 'ECONOMY', 'SOCIAL', 'RENDER'];

interface Props {
  onAddExtension: (manifest: ExtensionManifest) => void;
}

export function ExtensionLibrary({ onAddExtension }: Props) {
  const { data: extData } = useExtensions();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');

  const filtered = useMemo(() => {
    const all = extData?.extensions ?? [];
    return all.filter((ext: any) => {
      if (category !== 'ALL' && ext.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          ext.name.toLowerCase().includes(q) ||
          ext.description.toLowerCase().includes(q) ||
          ext.tags?.some((t: string) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [extData, search, category]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <Boxes className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Extension Library</span>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search extensions..."
            className="h-7 pl-8 text-xs"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                category === c
                  ? 'bg-amber-500 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No extensions found</p>
          ) : (
            filtered.map((ext: any) => (
              <button
                key={ext.id}
                onClick={() => onAddExtension(ext)}
                className="w-full text-left p-2 rounded-lg border border-border hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all group cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-start gap-2">
                  <span className="text-xl">{ext.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium truncate">{ext.name}</span>
                      <Badge className={`text-[8px] h-3.5 px-1 shrink-0 ${CATEGORY_COLORS[ext.category] ?? ''}`}>
                        {ext.category}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{ext.description}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {ext.outputs?.length > 0 && (
                        <span className="text-[8px] text-emerald-600 dark:text-emerald-400">
                          {ext.outputs.length} out
                        </span>
                      )}
                      {ext.inputs?.length > 0 && (
                        <span className="text-[8px] text-blue-600 dark:text-blue-400">
                          {ext.inputs.length} in
                        </span>
                      )}
                      {ext.tokenDefinitions?.length > 0 && (
                        <span className="text-[8px] text-amber-600 dark:text-amber-400">
                          {ext.tokenDefinitions.map((t: any) => t.symbol).join(',')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
