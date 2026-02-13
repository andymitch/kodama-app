import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { Badge, badgeVariants } from '../ui/badge/index.js';

describe('Badge', () => {
  it('renders with default variant', () => {
    const { container } = render(Badge);
    const badge = container.querySelector('div');
    expect(badge).toBeInTheDocument();
    expect(badge?.className).toContain('bg-primary');
  });

  it('renders with secondary variant', () => {
    const { container } = render(Badge, { props: { variant: 'secondary' } });
    const badge = container.querySelector('div');
    expect(badge?.className).toContain('bg-secondary');
  });

  it('renders with destructive variant', () => {
    const { container } = render(Badge, { props: { variant: 'destructive' } });
    const badge = container.querySelector('div');
    expect(badge?.className).toContain('bg-destructive');
  });

  it('renders with outline variant', () => {
    const { container } = render(Badge, { props: { variant: 'outline' } });
    const badge = container.querySelector('div');
    expect(badge?.className).toContain('text-foreground');
  });

  it('renders with success variant', () => {
    const { container } = render(Badge, { props: { variant: 'success' } });
    const badge = container.querySelector('div');
    expect(badge?.className).toContain('bg-green-900/50');
  });

  it('applies custom classes', () => {
    const { container } = render(Badge, { props: { class: 'my-custom-class' } });
    const badge = container.querySelector('div');
    expect(badge?.className).toContain('my-custom-class');
  });

  it('contains base styling classes', () => {
    const { container } = render(Badge);
    const badge = container.querySelector('div');
    expect(badge?.className).toContain('inline-flex');
    expect(badge?.className).toContain('rounded-full');
    expect(badge?.className).toContain('text-xs');
    expect(badge?.className).toContain('font-semibold');
  });
});

describe('badgeVariants', () => {
  it('returns default variant styles', () => {
    const result = badgeVariants({ variant: 'default' });
    expect(result).toContain('bg-primary');
  });

  it('returns success variant styles', () => {
    const result = badgeVariants({ variant: 'success' });
    expect(result).toContain('bg-green-900/50');
    expect(result).toContain('text-green-400');
  });

  it('returns base styles regardless of variant', () => {
    const result = badgeVariants({ variant: 'outline' });
    expect(result).toContain('inline-flex');
    expect(result).toContain('rounded-full');
  });
});
