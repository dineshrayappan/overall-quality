import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [company, setCompany] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const statusRes = await api.get('/auth/setup-status');
      const setupFlag = Boolean(statusRes.data?.data?.needsSetup);
      setNeedsSetup(setupFlag);

      const token = localStorage.getItem('qms_token');
      if (!setupFlag && token) {
        const meRes = await api.get('/auth/me');
        setUser(meRes.data.data.user);
        setPermissions(meRes.data.data.permissions || {});
        setCompany(meRes.data.data.company || null);
      } else {
        setUser(null);
        setPermissions({});
      }
    } catch {
      localStorage.removeItem('qms_token');
      setUser(null);
      setPermissions({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
    const onUnauth = () => {
      setUser(null);
      setPermissions({});
    };
    window.addEventListener('qms-unauthorized', onUnauth);
    return () => window.removeEventListener('qms-unauthorized', onUnauth);
  }, [loadSession]);

  const applyAuthData = (data) => {
    localStorage.setItem('qms_token', data.token);
    setUser(data.user);
    setPermissions(data.permissions || {});
    setCompany(data.company || null);
    setNeedsSetup(false);
  };

  const login = async (identifier, password) => {
    const res = await api.post('/auth/login', { identifier, password });
    applyAuthData(res.data.data);
    return res.data.data;
  };

  const setupAdmin = async (payload) => {
    const res = await api.post('/auth/setup', payload);
    applyAuthData(res.data.data);
    return res.data.data;
  };

  const logout = () => {
    localStorage.removeItem('qms_token');
    setUser(null);
    setPermissions({});
  };

  const hasPerm = useCallback(
    (section, action = 'view') => {
      if (!user) return false;
      if (user.role === 'Admin') return true;
      return Boolean(permissions?.[section]?.[action]);
    },
    [user, permissions]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        company,
        needsSetup,
        loading,
        login,
        setupAdmin,
        logout,
        hasPerm,
        refreshSession: loadSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

