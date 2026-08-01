/**
 * Channel Type System — assignability rules
 * -------------------------------------------
 * Structural typing: a record with more fields is assignable to a record with
 * fewer fields. Primitive types match by name. Enums match exactly.
 * Token types match by symbol.
 */

import type { ChannelType } from './types';

/**
 * Can a value of type `from` flow into a channel of type `to`?
 */
export function isAssignable(from: ChannelType, to: ChannelType): boolean {
  // Token type: must match symbol exactly
  if (from.kind === 'token' && to.kind === 'token') {
    return from.symbol === to.symbol;
  }
  if (from.kind === 'token' || to.kind === 'token') {
    return false;
  }

  // Primitive: match by name. The generic 'Token' primitive accepts any token-typed value.
  if (from.kind === 'primitive' && to.kind === 'primitive') {
    if (from.name === to.name) return true;
    // The 'Token' primitive is a wildcard for token-typed values
    if (to.name === 'Token') return true;
    return false;
  }
  if (from.kind === 'primitive' || to.kind === 'primitive') {
    return false;
  }

  // Enum: exact match on variants
  if (from.kind === 'enum' && to.kind === 'enum') {
    if (from.variants.length !== to.variants.length) return false;
    return from.variants.every((v, i) => v === to.variants[i]);
  }
  if (from.kind === 'enum' || to.kind === 'enum') {
    return false;
  }

  // Record: structural — `from` must have at least all fields of `to` with assignable types
  if (from.kind === 'record' && to.kind === 'record') {
    return Object.entries(to.fields).every(([name, toType]) => {
      const fromType = from.fields[name];
      if (!fromType) return false;
      return isAssignable(fromType, toType);
    });
  }

  return false;
}

/** Human-readable name for a type (for error messages) */
export function describeType(t: ChannelType): string {
  switch (t.kind) {
    case 'primitive':
      return t.name;
    case 'record':
      const fields = Object.entries(t.fields)
        .map(([k, v]) => `${k}: ${describeType(v)}`)
        .join(', ');
      return `{ ${fields} }`;
    case 'enum':
      return t.variants.join(' | ');
    case 'token':
      return `Token<${t.symbol}>`;
  }
}

/**
 * Validate that a value matches a channel type at runtime.
 * Used by the runtime bus to reject malformed emissions.
 */
export function validateValue(type: ChannelType, value: unknown): boolean {
  switch (type.kind) {
    case 'primitive':
      return validatePrimitive(type.name, value);
    case 'record':
      if (typeof value !== 'object' || value === null) return false;
      const obj = value as Record<string, unknown>;
      return Object.entries(type.fields).every(([k, t]) => validateValue(t, obj[k]));
    case 'enum':
      return typeof value === 'string' && type.variants.includes(value);
    case 'token':
      return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }
}

function validatePrimitive(name: string, value: unknown): boolean {
  switch (name) {
    case 'Number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'String':
      return typeof value === 'string';
    case 'Boolean':
      return typeof value === 'boolean';
    case 'Vector2':
      return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as any).x === 'number' &&
        typeof (value as any).y === 'number'
      );
    case 'Entity':
      return typeof value === 'object' && value !== null && typeof (value as any).id === 'string';
    case 'Token':
      return typeof value === 'number' && value >= 0;
    case 'Event':
      return typeof value === 'object' && value !== null && typeof (value as any).type === 'string';
    default:
      return false;
  }
}
