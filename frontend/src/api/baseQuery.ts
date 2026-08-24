import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import type { AxiosRequestConfig } from 'axios';
import axios from 'axios';
import { api as client } from './client';

/**
 * RTK Query over the existing axios instance.
 *
 * Not fetchBaseQuery, because the refresh-on-401 interceptor lives on the
 * axios client - going around it would mean every RTK Query call skipped the
 * session recovery that ordinary calls get, and expired sessions would surface
 * as errors instead of quietly refreshing.
 */
export interface QueryArgs {
  url: string;
  method?: AxiosRequestConfig['method'];
  data?: unknown;
  params?: Record<string, unknown>;
  headers?: AxiosRequestConfig['headers'];
}

export interface QueryError {
  status?: number;
  data?: unknown;
  message: string;
}

export const axiosBaseQuery = (): BaseQueryFn<QueryArgs | string, unknown, QueryError> =>
  async (args, { signal }) => {
    const config: QueryArgs = typeof args === 'string' ? { url: args } : args;

    try {
      const result = await client.request({
        url: config.url,
        method: config.method ?? 'GET',
        data: config.data,
        params: config.params,
        headers: config.headers,
        // Lets RTK Query abort in-flight requests when a component unmounts or
        // a query is superseded - which matters most for the search typeahead,
        // where results arriving out of order would show the wrong list.
        signal
      });

      return { data: result.data };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          error: {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
          }
        };
      }

      return { error: { message: error instanceof Error ? error.message : 'Request failed' } };
    }
  };
