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
  amount: number;
  paymentMode: string;
  status: string;
  pendingAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
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
