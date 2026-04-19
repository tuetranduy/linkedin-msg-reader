import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { apiClient } from "@/api/client";

interface User {
  id: number;
  username: string;
  role: "admin" | "user";
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      apiClient<User>("/auth/me")
        .then(setUser)
        .catch(() => {
          localStorage.removeItem("auth_token");
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await apiClient<{ token: string; user: User }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      },
    );
    localStorage.setItem("auth_token", response.token);
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
