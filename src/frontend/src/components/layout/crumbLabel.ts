import { createContext, useContext, useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Crumb } from '@/components/Breadcrumbs';
import type { CrumbDetail } from './storefrontNav';

/**
 * How a page names itself in the trail the shell draws.
 *
 * The trail is derived from the route, which is what guarantees every page has
 * one. But the route cannot know a product's title or an order's id, so the
 * shell owns a slot the current page fills in - "Air Max 90" instead of
 * "Product", "ORD000123" instead of "Order".
 *
 * The shell holds the state and passes its setter down; a page that says
 * nothing leaves the derived label in place. Filling it from an effect means
 * the trail renders with the placeholder for one frame - which is the same
 * frame the page spends on its skeleton, so nothing flickers into view and back
 * out again.
 */

const SetCrumbDetail = createContext<Dispatch<SetStateAction<CrumbDetail>> | null>(null);

export const CrumbDetailProvider = SetCrumbDetail.Provider;

/**
 * Names the current page in the breadcrumb trail.
 *
 * Pass `undefined` while the name is still loading - the derived placeholder
 * stays until there is something better to show. `parents` inserts crumbs
 * between the derived trail and this page, for a level the route does not
 * express: a product's category, for instance.
 */
export const usePageCrumb = (label?: string, parents?: Crumb[]) => {
  const setDetail = useContext(SetCrumbDetail);

  /*
   * `parents` is a fresh array on every render and its icons are components,
   * so it cannot go in the dependency list as-is - the effect would re-run
   * forever. Its shape is the only part that can change meaningfully.
   */
  const parentKey = parents?.map((crumb) => `${crumb.label}|${crumb.to ?? ''}`).join('>') ?? '';

  useEffect(() => {
    if (!setDetail) return undefined;

    setDetail({ label, parents });
    // Clearing on the way out matters: without it, a name set here would still
    // be showing on the next page if that page sets none of its own.
    return () => setDetail({});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parentKey stands in for parents
  }, [setDetail, label, parentKey]);
};
