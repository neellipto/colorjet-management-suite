import React, { createContext, useContext, useEffect, useState } from 'react';
import type {
  Company, Customer, DeliveryOrder, Engineer, Expense, Invoice, MarketingTask,
  Notification, Payment, Product, ScheduleEntry, ServicePart, ServicePhoto,
  ServiceReport, ServiceSignature, ServiceTicket, StockMovement, User, UserRole,
} from '@/constants/types';
import { erpApi } from '@/lib/erpApi';
import {
  fetchCurrentErpSession, loginToErp, logoutFromErp, requestErpPasswordReset,
  type ErpUserIdentity,
} from '@/lib/sessionApi';

interface AppState {
  users: User[]; currentUser: User | null; customers: Customer[]; invoices: Invoice[];
  payments: Payment[]; tickets: ServiceTicket[]; products: Product[];
  stockMovements: StockMovement[]; deliveries: DeliveryOrder[]; expenses: Expense[];
  engineers: Engineer[]; tasks: MarketingTask[]; notifications: Notification[];
  schedule: ScheduleEntry[]; company: Company; isLoading: boolean;
}

interface AppContextValue extends AppState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>; refresh: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>;
  updateTicketStatus: (ticketId: string, status: ServiceTicket['status']) => Promise<void>;
  startTravel: (ticketId: string) => Promise<void>; startWork: (ticketId: string) => Promise<void>;
  pauseWork: (ticketId: string) => void; resumeWork: (ticketId: string) => void;
  completeWork: (ticketId: string) => Promise<void>;
  addTicketPart: (ticketId: string, part: ServicePart) => Promise<void>;
  addTicketPhoto: (ticketId: string, photo: { uri: string; type: ServicePhoto['type'] }) => Promise<void>;
  saveSignature: (ticketId: string, sig: ServiceSignature) => Promise<void>;
  submitReport: (ticketId: string, report: ServiceReport) => Promise<void>;
  markNotificationRead: (notifId: string) => void; markAllNotificationsRead: () => void;
  updateDeliveryStatus: (id: string, status: DeliveryOrder['status']) => void;
  addScheduleEntry: (entry: Omit<ScheduleEntry, 'id'>) => Promise<void>;
  updateScheduleStatus: (id: string, status: ScheduleEntry['status']) => Promise<void>;
  updateEngineer: (id: string, patch: Partial<Engineer>) => Promise<void>;
  addUser: (user: Omit<User, 'id' | 'createdAt' | 'lastLogin'> & { temporaryPassword: string }) => Promise<void>;
  updateUser: (id: string, patch: Partial<User>) => Promise<void>;
  toggleUserActive: (id: string) => Promise<void>;
}

const EMPTY_COMPANY: Company = { companyName: 'COLORJET Bangladesh', address: '', hotline: '', email: '', website: '' };
const EMPTY_STATE: AppState = {
  users: [], currentUser: null, customers: [], invoices: [], payments: [], tickets: [],
  products: [], stockMovements: [], deliveries: [], expenses: [], engineers: [], tasks: [],
  notifications: [], schedule: [], company: EMPTY_COMPANY, isLoading: true,
};

const AppContext = createContext<AppContextValue | null>(null);
export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

function uiRole(codes: string[]): UserRole {
  const code = codes[0] || 'viewer';
  const aliases: Record<string, UserRole> = {
    owner: 'admin', super_admin: 'admin', service_manager: 'service_control',
    commercial: 'sales', viewer: 'customer',
  };
  return (aliases[code] || code) as UserRole;
}

function toUser(identity: ErpUserIdentity): User {
  return {
    id: identity.id, name: identity.displayName, email: identity.email || '',
    phone: identity.phone || undefined, employeeCode: identity.employeeCode || undefined,
    role: uiRole(identity.roleCodes), isActive: identity.active,
    createdAt: new Date().toISOString(),
  };
}

type BootstrapPayload = Partial<Omit<AppState, 'isLoading' | 'currentUser'>>;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);

  const hydrate = async (identity: ErpUserIdentity) => {
    const payload = await erpApi.get<BootstrapPayload>('/mobile/bootstrap');
    const currentUser = toUser(identity);
    setState({
      ...EMPTY_STATE, ...payload,
      users: payload.users?.length ? payload.users : [currentUser],
      currentUser, company: payload.company || EMPTY_COMPANY, isLoading: false,
    });
  };

  const refresh = async () => {
    setState(previous => ({ ...previous, isLoading: true }));
    try {
      const session = await fetchCurrentErpSession();
      await hydrate(session.user);
    } catch {
      setState({ ...EMPTY_STATE, isLoading: false });
    }
  };

  useEffect(() => { void refresh(); }, []);

  const login = async (identifier: string, password: string) => {
    try {
      const result = await loginToErp({ identifier, password });
      await hydrate(result.user);
      return true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    await logoutFromErp();
    setState({ ...EMPTY_STATE, isLoading: false });
  };

  const requestPasswordReset = async (identifier: string) => {
    try { await requestErpPasswordReset(identifier); return true; } catch { return false; }
  };

  const mutate = async (operation: () => Promise<unknown>) => {
    await operation();
    await refresh();
  };

  const setTicketStatusLocal = (ticketId: string, status: ServiceTicket['status']) =>
    setState(previous => ({ ...previous, tickets: previous.tickets.map(ticket => ticket.id === ticketId ? { ...ticket, status } : ticket) }));

  const updateTicketStatus = (ticketId: string, status: ServiceTicket['status']) =>
    mutate(() => erpApi.patch(`/service-tickets/${ticketId}/status`, { status }));
  const startTravel = (ticketId: string) => updateTicketStatus(ticketId, 'on_the_way');
  const startWork = (ticketId: string) => updateTicketStatus(ticketId, 'in_progress');
  const completeWork = (ticketId: string) => updateTicketStatus(ticketId, 'completed');
  const pauseWork = (ticketId: string) => setTicketStatusLocal(ticketId, 'paused');
  const resumeWork = (ticketId: string) => setTicketStatusLocal(ticketId, 'in_progress');

  const addTicketPhoto = async (ticketId: string, photo: { uri: string; type: ServicePhoto['type'] }) => {
    const form = new FormData();
    form.append('type', photo.type);
    form.append('photo', { uri: photo.uri, name: 'service-photo.jpg', type: 'image/jpeg' } as unknown as Blob);
    await mutate(() => erpApi.post(`/service-tickets/${ticketId}/photos`, form));
  };

  const saveSignature = async (ticketId: string, signature: ServiceSignature) => {
    const form = new FormData();
    form.append('signature', JSON.stringify(signature));
    await mutate(() => erpApi.post(`/service-tickets/${ticketId}/signature`, form));
  };

  const value: AppContextValue = {
    ...state, login, logout, refresh, requestPasswordReset,
    addPayment: payment => mutate(() => erpApi.post('/payments', payment)),
    addExpense: expense => mutate(() => erpApi.post('/expenses', expense)),
    updateTicketStatus, startTravel, startWork, pauseWork, resumeWork, completeWork,
    addTicketPart: (ticketId, part) => mutate(() => erpApi.post(`/service-tickets/${ticketId}/parts`, part)),
    addTicketPhoto, saveSignature,
    submitReport: (ticketId, report) => mutate(() => erpApi.post(`/service-tickets/${ticketId}/report`, report)),
    markNotificationRead: notifId => setState(previous => ({ ...previous, notifications: previous.notifications.map(item => item.id === notifId ? { ...item, isRead: true } : item) })),
    markAllNotificationsRead: () => setState(previous => ({ ...previous, notifications: previous.notifications.map(item => ({ ...item, isRead: true })) })),
    updateDeliveryStatus: (id, status) => setState(previous => ({ ...previous, deliveries: previous.deliveries.map(item => item.id === id ? { ...item, status } : item) })),
    addScheduleEntry: entry => mutate(() => erpApi.post('/engineer-schedule', entry)),
    updateScheduleStatus: (id, status) => mutate(() => erpApi.patch(`/engineer-schedule/${id}/status`, { status })),
    updateEngineer: (id, patch) => mutate(() => erpApi.patch(`/engineers/${id}`, patch)),
    addUser: user => mutate(() => erpApi.post('/users', user)),
    updateUser: (id, patch) => mutate(() => erpApi.patch(`/users/${id}`, patch)),
    toggleUserActive: id => {
      const user = state.users.find(item => item.id === id);
      return mutate(() => erpApi.patch(`/users/${id}/active`, { active: !user?.isActive }));
    },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
