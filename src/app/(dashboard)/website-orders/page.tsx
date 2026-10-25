'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Dialog from '@/components/ui/Dialog';
import LoadError, { loadErrorMessage } from '@/components/ui/LoadError';
import { fetchCurrentUser } from '@/lib/current-user';
import { generateOrderInvoice } from '@/lib/generateOrderInvoice';
import { SkeletonList } from '@/components/ui/Loader';
import s from './orders.module.scss';

type OrderStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface OrderItem {
  id: number;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface Order {
  id: number;
  orderRef: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  address: string;
  notes?: string;
  subtotal?: number;
  discountAmount?: number;
  shippingCharges?: number;
  totalAmount: number;
  paymentMethod?: string;
  status: OrderStatus;
  items: OrderItem[];
  createdAt: string;
}

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dashboardFiltersReady, setDashboardFiltersReady] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('status') === 'PENDING') setStatusFilter('PENDING');
    setDashboardFiltersReady(true);
  }, []);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Order | null>(null);
  const [actioning, setActioning] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const [loadError, setLoadError] = useState('');
  const listRequest = useRef(0);

  const fetchOrders = (p = page, status = statusFilter) => {
    const requestId = ++listRequest.current;
    setLoadError('');
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '20' });
    if (status) params.set('status', status);
    api
      .get<{ data: Order[]; total: number; page: number; limit: number }>(
        `/website-orders?${params.toString()}`,
      )
      .then((res) => {
        if (requestId !== listRequest.current) return;
        setOrders(res.data.data);
        setTotal(res.data.total);
        setTotalPages(Math.ceil(res.data.total / 20));
      })
      .catch((error: unknown) => {
        if (requestId === listRequest.current) setLoadError(loadErrorMessage(error, 'Unable to load website orders. Check your connection and try again.'));
      })
      .finally(() => { if (requestId === listRequest.current) setLoading(false); });
  };

  useEffect(() => {
    fetchCurrentUser()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN' && !user.canManageWebsiteOrders) {
          router.replace('/dashboard');
        }
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (dashboardFiltersReady) fetchOrders(page, statusFilter);
  }, [dashboardFiltersReady, page, statusFilter]);

  const handleStatusChange = (filter: string) => {
    setStatusFilter(filter);
    setPage(1);
  };

  const handleApprove = async (id: number) => {
    setActioning(id);
    setActionError('');
    setActionMessage('');
    try {
      await api.patch(`/website-orders/${id}/approve`);
      fetchOrders();
      if (selected?.id === id)
        setSelected((o) => (o ? { ...o, status: 'APPROVED' } : null));
      setActionMessage('Order approved.');
    } catch (error: unknown) {
      setActionError(loadErrorMessage(error, 'The order could not be approved. Please try again.'));
    } finally {
      setActioning(null);
    }
  };

  const handleReject = async (id: number) => {
    setActioning(id);
    setActionError('');
    setActionMessage('');
    try {
      await api.patch(`/website-orders/${id}/reject`);
      fetchOrders();
      if (selected?.id === id)
        setSelected((o) => (o ? { ...o, status: 'REJECTED' } : null));
      setActionMessage('Order rejected.');
    } catch (error: unknown) {
      setActionError(loadErrorMessage(error, 'The order could not be rejected. Please try again.'));
    } finally {
      setActioning(null);
    }
  };

  const downloadInvoice = (o: Order) => {
    const year = new Date(o.createdAt).getFullYear();
    generateOrderInvoice({
      invoiceNumber: `NNH-${year}-${String(o.id).padStart(3, '0')}`,
      date: o.createdAt,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      customerEmail: o.customerEmail,
      address: o.address,
      paymentMethod: o.paymentMethod,
      items: o.items.map((i) => ({
        name: i.productName,
        qty: i.quantity,
        unitPrice: Number(i.unitPrice),
      })),
      subtotal: o.subtotal != null ? Number(o.subtotal) : undefined,
      discountAmount: o.discountAmount != null ? Number(o.discountAmount) : undefined,
      shippingCharges: o.shippingCharges != null ? Number(o.shippingCharges) : undefined,
      totalAmount: Number(o.totalAmount),
    });
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const fmtAmount = (n: number | string) =>
    '₹' + Number(n).toLocaleString('en-IN');

  const statusCls = (st: OrderStatus) => {
    if (st === 'APPROVED') return s.statusApproved;
    if (st === 'REJECTED') return s.statusRejected;
    return s.statusPending;
  };

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.pageTitle}>Website Orders</h1>
        <span className={s.totalBadge}>{total} total</span>
      </div>

      <div className={s.tabs}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            className={`${s.tab} ${statusFilter === tab.value ? s.tabActive : ''}`}
            onClick={() => handleStatusChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {actionError && <div role="alert" className={s.actionNotice}>{actionError}</div>}
      {actionMessage && <div role="status" className={s.actionNotice}>{actionMessage}</div>}
      {loadError ? <LoadError message={loadError} onRetry={() => fetchOrders()} loading={loading} /> : loading ? (
        <SkeletonList rows={6} />
      ) : orders.length === 0 ? (
        <div className={s.emptyBox}>
          <p className={s.emptyText}>No orders found</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className={s.mobileList}>
            {orders.map((o) => (
              <div key={o.id} className={s.mobileCard}>
                <div className={s.mobileCardTop}>
                  <div>
                    <p className={s.orderRef}>{o.orderRef}</p>
                    <p className={s.customerName}>{o.customerName}</p>
                  </div>
                  <span className={`${s.statusBadge} ${statusCls(o.status)}`}>
                    {o.status}
                  </span>
                </div>
                <div className={s.mobileMeta}>
                  <span>{o.customerPhone}</span>
                  <span>{fmtAmount(o.totalAmount)}</span>
                </div>
                <div className={s.mobileActions}>
                  <button
                    className={s.viewBtn}
                    onClick={() => setSelected(o)}
                  >
                    View
                  </button>
                  {o.status === 'PENDING' && (
                    <>
                      <button
                        className={s.approveBtn}
                        disabled={actioning === o.id}
                        onClick={() => handleApprove(o.id)}
                      >
                        {actioning === o.id ? '...' : 'Approve'}
                      </button>
                      <button
                        className={s.rejectBtn}
                        disabled={actioning === o.id}
                        onClick={() => handleReject(o.id)}
                      >
                        {actioning === o.id ? '...' : 'Reject'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead className={s.thead}>
                <tr>
                  <th className={s.th}>Order #</th>
                  <th className={s.th}>Customer</th>
                  <th className={s.th}>Phone</th>
                  <th className={s.th}>Items</th>
                  <th className={s.th}>Total</th>
                  <th className={s.th}>Date</th>
                  <th className={s.th}>Status</th>
                  <th className={`${s.th} ${s.thRight}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className={s.tr}>
                    <td className={s.td}>
                      <span className={s.orderRef}>{o.orderRef}</span>
                    </td>
                    <td className={s.td}>
                      <p className={s.customerName}>{o.customerName}</p>
                      {o.customerEmail && (
                        <p className={s.customerEmail}>{o.customerEmail}</p>
                      )}
                    </td>
                    <td className={s.td}>{o.customerPhone}</td>
                    <td className={s.td}>
                      {o.items.map((i) => (
                        <p key={i.id} className={s.itemLine}>
                          {i.productName} × {i.quantity}
                        </p>
                      ))}
                    </td>
                    <td className={s.td}>
                      <strong>{fmtAmount(o.totalAmount)}</strong>
                    </td>
                    <td className={s.td}>
                      <span className={s.dateText}>{fmt(o.createdAt)}</span>
                    </td>
                    <td className={s.td}>
                      <span
                        className={`${s.statusBadge} ${statusCls(o.status)}`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className={`${s.td} ${s.tdRight}`}>
                      <button
                        className={s.viewBtn}
                        onClick={() => setSelected(o)}
                      >
                        View
                      </button>
                      {o.status === 'PENDING' && (
                        <>
                          <button
                            className={s.approveBtn}
                            disabled={actioning === o.id}
                            onClick={() => handleApprove(o.id)}
                          >
                            {actioning === o.id ? '...' : 'Approve'}
                          </button>
                          <button
                            className={s.rejectBtn}
                            disabled={actioning === o.id}
                            onClick={() => handleReject(o.id)}
                          >
                            {actioning === o.id ? '...' : 'Reject'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={s.pagination}>
              <button
                className={s.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <span className={s.pageInfo}>
                Page {page} of {totalPages}
              </span>
              <button
                className={s.pageBtn}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Order detail modal */}
      {selected && (
        <Dialog className={s.overlay} onClose={() => setSelected(null)} closeDisabled={actioning !== null}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <div>
                <h2 className={s.modalTitle}>{selected.orderRef}</h2>
                <span
                  className={`${s.statusBadge} ${statusCls(selected.status)}`}
                >
                  {selected.status}
                </span>
              </div>
              <button
                className={s.closeBtn}
                onClick={() => setSelected(null)}
              >
                ✕
              </button>
            </div>

            <div className={s.modalBody}>
              {actionError && <p role="alert" className={s.actionNotice}>{actionError}</p>}
              {actionMessage && <p role="status" className={s.actionNotice}>{actionMessage}</p>}
              <div className={s.modalSection}>
                <h3 className={s.modalSectionTitle}>Customer</h3>
                <p><strong>Name:</strong> {selected.customerName}</p>
                <p><strong>Phone:</strong> {selected.customerPhone}</p>
                {selected.customerEmail && (
                  <p><strong>Email:</strong> {selected.customerEmail}</p>
                )}
                <p><strong>Address:</strong> {selected.address}</p>
                {selected.notes && (
                  <p><strong>Notes:</strong> {selected.notes}</p>
                )}
              </div>

              <div className={s.modalSection}>
                <h3 className={s.modalSectionTitle}>Items</h3>
                <table className={s.itemsTable}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((i) => (
                      <tr key={i.id}>
                        <td>{i.productName}</td>
                        <td>{i.quantity}</td>
                        <td>{fmtAmount(i.unitPrice)}</td>
                        <td>{fmtAmount(Number(i.unitPrice) * i.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {Number(selected.discountAmount) > 0 && (
                      <>
                        <tr>
                          <td colSpan={3}>Subtotal</td>
                          <td>{fmtAmount(selected.subtotal ?? selected.totalAmount)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3}>Prepaid discount (10%)</td>
                          <td>− {fmtAmount(selected.discountAmount ?? 0)}</td>
                        </tr>
                      </>
                    )}
                    <tr>
                      <td colSpan={3}><strong>Total</strong></td>
                      <td><strong>{fmtAmount(selected.totalAmount)}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className={s.modalDate}>
                Placed on {fmt(selected.createdAt)}
              </p>
            </div>

            <div className={s.modalFooter}>
              <button
                type="button"
                className={s.invoiceBtn}
                onClick={() => downloadInvoice(selected)}
              >
                ↓ Download Invoice
              </button>
              {selected.status === 'PENDING' && (
                <div className={s.modalFooterActions}>
                  <button
                    className={s.rejectBtn}
                    disabled={actioning === selected.id}
                    onClick={() => handleReject(selected.id)}
                  >
                    {actioning === selected.id ? 'Processing...' : '✕ Reject'}
                  </button>
                  <button
                    className={s.approveBtn}
                    disabled={actioning === selected.id}
                    onClick={() => handleApprove(selected.id)}
                  >
                    {actioning === selected.id ? 'Processing...' : '✓ Approve'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
