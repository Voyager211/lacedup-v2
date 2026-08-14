import { api } from '@/api/api';

/**
 * Static content endpoints.
 *
 * `/about` and `/help` had no data behind them - they were static EJS - so the
 * only endpoint here is the contact form, which already answered JSON.
 */

export interface ContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export const contentApi = api.injectEndpoints({
  endpoints: (build) => ({
    submitContact: build.mutation<{ success: boolean; message?: string }, ContactInput>({
      query: (body) => ({ url: '/api/help/contact', method: 'POST', data: body })
    })
  })
});

export const { useSubmitContactMutation } = contentApi;
