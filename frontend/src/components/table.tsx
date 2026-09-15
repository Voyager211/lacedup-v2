import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, ToggleLeft, ToggleRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * The bits every table in the app shares.
 *
 * Three things, kept together because they have to agree visually across six
 * tables that are otherwise unrelated: the hover treatment, the row-number
 * column, and the icon buttons in the actions column.
 */

/**
 * Row hover.
 *
 * A tint alone reads as "this row is under the cursor". Lifting it slightly
 * reads as "this row can be opened", which is the intent - most of these rows
 * lead somewhere. The shadow and the 1px rise are both on the compositor, so
 * this costs no layout work while the pointer travels down a long table.
 *
 * `relative` matters: without a stacking context the raised row's shadow is
 * painted under its neighbours and the lift is invisible.
 */
const ROW_LIFT = cn(
  'relative transition-[transform,box-shadow,background-color] duration-150 ease-out',
  'hover:z-10 hover:-translate-y-px hover:bg-white hover:shadow-[0_2px_10px_rgba(0,0,0,0.07)]'
);

/** Rows that lead somewhere: the lift, plus a pointer to say so. */
export const ROW_HOVER = cn(ROW_LIFT, 'cursor-pointer');

/**
 * The same lift without the pointer, for a row with nothing behind it to open.
 *
 * The sales report is a readout - figures for an accountant - and users,
 * coupons and a product's variants have no page of their own. A pointer on any
 * of those would promise a click that does nothing.
 */
export const ROW_HOVER_STATIC = ROW_LIFT;

/** A click that lands on a control inside the row belongs to that control. */
const INTERACTIVE = 'a, button, input, select, textarea, label';

/**
 * Makes a table row open its detail page.
 *
 * Returns a function from a destination to the props for a `<tr>`, so a list
 * calls the hook once and spreads the result per row. Pass `undefined` for a
 * row with nowhere to go and it gets the static hover, not a pointer that lies.
 *
 * Three clicks are left alone: one on a button or link inside the row, which
 * has its own job; one that ends a text selection, since dragging across an
 * order id to copy it is not a request to leave; and a Ctrl/Cmd-click, which
 * opens a tab the way it would on a real link. The row also takes focus and
 * opens on Enter, so the table is not mouse-only.
 */
export const useRowLink = () => {
  const navigate = useNavigate();

  return (to: string | undefined) => {
    if (!to) return { className: ROW_HOVER_STATIC };

    return {
      className: cn(
        ROW_HOVER,
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand'
      ),
      tabIndex: 0,
      onClick: (event: MouseEvent<HTMLTableRowElement>) => {
        if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
        if (window.getSelection()?.toString()) return;

        if (event.metaKey || event.ctrlKey) {
          window.open(to, '_blank', 'noopener');
          return;
        }

        navigate(to);
      },
      onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
        // Only the row's own Enter - not one bubbling up from a button inside it.
        if (event.key === 'Enter' && event.target === event.currentTarget) navigate(to);
      }
    };
  };
};

/** Header cell for the row-number column. */
export const RowNumberHeader = () => (
  <th scope="col" className="w-12 px-4 py-3 text-left font-medium text-ink-muted">
    #
  </th>
);

/**
 * The row's position in the list.
 *
 * Continues across pages - on page 3 of a 10-per-page list the first row is
 * 21, not 1 - because a number that restarts every page tells the reader
 * nothing they cannot already see.
 */
export const RowNumber = ({
  index,
  page = 1,
  perPage = 10
}: {
  index: number;
  page?: number;
  perPage?: number;
}) => (
  <td className="px-4 py-3 text-sm tabular-nums text-ink-muted">
    {(page - 1) * perPage + index + 1}
  </td>
);

type ActionTone = 'default' | 'danger';

export interface RowActionProps {
  icon: LucideIcon;
  /** Names the action for assistive tech and the tooltip; never rendered as text. */
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  tone?: ActionTone;
}

/**
 * Red on hover, like every other button in the app.
 *
 * The destructive one keeps its own red so it is not identical to the three
 * beside it - the row of icons is small, and "delete" wanting to look the same
 * as "view" at the moment of the click is not a feature.
 */
const TONE: Record<ActionTone, string> = {
  default: 'text-ink-muted hover:bg-brand hover:text-white',
  danger: 'text-ink-muted hover:bg-danger hover:text-white'
};

/**
 * One icon button in the actions column.
 *
 * The label is the accessible name and the tooltip, not visible text - a row
 * of four words per row is most of the reason those columns get so wide. An
 * icon alone is only usable if it is still announced, hence the aria-label.
 */
export const RowAction = ({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = 'default'
}: RowActionProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={cn(
      'rounded-md p-2 transition-colors disabled:pointer-events-none disabled:opacity-40',
      TONE[tone]
    )}
  >
    <Icon className="size-4" aria-hidden="true" strokeWidth={2} />
  </button>
);

/** Groups the actions, right-aligned, in a single cell. */
export const RowActions = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center justify-end gap-0.5">{children}</div>
);

/**
 * The icons the actions column uses, so they stay consistent.
 *
 * There is no "view": a row opens its detail page when clicked, so a button
 * that did the same thing was only taking up room.
 */
export const ACTION_ICONS = {
  edit: Pencil,
  delete: Trash2,
  enable: ToggleLeft,
  disable: ToggleRight
} as const;
