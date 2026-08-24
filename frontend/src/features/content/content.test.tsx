import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { api as client } from '@/api/client';
import { createStore } from '@/app/store';
import { Toaster } from '@/components/toast';
import AboutPage from './AboutPage';
import HelpPage from './HelpPage';

/**
 * The last two pages to leave EJS.
 *
 * Both were static templates - 759 and 878 lines, almost all of it inline CSS.
 * The only behaviour between them is the contact form, which already posted
 * JSON. These tests cover that the copy survived the port and that the form
 * still reaches the same endpoint.
 */

const renderPage = (element: React.ReactNode) => {
  const router = createMemoryRouter(
    [
      { path: '/', element },
      { path: '/shop', element: <p>shop</p> },
      { path: '/help', element: <p>help</p> }
    ],
    { initialEntries: ['/'] }
  );

  render(
    <Provider store={createStore()}>
      <RouterProvider router={router} />
      <Toaster />
    </Provider>
  );

  return router;
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(client);
});

afterEach(() => mock.restore());

describe('AboutPage', () => {
  it('keeps the story copy from the template', async () => {
    renderPage(<AboutPage />);

    expect(screen.getByRole('heading', { name: /about lacedup/i })).toBeInTheDocument();
    expect(screen.getByText(/born from a deep passion for sneaker culture/i)).toBeInTheDocument();
  });

  it('keeps the four promises', () => {
    renderPage(<AboutPage />);

    expect(screen.getByText('100% authentic')).toBeInTheDocument();
    expect(screen.getByText('Latest releases')).toBeInTheDocument();
    expect(screen.getByText('Passion-driven service')).toBeInTheDocument();
    expect(screen.getByText('Community focus')).toBeInTheDocument();
  });

  it('sends shoppers to the shop', async () => {
    const router = renderPage(<AboutPage />);

    await userEvent.click(screen.getByRole('button', { name: /browse collection/i }));

    expect(router.state.location.pathname).toBe('/shop');
  });
});

describe('HelpPage', () => {
  it('lists the questions collapsed', () => {
    renderPage(<HelpPage />);

    const question = screen.getByRole('button', { name: /what is your shipping policy/i });

    expect(question).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/free shipping on all orders above/i)).not.toBeInTheDocument();
  });

  it('reveals an answer when its question is opened', async () => {
    renderPage(<HelpPage />);

    await userEvent.click(screen.getByRole('button', { name: /what is your shipping policy/i }));

    expect(screen.getByText(/free shipping on all orders above/i)).toBeInTheDocument();
  });

  it('keeps every question from the template', () => {
    renderPage(<HelpPage />);

    // Ten in the EJS accordion; a smaller number means copy was lost.
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(10);
  });

  it('validates before sending anything', async () => {
    renderPage(<HelpPage />);

    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText(/please enter your name/i)).toBeInTheDocument();
    expect(mock.history.post).toHaveLength(0);
  });

  it('posts the enquiry to the same endpoint as before', async () => {
    mock.onPost('/api/help/contact').reply(200, { success: true, message: 'Message sent.' });

    renderPage(<HelpPage />);

    await userEvent.type(screen.getByLabelText(/full name/i), 'Alice Example');
    await userEvent.type(screen.getByLabelText(/email address/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/subject/i), 'Sizing');
    await userEvent.type(screen.getByLabelText(/message/i), 'Do these run large?');

    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText('Message sent.')).toBeInTheDocument();
    expect(JSON.parse(mock.history.post[0]!.data)).toMatchObject({
      name: 'Alice Example',
      email: 'alice@example.com',
      subject: 'Sizing',
      message: 'Do these run large?'
    });
  });

  it('surfaces a server error rather than claiming success', async () => {
    mock.onPost('/api/help/contact').reply(400, { message: 'Invalid email address' });

    renderPage(<HelpPage />);

    await userEvent.type(screen.getByLabelText(/full name/i), 'Alice Example');
    await userEvent.type(screen.getByLabelText(/email address/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/subject/i), 'Sizing');
    await userEvent.type(screen.getByLabelText(/message/i), 'Do these run large?');

    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText('Invalid email address')).toBeInTheDocument();
  });
});
