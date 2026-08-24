import { useState } from 'react';
import { BsCheck2, BsCopy, BsPeople } from 'react-icons/bs';
import {
  useGetReferralEarningsQuery,
  useGetReferralsQuery,
  useGetReferredUsersQuery
} from './account.api';
import { AccountLayout } from './AccountNav';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Pagination from '@/components/Pagination';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonText } from '@/components/Skeleton';
import { useToast } from '@/components/toast';
import { formatDate, formatINR } from '@/lib/format';

/**
 * Referrals.
 *
 * Both paginators here call endpoints that existed as handlers but were never
 * mounted, so page 2 of either list has never worked for anyone since the
 * feature shipped. They are mounted in step 8; these are their first working
 * consumers.
 */
const ReferralsPage = () => {
  const toast = useToast();

  const { data, isLoading, error, refetch } = useGetReferralsQuery();

  const [referralsPage, setReferralsPage] = useState(1);
  const [earningsPage, setEarningsPage] = useState(1);

  // Page 1 comes with the summary; later pages use the paginators.
  const referredPage = useGetReferredUsersQuery(referralsPage, { skip: referralsPage === 1 });
  const earnings = useGetReferralEarningsQuery(earningsPage, { skip: earningsPage === 1 });

  const referredUsers =
    referralsPage === 1 ? (data?.referredUsers ?? []) : (referredPage.data?.referredUsers ?? []);

  const transactions =
    earningsPage === 1
      ? (data?.referralTransactions ?? [])
      : (earnings.data?.transactions ?? []);

  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (!data?.referralLink) return;

    try {
      await navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused outright; the link is on screen and
      // selectable, so this is a nicety rather than the only route.
      toast.info('Copy the link from the box above');
    }
  };

  return (
    <AccountLayout title="Refer a friend">
      <QueryBoundary
        isLoading={isLoading}
        error={error}
        skeleton={<SkeletonText lines={6} />}
        onRetry={refetch}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-white p-5">
            <p className="text-sm text-ink-muted">Friends referred</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-ink">
              {data?.totalReferrals ?? 0}
            </p>
          </div>

          <div className="rounded-lg border border-line bg-white p-5">
            <p className="text-sm text-ink-muted">Earned</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-success">
              {formatINR(data?.totalEarnings ?? 0)}
            </p>
          </div>

          <div className="rounded-lg border border-line bg-white p-5">
            <p className="text-sm text-ink-muted">Your code</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-ink">
              {data?.referralCode ?? '—'}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-line bg-white p-5">
          <label htmlFor="referral-link" className="block text-sm font-medium text-ink">
            Your invite link
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="referral-link"
              readOnly
              value={data?.referralLink ?? ''}
              onFocus={(event) => event.target.select()}
              className="min-w-0 flex-1 rounded-md border border-line bg-card px-3 py-2 font-mono text-sm text-ink"
            />
            <Button
              variant="outline"
              onClick={copyLink}
              icon={
                copied ? (
                  <BsCheck2 className="size-4 text-success" aria-hidden="true" />
                ) : (
                  <BsCopy className="size-4" aria-hidden="true" />
                )
              }
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Your friend gets wallet credit when they sign up, and so do you.
          </p>
        </div>

        <section className="mt-8">
          <h2 className="mb-3 font-heading text-lg font-semibold text-ink">People you referred</h2>

          {referredUsers.length === 0 ? (
            <EmptyState
              icon={<BsPeople className="size-12" />}
              title="Nobody yet"
              message="Share your link and they will show up here."
            />
          ) : (
            <>
              <ul className="divide-y divide-line rounded-lg border border-line bg-white">
                {referredUsers.map((person) => (
                  <li key={person._id} className="flex justify-between gap-4 p-4">
                    <span className="min-w-0">
                      <span className="block truncate text-ink">{person.name}</span>
                      <span className="block truncate text-sm text-ink-muted">{person.email}</span>
                    </span>
                    <span className="shrink-0 text-sm text-ink-muted">
                      {formatDate(person.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>

              {(data?.referralsTotalPages ?? 0) > 1 && (
                <Pagination
                  className="mt-4"
                  currentPage={referralsPage}
                  totalPages={data?.referralsTotalPages ?? 1}
                  disabled={referredPage.isFetching}
                  onPageChange={setReferralsPage}
                  label="Referred people pagination"
                />
              )}
            </>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-3 font-heading text-lg font-semibold text-ink">Rewards earned</h2>

          {transactions.length === 0 ? (
            <EmptyState title="No rewards yet" message="Rewards land in your wallet." />
          ) : (
            <>
              <ul className="divide-y divide-line rounded-lg border border-line bg-white">
                {transactions.map((entry) => (
                  <li key={entry.transactionId} className="flex justify-between gap-4 p-4">
                    <span className="min-w-0">
                      <span className="block truncate text-ink">{entry.description}</span>
                      <span className="block text-sm text-ink-muted">
                        {formatDate(entry.date)}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold text-success">
                      +{formatINR(entry.amount)}
                    </span>
                  </li>
                ))}
              </ul>

              {(data?.earningsTotalPages ?? 0) > 1 && (
                <Pagination
                  className="mt-4"
                  currentPage={earningsPage}
                  totalPages={data?.earningsTotalPages ?? 1}
                  disabled={earnings.isFetching}
                  onPageChange={setEarningsPage}
                  label="Rewards pagination"
                />
              )}
            </>
          )}
        </section>
      </QueryBoundary>
    </AccountLayout>
  );
};

export default ReferralsPage;
