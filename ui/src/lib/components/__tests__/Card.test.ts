import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../ui/card/index.js';

describe('Card', () => {
  it('renders a div with card styling', () => {
    const { container } = render(Card);
    const card = container.querySelector('div');
    expect(card).toBeInTheDocument();
    expect(card?.className).toContain('rounded-lg');
    expect(card?.className).toContain('border');
    expect(card?.className).toContain('bg-card');
    expect(card?.className).toContain('shadow-sm');
  });

  it('applies custom classes', () => {
    const { container } = render(Card, { props: { class: 'w-full' } });
    const card = container.querySelector('div');
    expect(card?.className).toContain('w-full');
  });
});

describe('CardHeader', () => {
  it('renders a div with header styling', () => {
    const { container } = render(CardHeader);
    const header = container.querySelector('div');
    expect(header).toBeInTheDocument();
    expect(header?.className).toContain('flex');
    expect(header?.className).toContain('flex-col');
    expect(header?.className).toContain('p-6');
  });
});

describe('CardTitle', () => {
  it('renders as h3 element', () => {
    const { container } = render(CardTitle);
    const title = container.querySelector('h3');
    expect(title).toBeInTheDocument();
    expect(title?.className).toContain('text-2xl');
    expect(title?.className).toContain('font-semibold');
  });
});

describe('CardDescription', () => {
  it('renders as p element', () => {
    const { container } = render(CardDescription);
    const desc = container.querySelector('p');
    expect(desc).toBeInTheDocument();
    expect(desc?.className).toContain('text-sm');
  });
});

describe('CardContent', () => {
  it('renders with content padding', () => {
    const { container } = render(CardContent);
    const content = container.querySelector('div');
    expect(content).toBeInTheDocument();
    expect(content?.className).toContain('p-6');
    expect(content?.className).toContain('pt-0');
  });
});

describe('CardFooter', () => {
  it('renders with footer styling', () => {
    const { container } = render(CardFooter);
    const footer = container.querySelector('div');
    expect(footer).toBeInTheDocument();
    expect(footer?.className).toContain('flex');
    expect(footer?.className).toContain('p-6');
  });
});
