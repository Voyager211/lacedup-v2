import type { FilterQuery, Model, Query } from 'mongoose';

export interface PaginatedResult<T> {
  data: T[];
  totalPages: number;
  /** Matching documents across every page, not just this one. */
  totalRecords: number;
}

/**
 * Applies skip/limit to an existing query and counts the matching documents in
 * parallel.
 *
 * `filter` must be the same filter the queryBuilder was built from - the count
 * is computed independently, so passing a different filter silently produces a
 * page count that does not match the data.
 */
export const getPagination = async <T>(
  queryBuilder: Query<T[], T>,
  model: Model<T>,
  filter: FilterQuery<T>,
  page = 1,
  limit = 10
): Promise<PaginatedResult<T>> => {
  const skip = (page - 1) * limit;

  const [data, count] = await Promise.all([
    queryBuilder.skip(skip).limit(limit),
    model.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(count / limit);

  // The count is already paid for by the page maths, so returning it costs
  // nothing and saves callers a second countDocuments for the same filter.
  return { data, totalPages, totalRecords: count };
};
