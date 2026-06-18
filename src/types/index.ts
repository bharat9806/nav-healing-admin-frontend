export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEAM_MEMBER';

export type LeadStatus =
  | 'NEW' | 'CONTACTED' | 'CONVERTED' | 'CLOSED'
  | 'NOT_PICK' | 'SWITCH_OFF' | 'NOT_REACHABLE' | 'HANG_UP' | 'CALL_BACK'
  | 'NOT_INTERESTED' | 'OTHER_TREATMENT' | 'DNC'
  | 'HTU' | 'FOLLOW_UP_1' | 'FOLLOW_UP_2' | 'FOLLOW_UP_3';

export type DeliveryStatus = 'NONE' | 'DELIVERED' | 'RTO' | 'CANCELLED';

export type PaymentMode = 'UPI' | 'COD';

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
  paymentMode?: PaymentMode;
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
