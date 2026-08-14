export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEAM_MEMBER';

export type LeadStatus =
  | 'NEW' | 'CONTACTED' | 'CONVERTED' | 'CLOSED'
  | 'NOT_PICK' | 'SWITCH_OFF' | 'NOT_REACHABLE' | 'HANG_UP' | 'CALL_BACK'
  | 'NOT_INTERESTED' | 'OTHER_TREATMENT' | 'DNC'
  | 'HTU' | 'FOLLOW_UP_1' | 'FOLLOW_UP_2' | 'FOLLOW_UP_3';

export type DeliveryStatus = 'NONE' | 'DELIVERED' | 'RTO' | 'CANCELLED';

export type PaymentMode = 'UPI' | 'COD';
// How the order is paid: on delivery, fully in advance, or advance + balance on delivery.
export type PaymentType = 'COD' | 'PREPAID' | 'PARTIAL';

export interface User {
  id: number;
  email: string;
  username: string;
  userCode: string;
  role: Role;
  isActive: boolean;
  canManageProducts: boolean;
  canManageProductSales: boolean;
  canManageLeads: boolean;
  canManageSales: boolean;
  canExportProducts: boolean;
  canExportProductSales: boolean;
  canExportLeads: boolean;
  canExportSales: boolean;
  canManageUsers: boolean;
  canManageBlogs: boolean;
  canManageWebsiteOrders: boolean;
  canManageProspects: boolean;
  canExportProspects: boolean;
  canManageExpenses: boolean;
  canExportExpenses: boolean;
  canEditSalePrice: boolean;
  canDownloadLeadInvoices: boolean;
  canDownloadSalesInvoices: boolean;
  canViewDashboard: boolean;
  isDoctor: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  message: string;
  user: User;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

export interface Company {
  id: number;
  name: string;
  skuPrefix: string;
  isActive: boolean;
}

export type ExpensePaymentMethod =
  | 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CARD' | 'CHEQUE' | 'OTHER';

export interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  vendor?: string | null;
  paymentMethod: ExpensePaymentMethod;
  notes?: string | null;
  expenseDate: string;
  companyId?: number | null;
  company?: { id: number; name: string; skuPrefix: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpensesResponse {
  data: Expense[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    totalAmount: number;
  };
}

export interface ExpenseStats {
  totalCount: number;
  totalAmount: number;
  thisMonthAmount: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  category: string;
  subcategory?: string;
  isActive: boolean;
  currentStock: number;
  reorderLevel: number;
  companyId?: number | null;
  company?: Company | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadItem {
  id: number;
  leadId: number;
  productId: number;
  quantity: number;
  product?: Product;
  createdAt: string;
}

export interface Lead {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  description?: string;
  age?: number;
  height?: number;
  weight?: number;
  bmi?: number;
  gender?: string;
  address?: string;
  pinCode?: string;
  trackingNumber?: string;
  diseases?: string;
  alternatePhone?: string;
  assignedDoctorId?: number;
  assignedDoctor?: { id: number; username: string };
  status: LeadStatus;
  notes?: string;
  deliveryStatus?: DeliveryStatus;
  paymentReceived?: boolean;
  paymentAmount?: number;
  discount?: number;
  shippingCharges?: number;
  paymentMode?: PaymentMode;
  paymentType?: PaymentType;
  deliveredAt?: string;
  nextFollowUpDate?: string;
  lastContactedAt?: string;
  items: LeadItem[];
  createdAt: string;
  updatedAt: string;
}

export interface LeadReminderStats {
  scheduled: number;
  overdue: number;
  dueToday: number;
  upcoming: number;
}

export type ProspectStatus =
  | 'NEW' | 'CONTACTED' | 'CALL_BACK' | 'NOT_PICK'
  | 'SWITCH_OFF' | 'NOT_REACHABLE' | 'HANG_UP' | 'NOT_INTERESTED'
  | 'DNC' | 'FOLLOW_UP_1' | 'FOLLOW_UP_2' | 'FOLLOW_UP_3' | 'CONVERTED';

export interface Prospect {
  id: number;
  name?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  city?: string | null;
  source?: string | null;
  status: ProspectStatus;
  notes?: string | null;
  assignedAgentId?: number | null;
  assignedAgent?: { id: number; username: string } | null;
  nextFollowUpDate?: string | null;
  lastContactedAt?: string | null;
  convertedLeadId?: number | null;
  convertedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectsResponse {
  data: Prospect[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface Sale {
  id: number;
  date: string;
  patientName: string;
  productId?: number;
  product?: Product;
  items?: SaleItem[];
  itemCount?: number;
  therapyPrice?: number;
  discount?: number;
  amount: number;
  paymentMode: string;
  status: string;
  pendingAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  customName?: string | null;
  product?: Product;
  createdAt: string;
  updatedAt: string;
}

export interface SaleProductsResponse {
  saleId: number;
  itemCount: number;
  therapyPrice?: number;
  products: Array<{
    name: string;
    quantity: number;
  }>;
}

export interface PatientSaleHistoryVisit {
  id: number;
  date: string;
  updatedAt: string;
  amount: number;
  paymentMode: string;
  status: string;
  pendingAmount: number;
  notes?: string;
  therapyPrice?: number;
  itemCount: number;
  products: Array<{
    name: string;
    quantity: number;
  }>;
}

export interface PatientSaleHistoryResponse {
  patientName: string;
  totalVisits: number;
  firstVisitDate: string;
  lastVisitDate: string;
  lastUpdatedAt: string;
  totalAmount: number;
  totalPendingAmount: number;
  visits: PatientSaleHistoryVisit[];
}

export interface ProductSaleItem {
  id: number;
  productId: number;
  product?: Product;
  date: string;
  quantity: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientListItem {
  id: number;
  name: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  interactionCount: number;
  lastInteractionAt?: string | null;
}

export interface PatientInteraction {
  id: number;
  patientId: number;
  interactionDate: string;
  type: string;
  summary?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: number;
    username: string;
  };
}

export interface PatientDetail {
  id: number;
  name: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  interactionCount: number;
  salesSummary: {
    totalSales: number;
    lastSaleDate?: string | null;
    totalAmount: number;
    totalPendingAmount: number;
  };
  recentSales: Array<{
    id: number;
    date: string;
    amount: number;
    pendingAmount: number;
    paymentMode: string;
    status: string;
    notes?: string;
  }>;
  interactions: PatientInteraction[];
}

// ─── STAFF WORK LOG ──────────────────────────────────────────────

export type WorkLogCategory =
  | 'CALLING'
  | 'RECEPTION'
  | 'FOLLOW_UP'
  | 'DATA_ENTRY'
  | 'DISPATCH'
  | 'MEETING'
  | 'ADMIN_WORK'
  | 'OTHER';

export type WorkLogStatus = 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';

export type CallOutcome =
  | 'CONNECTED'
  | 'NOT_PICKED'
  | 'BUSY'
  | 'SWITCHED_OFF'
  | 'NOT_REACHABLE'
  | 'WRONG_NUMBER'
  | 'CALL_BACK'
  | 'INTERESTED'
  | 'NOT_INTERESTED'
  | 'ORDER_PLACED';

export interface WorkLogCall {
  id: number;
  workLogId: number;
  phone: string;
  contactName?: string | null;
  outcome: CallOutcome;
  durationSeconds?: number | null;
  notes?: string | null;
  calledAt?: string | null;
  leadId?: number | null;
  prospectId?: number | null;
  patientId?: number | null;
  lead?: { id: number; name: string } | null;
  prospect?: { id: number; name?: string | null } | null;
  patient?: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkLog {
  id: number;
  userId: number;
  user?: { id: number; username: string; userCode: string };
  logDate: string;
  category: WorkLogCategory;
  title: string;
  description?: string | null;
  status: WorkLogStatus;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  calls: WorkLogCall[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkLogsResponse {
  data: WorkLog[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface WorkLogStats {
  entries: number;
  minutes: number;
  calls: number;
  callsConnected: number;
  byUser: Array<{
    userId: number;
    username: string;
    entries: number;
    minutes: number;
  }>;
}

// ─── DAILY REPORT ────────────────────────────────────────────────
// Hand-entered end-of-day summary of ad enquiries, orders and sales.
export interface DailyReport {
  id: number;
  /** ISO date string; the column is a DATE so treat it as date-only. */
  reportDate: string;
  totalCalls: number;
  verifiedOrders: number;
  tenPercentOffOrders: number;
  totalSale: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReportTotals {
  totalCalls: number;
  verifiedOrders: number;
  tenPercentOffOrders: number;
  totalSale: number;
}

export interface DailyReportsResponse {
  data: DailyReport[];
  meta: DailyReportTotals & { count: number };
}
