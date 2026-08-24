import type { ReactNode } from 'react';
import { BsExclamationTriangle } from 'react-icons/bs';
import { errorMessage } from '@/api/client';
import Button from './Button';
import EmptyState from './EmptyState';
import { SkeletonText } from './Skeleton';

/**
 * The four states of a fetch, in one place.
 *
 * Only one view in the whole EJS layer had a real error state - the checkout
 * coupons modal, with a "Try Again" button. Everywhere else a failed request
 * left a spinner turning forever or a section silently blank. Making the error
 * case as easy to render as the loading one is the point of this component.
 *
 * `isEmpty` is a prop rather than inferred, because "empty" differs per screen:
 * an empty array, a zero count, a null object.
 */
export interface QueryBoundaryProps {
  isLoading: boolean;
  error?: unknown;
  isEmpty?: boolean;
  /** Shown while loading. A shape matching the content beats a spinner. */
  skeleton?: ReactNode;
  empty?: ReactNode;
  onRetry?: () => void;
  children: ReactNode;
}

const QueryBoundary = ({
  isLoading,
  error,
  isEmpty = false,
  skeleton,
  empty,
  onRetry,
  children
}: QueryBoundaryProps) => {
  // Loading first: a refetch after an error should show progress, not keep the
  // stale error on screen.
  if (isLoading) {
    return <>{skeleton ?? <SkeletonText lines={4} className="py-4" />}</>;
  }

  if (error) {
    return (
      <EmptyState
        icon={<BsExclamationTriangle className="size-12 text-danger/60" />}
        title="That didn't load"
        message={errorMessage(error, 'Something went wrong fetching this.')}
        action={
          onRetry && (
            <Button variant="outline" onClick={onRetry}>
              Try again
            </Button>
          )
        }
      />
    );
  }

  if (isEmpty) {
    return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  }

  return <>{children}</>;
};

export default QueryBoundary;
