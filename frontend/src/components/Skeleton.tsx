import { cn } from '@/lib/cn';

/**
 * Loading placeholders.
 *
 * The EJS layer had none - no skeleton, placeholder-glow or placeholder-wave
 * anywhere - so every list either flashed a centred spinner or sat blank.
 * Shapes that match the eventual content stop the layout jumping when data
 * lands.
 */
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-md bg-line/60', className)} aria-hidden="true" />
);

export const SkeletonText = ({ lines = 3, className }: { lines?: number; className?: string }) => (
  <div className={cn('space-y-2', className)} aria-hidden="true">
    {Array.from({ length: lines }, (_, index) => (
      <Skeleton
        key={index}
        // The last line stops short, the way a paragraph does.
        className={cn('h-4', index === lines - 1 ? 'w-2/3' : 'w-full')}
      />
    ))}
  </div>
);

export const SkeletonCard = () => (
  <div className="rounded-lg border border-line bg-white p-4" aria-hidden="true">
    <Skeleton className="aspect-square w-full" />
    <Skeleton className="mt-4 h-4 w-3/4" />
    <Skeleton className="mt-2 h-4 w-1/2" />
    <Skeleton className="mt-4 h-5 w-1/3" />
  </div>
);

export const SkeletonGrid = ({ count = 8 }: { count?: number }) => (
  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
    {Array.from({ length: count }, (_, index) => (
      <SkeletonCard key={index} />
    ))}
  </div>
);

export const SkeletonTable = ({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) => (
  <div className="space-y-3" aria-hidden="true">
    {Array.from({ length: rows }, (_, row) => (
      <div key={row} className="flex gap-4">
        {Array.from({ length: columns }, (_, column) => (
          <Skeleton key={column} className={cn('h-10', column === 0 ? 'w-16' : 'flex-1')} />
        ))}
      </div>
    ))}
  </div>
);
