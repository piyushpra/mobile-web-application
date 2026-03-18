import type { ProfileOrder, ProfileServiceRequest } from '../src/app/types';
import {
  getActiveInstallationRequestByOrderId,
  getEligibleInstallationOrders,
  isOrderWithinInstallationWindow,
} from '../src/app/utils/serviceRequests';

const buildOrder = (overrides: Partial<ProfileOrder>): ProfileOrder => ({
  id: 'ord_1',
  orderNumber: 'ORD-1',
  createdAt: '2026-03-18T09:00:00.000Z',
  itemCount: 1,
  total: 1000,
  subtotal: 1000,
  discount: 0,
  deliveryFee: 0,
  status: 'Processing',
  productId: null,
  brand: '',
  category: '',
  model: 'Battery',
  thumbnail: '',
  invoiceApprovalStatus: 'Pending',
  invoiceRequestedAt: '',
  invoiceApprovedAt: null,
  invoiceRejectedAt: null,
  items: [],
  invoice: null,
  ...overrides,
});

const buildRequest = (overrides: Partial<ProfileServiceRequest>): ProfileServiceRequest => ({
  id: 'ins_1',
  createdAt: '2026-03-18T10:00:00.000Z',
  status: 'Pending',
  note: 'Installation requested',
  orderId: 'ord_1',
  orderNumber: 'ORD-1',
  orderCreatedAt: '2026-03-18T09:00:00.000Z',
  ...overrides,
});

describe('service request helpers', () => {
  test('accepts orders inside the 7 day installation window', () => {
    expect(isOrderWithinInstallationWindow('2026-03-12T00:00:00.000Z', new Date('2026-03-18T00:00:00.000Z').getTime())).toBe(true);
  });

  test('rejects orders older than the 7 day installation window', () => {
    expect(isOrderWithinInstallationWindow('2026-03-10T00:00:00.000Z', new Date('2026-03-18T00:00:00.000Z').getTime())).toBe(false);
  });

  test('returns only active installation requests by order id', () => {
    const requests = [
      buildRequest({ id: 'ins_pending', orderId: 'ord_1', status: 'Pending' }),
      buildRequest({ id: 'ins_resolved', orderId: 'ord_2', status: 'Resolved' }),
      buildRequest({ id: 'ins_scheduled', orderId: 'ord_3', status: 'Scheduled' }),
    ];

    expect(getActiveInstallationRequestByOrderId(requests)).toEqual({
      ord_1: requests[0],
      ord_3: requests[2],
    });
  });

  test('filters eligible installation orders to recent, non-cancelled, not-resolved orders', () => {
    const orders = [
      buildOrder({ id: 'ord_recent', orderNumber: 'ORD-RECENT', createdAt: '2026-03-18T00:00:00.000Z' }),
      buildOrder({ id: 'ord_resolved', orderNumber: 'ORD-RESOLVED', createdAt: '2026-03-17T00:00:00.000Z' }),
      buildOrder({ id: 'ord_old', orderNumber: 'ORD-OLD', createdAt: '2026-03-01T00:00:00.000Z' }),
      buildOrder({ id: 'ord_cancelled', orderNumber: 'ORD-CANCELLED', createdAt: '2026-03-18T00:00:00.000Z', status: 'Cancelled' }),
    ];
    const requests = [buildRequest({ id: 'ins_resolved', orderId: 'ord_resolved', status: 'Resolved' })];

    expect(
      getEligibleInstallationOrders(orders, requests, new Date('2026-03-18T12:00:00.000Z').getTime()).map(order => order.id),
    ).toEqual(['ord_recent']);
  });
});
