import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "../api/client";
import { User, ApiResponse } from "../types";

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true });

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        const res = await apiClient<ApiResponse<User>>("/auth/me");
        setState({ user: res.data, token, loading: false });
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
    } catch {
      await AsyncStorage.removeItem("token");
      setState({ user: null, token: null, loading: false });
    }
  }

  async function login(email: string, password: string) {
    const res = await apiClient<ApiResponse<{ user: User; token: string }>>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await AsyncStorage.setItem("token", res.data.token);
    setState({ user: res.data.user, token: res.data.token, loading: false });
  }

  async function signup(name: string, email: string, password: string) {
    const res = await apiClient<ApiResponse<{ user: User; token: string }>>("/auth/signup", {
      method: "POST",
      body: { name, email, password },
    });
    await AsyncStorage.setItem("token", res.data.token);
    setState({ user: res.data.user, token: res.data.token, loading: false });
  }

  async function logout() {
    await AsyncStorage.removeItem("token");
    setState({ user: null, token: null, loading: false });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
