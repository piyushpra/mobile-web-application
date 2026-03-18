import type { ProfileOrder, ProfileServiceRequest } from '../types';

export const INSTALLATION_REQUEST_ELIGIBILITY_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

function toTimestamp(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  const timestamp = parsed.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isOrderWithinInstallationWindow(value: unknown, nowMs = Date.now(), days = INSTALLATION_REQUEST_ELIGIBILITY_DAYS) {
  const timestamp = toTimestamp(value);
  if (timestamp === null) {
    return false;
  }
  const diffMs = nowMs - timestamp;
  return diffMs >= 0 && diffMs <= days * DAY_MS;
}

export function getActiveInstallationRequestByOrderId(requests: ProfileServiceRequest[]) {
  const activeRequestsByOrderId: Record<string, ProfileServiceRequest> = {};

  requests.forEach(request => {
    const orderId = String(request.orderId || '').trim();
    if (!orderId || request.status === 'Resolved' || activeRequestsByOrderId[orderId]) {
      return;
    }
    activeRequestsByOrderId[orderId] = request;
  });

  return activeRequestsByOrderId;
}

export function getEligibleInstallationOrders(orders: ProfileOrder[], requests: ProfileServiceRequest[], nowMs = Date.now()) {
  const resolvedOrderIds = new Set(
    requests
      .filter(request => request.status === 'Resolved')
      .map(request => String(request.orderId || '').trim())
      .filter(Boolean),
  );

  return orders.filter(order => {
    if (order.status === 'Cancelled') {
      return false;
    }
    if (!isOrderWithinInstallationWindow(order.createdAt, nowMs)) {
      return false;
    }
    return !resolvedOrderIds.has(String(order.id || '').trim());
  });
}
