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

export interface SubscribeInput {
  email: string;
  /** The marketing checkbox on the community form. */
  consented: boolean;
}

export const contentApi = api.injectEndpoints({
  endpoints: (build) => ({
    submitContact: build.mutation<{ success: boolean; message?: string }, ContactInput>({
      // No leading /api - the client's baseURL adds it. With it, this posted
      // to /api/api/help/contact and every enquiry 404'd.
      query: (body) => ({ url: '/help/contact', method: 'POST', data: body })
    }),

    subscribe: build.mutation<{ success: boolean; message?: string }, SubscribeInput>({
      query: (body) => ({ url: '/newsletter/subscribe', method: 'POST', data: body })
    })
  })
});

export const { useSubmitContactMutation, useSubscribeMutation } = contentApi;
