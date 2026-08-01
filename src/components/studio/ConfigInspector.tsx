'use client';

import { useStudioStore } from '@/stores/studio-store';
import { useExtensions } from '@/hooks/use-kernel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Settings2, ChevronRight } from 'lucide-react';
import type { ConfigField } from '@/kernel/types';

export function ConfigInspector() {
  const {
    nodes,
    selectedInstanceId,
    removeInstance,
    updateInstanceConfig,
    setSelectedInstance,
  } = useStudioStore();
  const { data: extData } = useExtensions();

  const node = nodes.find((n) => n.id === selectedInstanceId);
  const ext = extData?.extensions.find((e: any) => e.id === (node?.data as any)?.extensionId);

  if (!node || !ext) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <Settings2 className="w-8 h-8 text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground">Select an extension to configure</p>
      </div>
    );
  }

  const data = node.data as any;
  const configFields: ConfigField[] = ext.configSchema ?? [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{data.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{data.extensionName}</div>
            <div className="text-[10px] font-mono text-muted-foreground">{node.id}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          <Badge variant="outline" className="text-[9px] h-4">{ext.category}</Badge>
          {data.tokenDefinitions?.map((t: any) => (
            <Badge key={t.symbol} className="text-[9px] h-4 bg-amber-500 text-white">+{t.symbol}</Badge>
          ))}
          {data.consumesTokens?.map((t: string) => (
            <Badge key={t} className="text-[9px] h-4 bg-orange-500 text-white">-{t}</Badge>
          ))}
        </div>
      </div>

      {/* Config Form */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {configFields.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            This extension has no configurable settings.
          </p>
        ) : (
          <>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Settings
            </div>
            {configFields.map((field) => (
              <ConfigFieldInput
                key={field.key}
                field={field}
                value={data.config?.[field.key] ?? field.default}
                onChange={(val) => updateInstanceConfig(node.id, { [field.key]: val })}
              />
            ))}
          </>
        )}

        <Separator />

        {/* Channel details */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Channels
          </div>
          {ext.inputs.length > 0 && (
            <div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 mb-1">Inputs</div>
              {ext.inputs.map((ch: any) => (
                <div key={ch.name} className="text-[11px] font-mono flex items-center gap-1">
                  <span className={ch.required ? 'text-red-500' : 'text-muted-foreground'}>●</span>
                  <span>{ch.name}</span>
                  <span className="text-muted-foreground text-[9px]">{ch.cardinality}</span>
                </div>
              ))}
            </div>
          )}
          {ext.outputs.length > 0 && (
            <div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-1">Outputs</div>
              {ext.outputs.map((ch: any) => (
                <div key={ch.name} className="text-[11px] font-mono">{ch.name}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-3 border-t border-border">
        <Button
          variant="destructive"
          size="sm"
          className="w-full h-8"
          onClick={() => removeInstance(node.id)}
        >
          <Trash2 className="w-3.5 h-3.5" /> Remove Extension
        </Button>
      </div>
    </div>
  );
}

function ConfigFieldInput({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: number | string | boolean;
  onChange: (val: number | string | boolean) => void;
}) {
  if (field.type === 'number') {
    const numVal = typeof value === 'number' ? value : (field.default as number);
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{field.label}</Label>
          <span className="text-xs font-mono text-amber-600 dark:text-amber-400">
            {numVal}{field.unit ? ` ${field.unit}` : ''}
          </span>
        </div>
        <Slider
          value={[numVal]}
          min={field.min ?? 0}
          max={field.max ?? 100}
          step={field.step ?? 1}
          onValueChange={(v) => onChange(v[0])}
          className="py-1"
        />
        {field.description && (
          <p className="text-[10px] text-muted-foreground">{field.description}</p>
        )}
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{field.label}</Label>
        <Select value={String(value)} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {field.description && (
          <p className="text-[10px] text-muted-foreground">{field.description}</p>
        )}
      </div>
    );
  }

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs">{field.label}</Label>
          {field.description && (
            <p className="text-[10px] text-muted-foreground">{field.description}</p>
          )}
        </div>
        <Button
          size="sm"
          variant={value ? 'default' : 'outline'}
          onClick={() => onChange(!value)}
          className="h-6 px-2"
        >
          {value ? 'ON' : 'OFF'}
        </Button>
      </div>
    );
  }

  // string
  return (
    <div className="space-y-1">
      <Label className="text-xs">{field.label}</Label>
      <Input
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs"
      />
      {field.description && (
        <p className="text-[10px] text-muted-foreground">{field.description}</p>
      )}
    </div>
  );
}
