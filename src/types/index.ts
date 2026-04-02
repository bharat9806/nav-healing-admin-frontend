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
  role: Role;
  isActive: boolean;
  canManageProducts: boolean;
  canManageLeads: boolean;
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
  name: string;
  description?: string;
  price: number;
  image?: string;
  category: string;
  isActive: boolean;
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
  items: LeadItem[];
  createdAt: string;
  updatedAt: string;
}
