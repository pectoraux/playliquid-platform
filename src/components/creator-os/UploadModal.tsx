'use client';

import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import {
  Upload, Loader2, CheckCircle2, AlertCircle, FileArchive,
  Package, Zap, Globe, Play, Eye, ChevronRight, ChevronLeft, X,
} from 'lucide-react';

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublished?: (experienceId: string) => void;
}

type Step = 'upload' | 'details' | 'processing' | 'result';
type UploadState = 'idle' | 'uploading' | 'success' | 'error';

interface ValidationResult {
  valid: boolean;
  runtime: string;
  engine: string;
  hasIndex: boolean;
  hasManifest: boolean;
  hasInputBridge: boolean;
  hasTelemetryBridge: boolean;
  detectedExtensions: string[];
  warnings: string[];
  errors: string[];
  thumbnailUrl: string | null;
}

/**
 * Phase 23 — YouTube-style Upload Wizard
 * ----------------------------------------
 * 4-step flow: Upload → Details → Processing → Result
 * Real file upload via multipart/form-data + drag/drop.
 */
export function UploadModal({ open, onOpenChange, onPublished }: UploadModalProps) {
  const { playExperience } = usePlayExperience();
  const [step, setStep] = useState<Step>('upload');
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [format, setFormat] = useState<'spark' | 'game'>('game');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');

  // Result
  const [experienceId, setExperienceId] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setStep('upload');
    setUploadState('idle');
    setFile(null);
    setUploadProgress(0);
    setError(null);
    setTitle('');
    setDescription('');
    setTags([]);
    setTagInput('');
    setFormat('game');
    setOrientation('landscape');
    setExperienceId(null);
    setValidation(null);
    setPublicUrl(null);
  };

  // ── File selection ──────────────────────────────────────────────────────
  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return;
    const isZip = selectedFile.name.toLowerCase().endsWith('.zip');
    const isHtml = selectedFile.name.toLowerCase().endsWith('.html') || selectedFile.name.toLowerCase().endsWith('.htm');
    if (!isZip && !isHtml) {
      setError('Please upload a .zip or .html file');
      return;
    }
    setError(null);
    setFile(selectedFile);
    // Auto-fill title from filename
    if (!title) {
      setTitle(selectedFile.name.replace(/\.(zip|html|htm)$/i, '').replace(/[-_]/g, ' '));
    }
  };

  // ── Drag/drop ──────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) dropZoneRef.current.classList.add('border-amber-500', 'bg-amber-50', 'dark:bg-amber-950/30');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) dropZoneRef.current.classList.remove('border-amber-500', 'bg-amber-50', 'dark:bg-amber-950/30');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) dropZoneRef.current.classList.remove('border-amber-500', 'bg-amber-50', 'dark:bg-amber-950/30');

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, []);

  // ── Upload + process ────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) return;

    setStep('processing');
    setUploadState('uploading');
    setError(null);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress((p) => Math.min(p + 10, 90));
    }, 200);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title || file.name);
      formData.append('description', description);
      formData.append('tags', tags.join(','));
      formData.append('format', format);
      formData.append('orientation', orientation);

      const res = await fetch('/api/experiences/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setExperienceId(data.experienceId);
      setValidation(data.validation);
      setPublicUrl(data.publicUrl);
      setUploadState('success');
      setStep('result');
    } catch (err) {
      clearInterval(progressInterval);
      setError((err as Error).message);
      setUploadState('error');
      setStep('upload');
    }
  };

  // ── Publish ─────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!experienceId) return;
    try {
      const res = await fetch('/api/experiences/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', experienceId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // Navigate to the published game's page (like YouTube routing to the video)
      reset();
      onOpenChange(false);
      playExperience(experienceId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-amber-500" /> Upload Experience
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Step 1: Upload your game bundle'}
            {step === 'details' && 'Step 2: Tell players about your game'}
            {step === 'processing' && 'Step 3: Processing your upload…'}
            {step === 'result' && 'Step 4: Your game is ready!'}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <div className="space-y-3">
            {/* Drag/drop zone */}
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer transition-all hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.html,.htm"
                hidden
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="space-y-2">
                  <FileArchive className="w-10 h-10 mx-auto text-amber-500" />
                  <div className="text-sm font-medium">{file.name}</div>
                  <div className="text-[10px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] gap-1"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  >
                    <X className="w-3 h-3" /> Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Package className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  <div className="text-sm font-medium">Drop your .zip file here</div>
                  <div className="text-[10px] text-muted-foreground">or click to browse</div>
                </div>
              )}
            </div>

            {/* Supported formats */}
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <div className="font-medium">Supported:</div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[8px] h-3.5">✓ .zip</Badge>
                <Badge variant="outline" className="text-[8px] h-3.5">✓ HTML5 Canvas</Badge>
                <Badge variant="outline" className="text-[8px] h-3.5">✓ Phaser</Badge>
                <Badge variant="outline" className="text-[8px] h-3.5">✓ Three.js</Badge>
                <Badge variant="outline" className="text-[8px] h-3.5">✓ PlayLiquid bundles</Badge>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-300">
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs text-red-700 dark:text-red-400">{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={close}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => setStep('details')}
                disabled={!file}
                className="gap-1.5"
              >
                Continue <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Details ── */}
        {step === 'details' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Awesome Game"
                className="h-8 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your game…"
                className="text-sm min-h-[60px]"
              />
            </div>

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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Category</label>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setFormat('game')}
                    className={`flex-1 h-8 rounded text-xs border-2 ${format === 'game' ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-border'}`}
                  >
                    🎮 Game
                  </button>
                  <button
                    onClick={() => setFormat('spark')}
                    className={`flex-1 h-8 rounded text-xs border-2 ${format === 'spark' ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30' : 'border-border'}`}
                  >
                    ⚡ Spark
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Orientation</label>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setOrientation('landscape')}
                    className={`flex-1 h-8 rounded text-xs border-2 ${orientation === 'landscape' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-border'}`}
                  >
                    🖥 Landscape
                  </button>
                  <button
                    onClick={() => setOrientation('portrait')}
                    className={`flex-1 h-8 rounded text-xs border-2 ${orientation === 'portrait' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-border'}`}
                  >
                    📱 Portrait
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('upload')} className="gap-1.5">
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </Button>
              <Button size="sm" onClick={handleUpload} disabled={!file} className="gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Upload & Process
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Processing ── */}
        {step === 'processing' && (
          <div className="py-6 space-y-4">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              <span className="text-sm font-medium">
                {uploadProgress < 100 ? `Uploading… ${uploadProgress}%` : 'Processing bundle…'}
              </span>
            </div>
            <Progress value={uploadProgress} className="h-2" />

            {uploadProgress >= 100 && (
              <div className="space-y-2 text-[10px]">
                {[
                  { label: 'Extracting files', done: true },
                  { label: 'Checking manifest', done: true },
                  { label: 'Detecting runtime', done: true },
                  { label: 'Checking PlayLiquid compatibility', done: true },
                  { label: 'Creating experience', done: false },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {s.done ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                    )}
                    <span className={s.done ? 'text-muted-foreground' : 'font-medium'}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Result ── */}
        {step === 'result' && validation && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium">"{title}" is ready!</p>
              <p className="text-xs text-muted-foreground">Your game has been processed and saved as a draft.</p>
            </div>

            {/* Validation report */}
            <Card>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Runtime</span>
                  <Badge variant="outline" className="text-[9px]">{validation.engine}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Compatibility</span>
                  <span className="text-xs">
                    {validation.hasInputBridge ? '✅' : '⚠️'} Input · {validation.hasTelemetryBridge ? '✅' : '⚠️'} Telemetry
                  </span>
                </div>
                {validation.detectedExtensions.length > 0 && (
                  <div>
                    <span className="text-xs font-medium">Detected extensions:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {validation.detectedExtensions.map((ext) => (
                        <Badge key={ext} variant="secondary" className="text-[8px] h-3.5">{ext}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {validation.warnings.length > 0 && (
                  <div className="pt-1 border-t border-border">
                    {validation.warnings.map((w, i) => (
                      <div key={i} className="text-[9px] text-amber-600 dark:text-amber-400 flex items-start gap-1">
                        <AlertCircle className="w-2.5 h-2.5 mt-0.5 shrink-0" /> {w}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              {experienceId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => { window.open(`/?exp=${experienceId}`, '_blank'); }}
                >
                  <Eye className="w-3.5 h-3.5" /> Preview
                </Button>
              )}
              <Button
                size="sm"
                className="flex-1 gap-1.5"
                onClick={handlePublish}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Publish
              </Button>
            </div>
            <p className="text-[9px] text-muted-foreground text-center">
              Draft saved. Click Publish to make it visible on the home feed.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Hook for play navigation ──────────────────────────────────────────────
import { useStudioStore } from '@/stores/studio-store';

function usePlayExperience() {
  const { playExperience } = useStudioStore();
  return { playExperience };
}
