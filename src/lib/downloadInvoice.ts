import type { OrderInvoiceData } from './generateOrderInvoice';
export type { OrderInvoiceData } from './generateOrderInvoice';

// PDF code and the embedded signature font load only when a download is requested.
export async function generateOrderInvoice(data: OrderInvoiceData) {
  const invoices = await import('./generateOrderInvoice');
  invoices.generateOrderInvoice(data);
}

export async function generateBulkOrderInvoices(list: OrderInvoiceData[], fileName?: string) {
  if (!list.length) return;
  const invoices = await import('./generateOrderInvoice');
  invoices.generateBulkOrderInvoices(list, fileName);
}
