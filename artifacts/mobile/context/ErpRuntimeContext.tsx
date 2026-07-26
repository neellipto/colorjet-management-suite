import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { EffectivePermissionPayload } from '@/lib/effectivePermissions';
import { clearErpSession, readErpSession } from '@/lib/erpApi';
import { fetchEffectivePermissions } from '@/lib/permissionsApi';
import {
  fetchCurrentErpSession,
  loginToErp,
  logoutFromErp,
  type ErpUserIdentity,
  type LoginRequest,
} from '@/lib/sessionApi';

export type ErpRuntimeState = {
  bootstrapping: boolean;
  authenticated: boolean;
  user: ErpUserIdentity | null;
  permissions: EffectivePermissionPayload | null;
  permissionVersion: string | null;
  lastRefreshedAt: string | null;
  error: string | null;
};

export type ErpRuntimeContextValue = ErpRuntimeState & {
  login: (request: LoginRequest) => Promise<boolean>;
  logout: (deviceId?: string) => Promise<void>;
  refreshIdentity: () => Promise<void>;
  clearError: () => void;
};

const EMPTY_STATE: ErpRuntimeState = {
  bootstrapping: true,
  authenticated: false,
  user: null,
  permissions: null,
  permissionVersion: null,
  lastRefreshedAt: null,
  error: null,
};

const ErpRuntimeContext = createContext<ErpRuntimeContextValue | null>(null);

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to connect to COLORJET ERP.';
}

export function ErpRuntimeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ErpRuntimeState>(EMPTY_STATE);

  const refreshIdentity = useCallback(async () => {
    const localSession = await readErpSession();
    if (!localSession?.accessToken) {
      setState(previous => ({
        ...previous,
        bootstrapping: false,
        authenticated: false,
        user: null,
        permissions: null,
        permissionVersion: null,
        lastRefreshedAt: new Date().toISOString(),
      }));
      return;
    }

    try {
      const [session, permissions] = await Promise.all([
        fetchCurrentErpSession(),
        fetchEffectivePermissions(),
      ]);
      setState({
        bootstrapping: false,
        authenticated: true,
        user: session.user,
        permissions,
        permissionVersion: permissions.permissionVersion ?? session.permissionVersion ?? null,
        lastRefreshedAt: new Date().toISOString(),
        error: null,
      });
    } catch (error) {
      await clearErpSession();
      setState({
        bootstrapping: false,
        authenticated: false,
        user: null,
        permissions: null,
        permissionVersion: null,
        lastRefreshedAt: new Date().toISOString(),
        error: messageOf(error),
      });
    }
  }, []);

  useEffect(() => {
    void refreshIdentity();
  }, [refreshIdentity]);

  useEffect(() => {
    const onStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') void refreshIdentity();
    };
    const subscription = AppState.addEventListener('change', onStateChange);
    return () => subscription.remove();
  }, [refreshIdentity]);

  const login = useCallback(async (request: LoginRequest): Promise<boolean> => {
    setState(previous => ({ ...previous, bootstrapping: true, error: null }));
    try {
      const result = await loginToErp(request);
      const permissions = await fetchEffectivePermissions();
      setState({
        bootstrapping: false,
        authenticated: true,
        user: result.user,
        permissions,
        permissionVersion: permissions.permissionVersion ?? result.permissionVersion ?? null,
        lastRefreshedAt: new Date().toISOString(),
        error: null,
      });
      return true;
    } catch (error) {
      await clearErpSession();
      setState({
        bootstrapping: false,
        authenticated: false,
        user: null,
        permissions: null,
        permissionVersion: null,
        lastRefreshedAt: new Date().toISOString(),
        error: messageOf(error),
      });
      return false;
    }
  }, []);

  const logout = useCallback(async (deviceId?: string) => {
    try {
      await logoutFromErp(deviceId);
    } finally {
      setState({ ...EMPTY_STATE, bootstrapping: false });
    }
  }, []);

  const clearError = useCallback(() => {
    setState(previous => ({ ...previous, error: null }));
  }, []);

  const value = useMemo<ErpRuntimeContextValue>(() => ({
    ...state,
    login,
    logout,
    refreshIdentity,
    clearError,
  }), [state, login, logout, refreshIdentity, clearError]);

  return <ErpRuntimeContext.Provider value={value}>{children}</ErpRuntimeContext.Provider>;
}

export function useErpRuntime(): ErpRuntimeContextValue {
  const value = useContext(ErpRuntimeContext);
  if (!value) throw new Error('useErpRuntime must be used inside ErpRuntimeProvider.');
  return value;
}
