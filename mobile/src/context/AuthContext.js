import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken } from '../lib/api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [booting, setBooting] = useState(true);

  // Restore session on launch
  useEffect(() => {
    (async () => {
      try {
        const savedToken = await AsyncStorage.getItem('token');
        const savedUser = await AsyncStorage.getItem('user');
        if (savedToken) {
          setAuthToken(savedToken);
          setToken(savedToken);
          setUser(savedUser ? JSON.parse(savedUser) : null);
          // Refresh profile in the background
          api.auth.me().then(({ data }) => {
            const u = data?.user || data;
            if (u) {
              setUser(u);
              AsyncStorage.setItem('user', JSON.stringify(u));
            }
          }).catch(() => {});
        }
      } catch (_) {}
      finally { setBooting(false); }
    })();
  }, []);

  const persist = useCallback(async (tok, usr) => {
    setAuthToken(tok);
    setToken(tok);
    setUser(usr);
    await AsyncStorage.setItem('token', tok);
    await AsyncStorage.setItem('user', JSON.stringify(usr));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.auth.login({ email, password });
    await persist(data.token, data.user);
    return data.user;
  }, [persist]);

  const signup = useCallback(async (payload) => {
    const { data } = await api.auth.signup(payload);
    if (data?.token) await persist(data.token, data.user);
    return data;
  }, [persist]);

  // Sign in with a JWT obtained out-of-band (e.g. Google OAuth deep-link result)
  const loginWithToken = useCallback(async (tok) => {
    setAuthToken(tok);
    setToken(tok);
    await AsyncStorage.setItem('token', tok);
    try {
      const { data } = await api.auth.me();
      const u = data?.user || data;
      setUser(u);
      await AsyncStorage.setItem('user', JSON.stringify(u));
      return u;
    } catch (_) { return null; }
  }, []);

  const logout = useCallback(async () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove(['token', 'user']);
  }, []);

  const role = user?.role || 'guest';
  const isLoggedIn = !!token;
  // Shop/admin/agent get a Dashboard tab instead of Profile
  const isStaff = ['admin', 'shop', 'agent', 'employee', 'delivery'].includes(role);

  return (
    <AuthContext.Provider value={{ user, token, role, isLoggedIn, isStaff, booting, login, signup, logout, loginWithToken, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
