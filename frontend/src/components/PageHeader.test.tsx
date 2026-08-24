import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PageHeader, { HeaderAction, HeaderPill } from './PageHeader';

const renderHeader = (element: React.ReactNode) =>
  render(<MemoryRouter>{element}</MemoryRouter>);

describe('PageHeader', () => {
  it('names the page as the one h1 on it', () => {
    renderHeader(<PageHeader title="Product Management" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Product Management');
  });

  it('puts the count in the heading, spaced so it does not run together', () => {
    renderHeader(<PageHeader title="Product Management" count={16} />);

    // Not just a margin: without a real space the accessible name reads
    // "Product Management(16)".
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Product Management (16)'
    );
  });

  it('shows no count until there is one, rather than "(0)" while loading', () => {
    renderHeader(<PageHeader title="Product Management" />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Product Management');
  });

  it('still shows a genuine zero', () => {
    renderHeader(<PageHeader title="Product Management" count={0} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Product Management (0)');
  });

  it('renders the subtitle and the actions', () => {
    renderHeader(
      <PageHeader
        title="Sales Report"
        subtitle="Comprehensive sales analytics"
        actions={<HeaderAction onClick={() => {}}>Export PDF</HeaderAction>}
      />
    );

    expect(screen.getByText('Comprehensive sales analytics')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeInTheDocument();
  });
});

describe('HeaderAction', () => {
  it('is a link when it navigates, not a button that navigates', () => {
    renderHeader(<HeaderAction to="/admin/products">Back to List</HeaderAction>);

    expect(screen.getByRole('link', { name: 'Back to List' })).toHaveAttribute(
      'href',
      '/admin/products'
    );
  });

  it('is a button when it acts', () => {
    renderHeader(<HeaderAction onClick={() => {}}>Add Product</HeaderAction>);

    expect(screen.getByRole('button', { name: 'Add Product' })).toBeInTheDocument();
  });
});

describe('HeaderPill', () => {
  it('is not clickable - it reports, it does not act', () => {
    renderHeader(<HeaderPill>Sunday, 16 August 2026</HeaderPill>);

    expect(screen.getByText('Sunday, 16 August 2026')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

/*
 * Every admin page opens with the bar. Checked against the router rather than
 * against a list kept here, so adding an admin page without a header fails.
 *
 * Source-level rather than rendered: rendering all thirteen would mean mocking
 * every endpoint they call, and what is being asserted is that the component is
 * used at all - which the source says directly.
 */
describe('coverage of the admin routes', () => {
  const SRC = resolve(process.cwd(), 'src');
  const routerSource = readFileSync(resolve(SRC, 'app/router.tsx'), 'utf8');

  const adminBlock = routerSource.split('---- Admin')[1]!.split('_gallery')[0]!;

  // Component name -> file, from the router's own imports.
  const imports = new Map<string, string>();
  for (const line of routerSource.split('\n')) {
    const match = /^import (?:\{ ([^}]+) \}|(\w+)) from '@\/(.+)';$/.exec(line.trim());
    if (!match) continue;

    const path = match[3]!;
    if (match[2]) imports.set(match[2], path);
    else for (const name of match[1]!.split(',')) imports.set(name.trim(), path);
  }
  // The two lazily-imported components name their module inline instead.
  imports.set('DashboardPage', 'features/admin/DashboardPage');

  const components = [
    ...new Set(
      [...adminBlock.matchAll(/element: <(\w+) \/>/g)]
        .map((match) => match[1]!)
        // The login page is deliberately outside the shell: no sidebar, no
        // breadcrumb and no header bar, because nobody is signed in yet.
        .filter((name) => name !== 'AdminLoginPage' && name !== 'Navigate')
    ),
    'DashboardPage'
  ];

  it('found the admin pages to check', () => {
    expect(components.length).toBeGreaterThan(8);
  });

  it.each(components)('%s opens with a page header', (name) => {
    const path = imports.get(name);
    expect(path, `no import found for ${name}`).toBeTruthy();

    const source = readFileSync(resolve(SRC, `${path}.tsx`), 'utf8');

    // Either it renders the bar itself, or it delegates to the shared list
    // page, which renders one for it.
    expect(source).toMatch(/<PageHeader|<ResourceListPage/);
  });
});
