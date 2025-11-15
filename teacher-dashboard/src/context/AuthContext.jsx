import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, getAuthToken, setAuthToken } from '../api/client.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    apiRequest('/api/teachers/me')
      .then((response) => {
        if (!cancelled && response?.teacher) {
          setUser(response.teacher);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signup = async ({ email, password, name, classId, department }) => {
    const response = await apiRequest('/api/teachers/signup', {
      method: 'POST',
      data: { email, password, name, classId, department }
    });
    setAuthToken(response.token);
    setUser(response.teacher);
    return response.teacher;
  };

  const login = async (email, password) => {
    const response = await apiRequest('/api/teachers/login', {
      method: 'POST',
      data: { email, password }
    });
    setAuthToken(response.token);
    setUser(response.teacher);
    return response.teacher;
  };

  const logout = async () => {
    setAuthToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, signup, login, logout }), [user, loading]);

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
