import { useSearchParams } from 'react-router-dom';
import {
  useBlockUserMutation,
  useGetAdminUsersQuery,
  useUnblockUserMutation,
  type AdminUserRow
} from './adminOps.api';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonTable } from '@/components/Skeleton';
import { useConfirm } from '@/components/confirm/useConfirm';
import { useToast } from '@/components/toast';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ACTION_ICONS, ROW_HOVER, RowAction, RowActions, RowNumber, RowNumberHeader } from '@/components/table';

/**
 * Users.
 *
 * Block and unblock only - there is no create, edit or delete, and the server
 * hard-filters to `role: 'user'`, so admins never appear in this list.
 */
const AdminUsersPage = () => {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();

  const page = Number(params.get('page')) || 1;
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';

  const { data, isLoading, isFetching, error, refetch } = useGetAdminUsersQuery({
    page,
    q,
    status
  });

  const [blockUser] = useBlockUserMutation();
  const [unblockUser] = useUnblockUserMutation();

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const toggleBlocked = async (user: AdminUserRow) => {
    if (user.isBlocked) {
      try {
        await unblockUser(user._id).unwrap();
        toast.success(`${user.name} can sign in again`);
      } catch (caught) {
        toast.fromError(caught, 'Could not unblock that account.');
      }
      return;
    }

    const ok = await confirm({
      title: `Block ${user.name}?`,
      message:
        'They are signed out immediately — blocking is checked on every request and revokes their sessions, not just at token expiry.',
      confirmLabel: 'Block',
      tone: 'danger'
    });

    if (!ok) return;

    try {
      await blockUser(user._id).unwrap();
      toast.success(`${user.name} is blocked`);
    } catch (caught) {
      toast.fromError(caught, 'Could not block that account.');
    }
  };

  const users = data?.users ?? [];

  return (
    <div>
      <h1 className="mb-5 font-heading text-2xl font-semibold text-ink">Users</h1>

      <FilterBar
        search={q}
        onSearchChange={(value) => setParam('q', value)}
        searchPlaceholder="Search by name, email or phone…"
        filters={[
          {
            name: 'status',
            label: 'Status',
            allLabel: 'All',
            options: [
              { value: 'unblocked', label: 'Active' },
              { value: 'blocked', label: 'Blocked' }
            ]
          }
        ]}
        values={{ status }}
        onFilterChange={setParam}
        onReset={() => setParams({})}
      />

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        isEmpty={users.length === 0}
        skeleton={<SkeletonTable rows={6} columns={4} />}
        empty={<EmptyState title="No users match that" />}
        onRetry={refetch}
      >
        <div className={cn('overflow-x-auto rounded-lg border border-line bg-white', isFetching && 'opacity-60')}>
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-card/50 text-left">
              <tr>
                <RowNumberHeader />
                <th className="px-4 py-3 font-medium text-ink">Name</th>
                <th className="px-4 py-3 font-medium text-ink">Email</th>
                <th className="px-4 py-3 font-medium text-ink">Joined</th>
                <th className="px-4 py-3 font-medium text-ink">Status</th>
                <th className="px-4 py-3 text-right font-medium text-ink">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {users.map((user, index) => (
                <tr key={user._id} className={ROW_HOVER}>
                  <RowNumber index={index} page={data?.currentPage ?? 1} />
                  <td className="px-4 py-3 font-medium text-ink">{user.name}</td>
                  <td className="px-4 py-3 text-ink-muted">{user.email}</td>
                  <td className="px-4 py-3 text-ink-muted">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={user.isBlocked ? 'danger' : 'success'} size="sm">
                      {user.isBlocked ? 'Blocked' : 'Active'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions>
                      <RowAction
                        icon={user.isBlocked ? ACTION_ICONS.enable : ACTION_ICONS.disable}
                        label={user.isBlocked ? 'Unblock user' : 'Block user'}
                        onClick={() => toggleBlocked(user)}
                        tone={user.isBlocked ? 'default' : 'danger'}
                      />
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(data?.totalPages ?? 0) > 1 && (
          <Pagination
            className="mt-6"
            currentPage={data?.currentPage ?? 1}
            totalPages={data?.totalPages ?? 1}
            disabled={isFetching}
            onPageChange={(next) => setParam('page', String(next))}
          />
        )}
      </QueryBoundary>
    </div>
  );
};

export default AdminUsersPage;
