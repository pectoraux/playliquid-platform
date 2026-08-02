'use client';

import { useState } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Menu, Search, Bell, Plus, X, Home as HomeIcon,
  BarChart, Coins, Package, Settings, Library as LibraryIcon,
  Upload, Trophy, Heart, ArrowLeft,
} from 'lucide-react';

interface V3ShellWrapperProps {
  title: string;
  children: React.ReactNode;
  showSearch?: boolean;
}

/**
 * V3 Shell Wrapper
 * ----------------
 * Renders the SAME header as the home page (logo + search + create + 
 * notifications + profile) on all non-home views.
 *
 * This ensures visual consistency across the entire platform.
 */
export function V3ShellWrapper({ title, children, showSearch = true }: V3ShellWrapperProps) {
  const { setView } = useStudioStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      setView('home-v3');
      // The home page will pick up the search from URL or state
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── V3 Global Header (identical to home page) ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-2 px-3 md:px-4 h-14">
          {/* Left: logo */}
          <button
            onClick={() => setView('home-v3')}
            className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
              PL
            </div>
            <span className="text-base font-bold tracking-tight hidden sm:inline">PlayLiquid</span>
          </button>

          {/* Page title (small, muted) */}
          <div className="hidden sm:flex items-center gap-2 ml-2">
            <div className="h-4 w-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium">{title}</span>
          </div>

          {/* Center: search (desktop) */}
          {showSearch && (
            <div className="hidden md:flex flex-1 max-w-2xl mx-auto px-4">
              <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50 focus-within:border-amber-400 transition-colors">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearchSubmit(); }}
                  placeholder="Search experiences, creators, sparks..."
                  className="flex-1 h-6 border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} aria-label="Clear search">
                    <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Spacer for mobile */}
          <div className="flex-1 md:hidden" />

          {/* Right cluster */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Mobile search toggle */}
            {showSearch && (
              <button
                onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
                className="md:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>
            )}

            {/* Create */}
            <Button
              size="sm"
              onClick={() => setView('creator-studio')}
              className="gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 h-9 px-3"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-medium">Create</span>
            </Button>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors" aria-label="Notifications">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="px-3 py-2 text-sm font-medium border-b border-border">Notifications</div>
                {[
                  { icon: Upload, color: 'text-violet-500', text: 'Alex Rivers uploaded a new game', time: '2h ago' },
                  { icon: Trophy, color: 'text-amber-500', text: 'Tournament starts in 30 minutes', time: '30m ago' },
                  { icon: Heart, color: 'text-rose-500', text: 'Your comment got 5 likes', time: '1d ago' },
                  { icon: Coins, color: 'text-emerald-500', text: 'You won 50L in the Neon Runner tournament!', time: '2d ago' },
                ].map((n, i) => (
                  <DropdownMenuItem key={i} className="gap-3 cursor-pointer rounded-md p-2.5">
                    <n.icon className={`w-4 h-4 ${n.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs">{n.text}</div>
                      <div className="text-[10px] text-muted-foreground">{n.time}</div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-9 h-9 rounded-full overflow-hidden hover:ring-2 hover:ring-amber-400 transition-all" aria-label="Open profile menu">
                  <Avatar className="w-9 h-9">
                    <AvatarFallback className="text-[10px] bg-gradient-to-br from-amber-400 to-orange-600 text-white">SD</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2.5 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="w-9 h-9"><AvatarFallback className="text-[10px] bg-gradient-to-br from-amber-400 to-orange-600 text-white">SD</AvatarFallback></Avatar>
                    <div>
                      <div className="text-sm font-medium">Studio Demo Creator</div>
                      <div className="text-[10px] text-muted-foreground">demo@playliquid.io</div>
                    </div>
                  </div>
                </div>
                <DropdownMenuSeparator className="my-0" />
                <DropdownMenuItem className="gap-3 cursor-pointer rounded-md" onSelect={() => setView('creator-studio')}>
                  <BarChart className="w-4 h-4" /> My Channel
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 cursor-pointer rounded-md" onSelect={() => setView('creator-studio')}>
                  <BarChart className="w-4 h-4" /> Studio
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 cursor-pointer rounded-md" onSelect={() => setView('adr-economy')}>
                  <Coins className="w-4 h-4" /> Wallet
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 cursor-pointer rounded-md" onSelect={() => setView('home-v3')}>
                  <LibraryIcon className="w-4 h-4" /> Library
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-0" />
                <DropdownMenuItem className="gap-3 cursor-pointer rounded-md" onSelect={() => setView('creator-studio')}>
                  <Settings className="w-4 h-4" /> Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile expandable search */}
        {showSearch && mobileSearchOpen && (
          <div className="md:hidden px-3 pb-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearchSubmit(); }}
                placeholder="Search..."
                className="flex-1 h-6 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
                autoFocus
              />
              <button onClick={() => setMobileSearchOpen(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
