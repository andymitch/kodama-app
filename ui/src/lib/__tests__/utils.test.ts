import { describe, it, expect } from 'vitest';
import { cn } from '../utils.js';

describe('cn', () => {
  it('merges simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles empty inputs', () => {
    expect(cn()).toBe('');
    expect(cn('')).toBe('');
  });

  it('handles undefined and null inputs', () => {
    expect(cn(undefined, 'foo', null)).toBe('foo');
  });

  it('handles conditional classes via clsx', () => {
    expect(cn('base', false && 'hidden', true && 'visible')).toBe('base visible');
  });

  it('handles object syntax via clsx', () => {
    expect(cn({ hidden: false, visible: true })).toBe('visible');
  });

  it('handles array syntax', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('merges conflicting Tailwind classes (last wins)', () => {
    // tailwind-merge should resolve p-4 vs p-2 to the last one
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('merges conflicting Tailwind color classes', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('keeps non-conflicting Tailwind classes', () => {
    expect(cn('p-4', 'mt-2')).toBe('p-4 mt-2');
  });

  it('handles mixed conflicting and non-conflicting', () => {
    const result = cn('rounded-lg border bg-card', 'bg-primary');
    expect(result).toContain('rounded-lg');
    expect(result).toContain('border');
    expect(result).toContain('bg-primary');
    expect(result).not.toContain('bg-card');
  });
});
