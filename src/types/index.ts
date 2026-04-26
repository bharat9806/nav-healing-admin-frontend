export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEAM_MEMBER';

export type LeadStatus =
  | 'NEW' | 'CONTACTED' | 'CONVERTED' | 'CLOSED'
  | 'NOT_PICK' | 'SWITCH_OFF' | 'NOT_REACHABLE' | 'HANG_UP' | 'CALL_BACK'
  | 'NOT_INTERESTED' | 'OTHER_TREATMENT' | 'DNC'
  | 'HTU' | 'FOLLOW_UP_1' | 'FOLLOW_UP_2' | 'FOLLOW_UP_3';

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
  canViewDashboard: boolean;
  isDoctor: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BlogStatus = 'DRAFT' | 'PUBLISHED';

export interface BlogRelatedFormulation {
  name: string;
  dhatu?: string;
}

export interface Blog {
  id: number;
  slug: string;
  title: string;
  excerpt?: string | null;
  category?: string | null;
  issue?: string | null;
  readTimeMinutes?: number | null;
  authorName?: string | null;
  authorInitials?: string | null;
  content: string;
  heroImage?: string | null;
  heroImageCaption?: string | null;
  relatedFormulations?: BlogRelatedFormulation[] | null;
  status: BlogStatus;
  publishedAt?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlogListItem {
  id: number;
  slug: string;
  title: string;
  excerpt?: string | null;
  category?: string | null;
  issue?: string | null;
  readTimeMinutes?: number | null;
  authorName?: string | null;
  authorInitials?: string | null;
  heroImage?: string | null;
  heroImageCaption?: string | null;
  status: BlogStatus;
  publishedAt?: string | null;
  isActive: boolean;
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

export interface Sale {
  id: number;
  date: string;
  patientName: string;
  productId?: number;
  product?: Product;
  items?: SaleItem[];
  itemCount?: number;
  therapyPrice?: number;
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
