'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, Loader2, CheckCircle2, AlertCircle, FileArchive, Globe } from 'lucide-react';

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublished?: (experienceId: string) => void;
}

type UploadPhase = 'form' | 'uploading' | 'scanning' | 'detecting' | 'extracting' | 'creating' | 'preview' | 'done' | 'error';

const PHASE_LABELS: Record<UploadPhase, string> = {
  form: '',
  uploading: 'Uploading package…',
  scanning: 'Scanning for malware…',
  detecting: 'Detecting runtime type…',
  extracting: 'Extracting metadata…',
  creating: 'Creating Extension Graph…',
  preview: 'Generating preview…',
  done: 'Published!',
  error: 'Upload failed',
};

const PHASE_PROGRESS: Record<UploadPhase, number> = {
  form: 0,
  uploading: 15,
  scanning: 35,
  detecting: 55,
  extracting: 70,
  creating: 85,
  preview: 95,
  done: 100,
  error: 0,
};

/**
 * Phase 21.4 — YouTube-style Upload Modal
 * ----------------------------------------
 * Drag/drop upload flow for importing HTML5 game packages.
 * Processing pipeline: Upload → Scan → Detect → Extract → Create → Preview → Publish
 */
export function UploadModal({ open, onOpenChange, onPublished }: UploadModalProps) {
  const [phase, setPhase] = useState<UploadPhase>('form');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [gameUrl, setGameUrl] = useState('/imported-games/orb-collector/');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const reset = () => {
    setPhase('form');
    setTitle('');
    setDescription('');
    setGameUrl('/imported-games/orb-collector/');
    setTags([]);
    setTagInput('');
    setError(null);
    setPublishedId(null);
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const handleUpload = async () => {
    if (!title.trim() || !gameUrl.trim()) {
      setError('Title and game URL are required');
      return;
    }

    setError(null);
    // Simulate the processing pipeline
    const phases: UploadPhase[] = ['uploading', 'scanning', 'detecting', 'extracting', 'creating', 'preview'];
    for (const p of phases) {
      setPhase(p);
      await new Promise((r) => setTimeout(r, 500));
    }

    // Actually create the experience via the API
    try {
      const res = await fetch('/api/runtime/import-html5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: title,
          description: description || `Imported HTML5 game: ${title}`,
          gameUrl,
          manifest: {
            name: title,
            version: '1.0.0',
            runtime: { type: 'html5', entry: 'index.html' },
            viewport: { aspectRatio: '16:9', orientation: 'landscape' },
            permissions: ['input', 'telemetry'],
          },
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPublishedId(data.experienceId);
      setPhase('done');
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
    }
  };

  const close = () => {
    if (phase === 'done' && publishedId) {
      onPublished?.(publishedId);
    }
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-amber-500" /> Upload Experience
          </DialogTitle>
          <DialogDescription>Import an HTML5 game package into PlayLiquid</DialogDescription>
        </DialogHeader>

        {phase === 'form' && (
          <div className="space-y-3">
            {/* Title */}
            <div>
              <label className="text-xs font-medium mb-1 block">Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Awesome Game"
                className="h-8 text-sm"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium mb-1 block">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your game…"
                className="text-sm min-h-[60px]"
              />
            </div>

            {/* Game URL */}
            <div>
              <label className="text-xs font-medium mb-1 block">Game Package URL *</label>
              <Input
                value={gameUrl}
                onChange={(e) => setGameUrl(e.target.value)}
                placeholder="/imported-games/my-game/"
                className="h-8 text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Path to the HTML5 game's index.html directory
              </p>
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-medium mb-1 block">Tags</label>
              <div className="flex gap-1.5">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="action, puzzle, racing…"
                  className="h-8 text-sm flex-1"
                />
                <Button size="sm" variant="outline" className="h-8" onClick={addTag}>Add</Button>
              </div>
              {tags.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-2">
                  {tags.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="text-[10px] h-5 cursor-pointer"
                      onClick={() => setTags(tags.filter((x) => x !== t))}
                    >
                      {t} ✕
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Drag/drop area (visual) */}
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              <FileArchive className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">Drag & drop a .zip file here</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Supported: .zip, .html, .js</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-300">
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs text-red-700 dark:text-red-400">{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Processing pipeline */}
        {phase !== 'form' && phase !== 'done' && phase !== 'error' && (
          <div className="py-6 space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              <span className="text-sm font-medium">{PHASE_LABELS[phase]}</span>
            </div>
            <Progress value={PHASE_PROGRESS[phase]} className="h-2" />
            <div className="space-y-1 text-[10px] text-muted-foreground">
              {['uploading', 'scanning', 'detecting', 'extracting', 'creating', 'preview'].map((p) => (
                <div key={p} className="flex items-center gap-1.5">
                  {PHASE_PROGRESS[phase as UploadPhase] > PHASE_PROGRESS[p as UploadPhase] ? (
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                  ) : phase === p ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-500" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full border border-muted-foreground/30" />
                  )}
                  <span className={phase === p ? 'font-medium text-foreground' : ''}>
                    {PHASE_LABELS[p as UploadPhase]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium">Experience Published!</p>
            <p className="text-xs text-muted-foreground">"{title}" is now live on PlayLiquid</p>
            {publishedId && (
              <Badge variant="outline" className="text-[9px] font-mono">{publishedId.slice(-12)}</Badge>
            )}
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="py-6 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
            <p className="text-sm font-medium">Upload Failed</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        )}

        <DialogFooter>
          {phase === 'form' && (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" onClick={handleUpload} className="gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Upload & Publish
              </Button>
            </>
          )}
          {(phase === 'done' || phase === 'error') && (
            <Button size="sm" onClick={close} className="gap-1.5">
              {phase === 'done' ? <Globe className="w-3.5 h-3.5" /> : null}
              {phase === 'done' ? 'View on Home' : 'Close'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
