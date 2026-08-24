import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { api as client } from '@/api/client';
import { createStore } from '@/app/store';
import { ConfirmProvider } from '@/components/confirm/ConfirmProvider';
import { Toaster } from '@/components/toast';
import DashboardPage from './DashboardPage';
import SalesReportPage from './SalesReportPage';

/**
 * Recharts measures its container to size itself, and jsdom reports every
 * element as 0x0 - so ResponsiveContainer renders nothing without a size.
 * Stubbing the observer lets the chart mount; the assertions here are about
 * the data and the surrounding page, not the SVG.
 */
class ResizeObserverStub {
  observe() {}
  disconnect() {}
  unobserve() {}
}

const renderAt = (element: React.ReactNode, entry = '/admin/x', path = '/admin/x') => {
  const router = createMemoryRouter([{ path, element }], { initialEntries: [entry] });

  render(
    <Provider store={createStore()}>
      <ConfirmProvider>
        <RouterProvider router={router} />
        <Toaster />
      </ConfirmProvider>
    </Provider>
  );

  return router;
};

let mock: MockAdapter;

beforeEach(() => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  mock = new MockAdapter(client);
});

afterEach(() => mock.restore());

describe('DashboardPage', () => {
  /**
   * The shapes these endpoints really return.
   *
   * Copied from dashboard.controller, not invented. The first version of this
   * file guessed - it stubbed sales as an array of points when the endpoint
   * sends two parallel arrays - so the suite passed while the page threw
   * "(sales.data ?? []).map is not a function" on first paint. A mock is only
   * worth as much as its fidelity to the thing it stands in for.
   */
  const stubDashboard = () => {
    // stats: no product count; it reports pending orders instead.
    mock.onGet('/admin/dashboard/api/stats').reply(200, {
      success: true,
      data: { totalRevenue: 125000, totalOrders: 84, totalCustomers: 61, pendingOrders: 7 }
    });

    // sales: labels and values as two parallel arrays, revenue only.
    mock.onGet('/admin/dashboard/api/sales').reply(200, {
      success: true,
      data: { labels: ['Jan', 'Feb'], salesData: [40000, 52000] }
    });

    // revenue-distribution: keyed by payment method, percentage as a string.
    mock.onGet('/admin/dashboard/api/revenue-distribution').reply(200, {
      success: true,
      data: [{ paymentMethod: 'razorpay', revenue: 80000, percentage: '64.00' }]
    });

    // the ranked lists: totalQuantity, and a differently-named label per list.
    mock.onGet('/admin/dashboard/api/best-selling-products').reply(200, {
      success: true,
      data: [{ _id: 'p1', productName: 'Air Max 90', totalQuantity: 12, totalRevenue: 96000 }]
    });
    mock.onGet('/admin/dashboard/api/best-selling-categories').reply(200, { success: true, data: [] });
    mock.onGet('/admin/dashboard/api/best-selling-brands').reply(200, { success: true, data: [] });
  };

  it('shows the headline figures', async () => {
    stubDashboard();

    renderAt(<DashboardPage />);

    expect(await screen.findByText('₹1,25,000')).toBeInTheDocument();
    expect(screen.getByText('84')).toBeInTheDocument();
  });

  it('reports pending orders, which is what the stats endpoint actually sends', async () => {
    stubDashboard();

    renderAt(<DashboardPage />);

    // Awaited, not queried immediately: the label is static markup and renders
    // while the card is still a skeleton, so asserting on it proves nothing
    // about the value having arrived.
    expect(screen.getByText('Pending orders')).toBeInTheDocument();
    expect(await screen.findByText('7')).toBeInTheDocument();
    // There is no product count in the payload; a card for it read zero forever.
    expect(screen.queryByText('Products')).not.toBeInTheDocument();
  });

  it('renders without throwing on the real sales shape', async () => {
    // The regression: sales sends { labels, salesData }, and mapping over it
    // as though it were an array took the whole page down.
    stubDashboard();

    renderAt(<DashboardPage />);

    expect(await screen.findByText('Revenue over time')).toBeInTheDocument();
    expect(screen.queryByText(/is not a function/i)).not.toBeInTheDocument();
  });

  it('names ranked rows from whichever key the list uses', async () => {
    stubDashboard();

    renderAt(<DashboardPage />);

    expect(await screen.findByText('Air Max 90')).toBeInTheDocument();
    expect(screen.getByText('12 sold')).toBeInTheDocument();
  });

  it('refetches every panel when the period changes', async () => {
    stubDashboard();

    renderAt(<DashboardPage />);
    await screen.findByText('₹1,25,000');

    await userEvent.click(screen.getByRole('button', { name: /last 12 weeks/i }));

    const statsCalls = mock.history.get.filter((r) => r.url === '/admin/dashboard/api/stats');
    expect(statsCalls.some((r) => r.params?.period === 'weekly')).toBe(true);
  });

  it('says a ranked list is empty rather than showing a bare heading', async () => {
    stubDashboard();

    renderAt(<DashboardPage />);

    // Categories and brands return nothing in this fixture.
    expect(await screen.findAllByText(/nothing sold in this period/i)).not.toHaveLength(0);
  });
});

describe('SalesReportPage', () => {
  const report = {
    success: true,
    salesStats: {
      totalRevenue: 50000,
      totalOrders: 20,
      averageOrder: 2500,
      totalDiscount: 5000,
      netRevenue: 45000
    },
    dailyAnalysis: [],
    orders: [
      {
        _id: 'o1',
        orderId: 'ORD000123',
        createdAt: '2026-03-09T10:30:00Z',
        date: '9 Mar 2026',
        customer: 'Alice Example',
        paymentMethod: 'cod',
        status: 'Delivered',
        amount: 2000,
        discount: 500,
        finalAmount: 1500
      }
    ],
    pagination: { currentPage: 1, totalPages: 2, totalOrders: 20, hasPrev: false, hasNext: true }
  };

  it('reads the report as JSON from the endpoint added in step 11', async () => {
    // The EJS page had no endpoint - it refetched its own HTML and swapped
    // nodes with DOMParser.
    mock.onGet('/admin/sales-report').reply(200, report);

    renderAt(<SalesReportPage />);

    expect(await screen.findByText('ORD000123')).toBeInTheDocument();
    expect(screen.getByText('₹50,000')).toBeInTheDocument();
    expect(screen.getByText('₹45,000')).toBeInTheDocument();
  });

  it('sends its filters from the URL', async () => {
    mock.onGet('/admin/sales-report').reply(200, report);

    renderAt(
      <SalesReportPage />,
      '/admin/report?timePeriod=yearly&orderStatus=Delivered',
      '/admin/report'
    );

    await screen.findByText('ORD000123');

    const request = mock.history.get.find((r) => r.url === '/admin/sales-report');
    expect(request?.params).toMatchObject({ timePeriod: 'yearly', orderStatus: 'Delivered' });
  });

  it('reveals the date range only for a custom period', async () => {
    mock.onGet('/admin/sales-report').reply(200, report);

    renderAt(<SalesReportPage />);
    await screen.findByText('ORD000123');

    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Period'), 'custom');

    expect(await screen.findByLabelText('From')).toBeInTheDocument();
  });

  it('formats the date itself rather than using the server string', async () => {
    // The server pre-formats `date` for the EJS template; the SPA uses the raw
    // createdAt so dates read the same everywhere.
    mock.onGet('/admin/sales-report').reply(200, report);

    renderAt(<SalesReportPage />);

    expect(await screen.findByText('9 Mar 2026')).toBeInTheDocument();
  });
});
