# Design Tokens

The literal values behind the current UI, ready to become `tailwind.config.ts`. Everything
here was read out of [public/css/design-system.css](../../../public/css/design-system.css)
(606 lines) and [public/css/user.css](../../../public/css/user.css) (749 lines) — these are
the real values the app renders today, not a proposal.

---

## What exists and what doesn't

`design-system.css` sounds like a design system but is **only** colour tokens, badge
geometry, shadows and transitions — 149 lines of `:root`, then 457 lines of badge variant
classes.

| Token category | Present? |
|---|---|
| Colours | ✅ comprehensive |
| Badge geometry | ✅ |
| Shadows | ✅ |
| Transitions | ✅ |
| **Typography scale** | ❌ none — no font-size, line-height or weight tokens |
| **Spacing scale** | ❌ none |
| **Border radius scale** | ❌ only badge radii |
| **Breakpoints** | ❌ none — media queries hardcode 576/768/992 |
| **Z-index scale** | ❌ none — hardcoded up to 9999 |

So Tailwind's defaults fill the gaps for spacing, radii, breakpoints and z-index. Only the
colours, badges, shadows and transitions need porting.

---

## 1. Brand and neutral colours

Two conflicting palettes exist today. **`user.css` is what the storefront actually renders**;
`design-system.css` carries the Bootstrap-derived set used by badges.

| | `user.css` (live storefront) | `design-system.css` |
|---|---|---|
| Accent red | `--color-accent-red: #E03A2F` | `--primary-color: #dc3545` |
| Dark | `--color-text-primary: #1A1A1A` | `--secondary-color: #111827` |
| Background | `--color-bg-main: #fdf8f3` | — |

> **Decision: `#E03A2F` is the brand colour.** It is what users see — the navbar alone
> hardcodes it about a dozen more times. `#dc3545` survives only as the semantic `danger`
> used by status badges, so a destructive action stays visually distinct from a brand action.

### `user.css` palette — the "Smoked Concrete" set

```css
--color-bg-main:        #fdf8f3;   /* page background */
--color-card:           #F2F2F2;   /* card / form container */
--color-text-primary:   #1A1A1A;
--color-text-secondary: #555555;
--color-accent-red:     #E03A2F;   /* → brand */
--color-accent-blue:    #3A7DFF;
--color-border:         #D1D1D1;
```

### Semantic colours (`design-system.css`)

```css
--success-color: #198754;   --success-hover: #157347;
--warning-color: #ffc107;   --warning-hover: #ffca2c;
--error-color:   #dc3545;   --error-hover:   #bb2d3b;
--info-color:    #0dcaf0;   --info-hover:    #31d2f2;
--primary-hover: #bb2d3b;
--secondary-color: #111827; --secondary-hover: #374151;
--accent-color:  #000;
```

### Neutral scale

```css
--gray-50:  #f9fafb;   --gray-100: #f3f4f6;   --gray-200: #e5e7eb;
--gray-300: #d1d5db;   --gray-400: #9ca3af;   --gray-500: #6b7280;
--gray-600: #4b5563;   --gray-700: #374151;   --gray-800: #1f2937;
--gray-900: #111827;
```

> This is **byte-identical to Tailwind's default `gray`**. Don't redefine it — the existing
> greys map for free, and `--secondary-color: #111827` is just `gray-900`.

### Proposed Tailwind config

```ts
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      brand:  { DEFAULT: '#E03A2F', hover: '#c22e24' },
      ink:    { DEFAULT: '#1A1A1A', muted: '#555555' },
      canvas: '#fdf8f3',
      card:   '#F2F2F2',
      line:   '#D1D1D1',
      accent: '#3A7DFF',
      success: { DEFAULT: '#198754', hover: '#157347' },
      warning: { DEFAULT: '#ffc107', hover: '#ffca2c' },
      danger:  { DEFAULT: '#dc3545', hover: '#bb2d3b' },
      info:    { DEFAULT: '#0dcaf0', hover: '#31d2f2' },
      // gray: inherited from Tailwind's default — already identical
    },
  },
}
```

`brand.hover` is not in the source (there is no hover token for `--color-accent-red`); the
value above is a proposal. Pick one deliberately and record it.

---

## 2. Badges — the single biggest consolidation win

457 of the 606 lines of `design-system.css` are badge variants: five class families
(`payment-method-badge`, `payment-status-badge`, `order-status-badge`, each with a `-table`
variant, plus legacy `payment-badge` / `status-badge`), two tones (bold and light), and
three sizes.

**All of it becomes one component:**

```tsx
<Badge tone="warning" variant="light" size="table">Pending</Badge>
```

### Bold tokens

| Tone | Background | Text |
|---|---|---|
| warning | `#ffc107` | `#000` |
| primary | `#0d6efd` | `#fff` |
| info | `#0dcaf0` | `#000` |
| success | `#198754` | `#fff` |
| danger | `#dc3545` | `#fff` |
| purple | `#6f42c1` | `#fff` |
| secondary | `#6c757d` | `#fff` |

### Light tokens (used in tables)

| Tone | Background | Text |
|---|---|---|
| warning | `#fff3cd` | `#997404` |
| primary | `#cfe2ff` | `#084298` |
| info | `#cff4fc` | `#055160` |
| success | `#d1e7dd` | `#0f5132` |
| danger | `#f8d7da` | `#842029` |
| purple | `#e0cffc` | `#432874` |
| secondary | `#e2e3e5` | `#41464b` |

### Payment-method tokens

| Method | Bold bg / text | Light bg / text |
|---|---|---|
| cod | `#ffc107` / `#000` | `#fff3cd` / `#997404` |
| razorpay, online | `#0d6efd` / `#fff` | `#cfe2ff` / `#084298` |
| wallet | `#198754` / `#fff` | `#d1e7dd` / `#0f5132` |
| upi | `#6f42c1` / `#fff` | `#e0cffc` / `#432874` |
| unknown | `#6c757d` / `#fff` | `#e2e3e5` / `#41464b` |

These are aliases of the tone scale above — `cod` is `warning`, `razorpay` is `primary`,
`wallet` is `success`, `upi` is `purple`, `unknown` is `secondary`. Map payment method → tone
rather than defining a second palette.

### Geometry

```css
--badge-padding:          0.4rem 1rem;
--badge-padding-sm:       0.35rem 0.75rem;
--badge-padding-lg:       0.5rem 1.2rem;
--badge-padding-table:    0.375rem 0.875rem;
--badge-radius:           6px;
--badge-radius-rounded:   12px;    /* used by all -table variants */
--badge-font-size:        0.75rem;
--badge-font-size-table:  0.75rem;
--badge-font-weight:      600;
--badge-min-width-payment: 80px;
--badge-min-width-status:  90px;
--badge-min-width-table:   90px;
--badge-letter-spacing:   0.5px;
```

`-table` variants are `inline-flex`, centred, `overflow: hidden` with `text-overflow:
ellipsis`, fixed width, and `text-transform: uppercase` for payment methods / `capitalize`
for statuses.

### Status → tone mapping

Read directly from the CSS rules, so this is exact. Status strings come from
[order.constants.ts](../../backend/common/constants/order.constants.ts).

**Order status** (10 values)

| Status | Tone |
|---|---|
| `Pending` | warning |
| `Processing` | primary |
| `Shipped` | info |
| `Partially Delivered` | info |
| `Delivered` | success |
| `Cancelled` | danger |
| `Failed` | danger |
| `Returned` | warning |
| `Partially Returned` | warning |
| `Processing Return` | warning |

**Payment status** (7 values)

| Status | Tone |
|---|---|
| `Pending` | warning |
| `Completed` | success |
| `Partially Completed` | info |
| `Failed` | danger |
| `Cancelled` | danger |
| `Refunded` | purple |
| `Partially Refunded` | purple |

**Return status** (`Pending`, `Approved`, `Rejected`, `Completed`) has no dedicated CSS —
the admin returns page styles them ad hoc. Suggested: pending → warning, approved → primary,
rejected → danger, completed → success.

The CSS keys on kebab-cased class names (`partially-delivered`), so the component needs
`status.toLowerCase().replace(/\s+/g, '-')` or, better, an explicit
`Record<OrderStatus, Tone>` map that TypeScript can check for exhaustiveness against the
constants file.

### Other utilities in the file

`.bg-{tone}-custom` (Bootstrap-compat), `.text-primary-custom`, `.text-secondary-custom`, and
`.border-left-{tone}` (a 5px left border used for row emphasis). All become Tailwind
utilities or `<Badge>` props.

---

## 3. Shadows

```css
--shadow-sm: 0 1px 2px  rgba(0, 0, 0, 0.05);
--shadow:    0 1px 3px  rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 6px  rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);
```

Close enough to Tailwind's defaults (`shadow-sm` … `shadow-xl`) that you can drop these and
use the built-ins.

## 4. Transitions

```css
--transition-fast: 0.15s ease;
--transition-base: 0.2s ease;
--transition-slow: 0.3s ease;
```

→ Tailwind's `duration-150` / `duration-200` / `duration-300` with `ease-in-out`.

---

## 5. Typography

**There is no type scale anywhere.** Body text is a system stack:

```css
body { font-family: 'Segoe UI', Roboto, sans-serif; }   /* user.css:16 */
```

Five Google Font families are then loaded ad hoc from inside individual partials — not from
any layout:

| Family | Weights | Loaded from | Used for |
|---|---|---|---|
| **Lexend** | 300–700 | `<link>` in `about.ejs`, `help.ejs`, `category-carousel.ejs` | section headings |
| **League Gothic** | — | `<link>` in `banner.ejs` | hero `h1` (90px/70px/107px per slide, `!important`) |
| **Aleo** | 400, 700 | same link as League Gothic | hero paragraph |
| **Inter** | 400–700 | `@import` in `coupon-card.css` | coupon card body |
| **Poppins** | 700–900 | same `@import` | coupon discount headline |
| Courier New | — | system | coupon code |

> That is **four separate font requests** (two `<link>` URLs plus a render-blocking CSS
> `@import`), scattered across three partials, with duplicate `preconnect` tags. None of it
> is in a layout, so the fonts load only on the pages that happen to include those partials.

### Recommendation

Install via `@fontsource`, self-hosted, loaded once in the app shell. A reasonable mapping:

```ts
fontFamily: {
  sans:    ['Inter', 'system-ui', 'sans-serif'],      // body — replaces the Segoe stack
  heading: ['Lexend', 'Inter', 'sans-serif'],          // section headings
  display: ['"League Gothic"', 'Impact', 'sans-serif'],// hero only
  mono:    ['"Courier New"', 'monospace'],             // coupon codes
}
```

Poppins and Aleo each serve exactly one element. Consider dropping them — every font family
is a real payload cost, and two of the five earn their weight only on the hero and the coupon
card. If the hero is redesigned in Tailwind anyway, League Gothic may go too.

**Type scale:** none exists, so adopt Tailwind's defaults and standardise. Today's headings
are hardcoded per page, which is why the hero needs `!important` to win.

---

## 6. Icons

**Bootstrap Icons, and nothing else.** No Font Awesome, Remix, Lucide or Material anywhere.

- **143 distinct icons** in use across views, JS and CSS.
- Loaded **pinned at 1.10.5** by `user-layout`, and **unpinned** by the auth, login and admin
  layouts — so the two halves of the app can serve different icon-font versions.

Most-used, by frequency — port these first and the long tail rarely matters:

| Icon | Uses | Icon | Uses |
|---|---:|---|---:|
| `chevron-right` | 38 | `x-lg` | 16 |
| `chevron-left` | 38 | `chevron-down` | 15 |
| `arrow-clockwise` | 35 | `exclamation-triangle` | 14 |
| `x-circle` | 25 | `check-lg` | 14 |
| `trash` | 22 | `image` | 13 |
| `hourglass-split` | 21 | `pencil` | 12 |
| `plus-circle` | 18 | `funnel` | 12 |
| `telephone` | 17 | `inbox` | 11 |
| `search` | 17 | `images` | 11 |
| `info-circle` | 17 | `pencil-square` | 10 |
| `check-circle` | 17 | `eye` | 10 |

### Recommendation

`react-icons/bs` gives a 1:1 port with no visual drift and no mapping work — the names match.
If you'd rather standardise on Lucide (better coverage, more consistent stroke weights),
build a small `<Icon name>` wrapper mapping the 143 names, and expect minor visual
differences.

Either way, tree-shaking means only the icons actually imported ship — a real improvement
over today's full webfont on every page.

---

## 7. Stylesheets being replaced

| File | Lines | Covers | Fate |
|---|---:|---|---|
| [design-system.css](../../../public/css/design-system.css) | 606 | tokens + badge variants | → Tailwind theme + `<Badge>` |
| [user.css](../../../public/css/user.css) | 749 | storefront globals: palette, buttons, forms, navbar, product card, footer, shop filters | → Tailwind utilities + components |
| [checkout.css](../../../public/css/checkout.css) | 1,151 | checkout only: wallet states, order summary, payment animations, PayPal container, coupon section | → checkout feature styles |
| [admin.css](../../../public/css/admin.css) | 844 | admin shell: sidebar, tables, notifications, search, thumbnails | → admin layout + table components |
| [admin/order-details.css](../../../public/css/admin/order-details.css) | 887 | one admin page | **never loads today** — see [defects.md](defects.md) |
| [pagination.css](../../../public/css/pagination.css) | 151 | Bootstrap pagination override | **commented out on the storefront** |
| [components/coupon-card.css](../../../public/css/components/coupon-card.css) | 298 | the decorative coupon card + its font `@import` | → `<CouponCard>` |

**4,686 lines of CSS total.** Roughly 1,040 of it (order-details + pagination) is not even
loaded in the current app.

Add the inline `<style>` blocks in the views — **~13,700 lines** across storefront and admin
pages — and the true CSS surface is over 18,000 lines. That is the number Tailwind is
replacing, and it is where most of the reduction will come from.
