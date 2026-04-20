import React, { useEffect, useState } from "react";
import api, { initializeCsrf } from "../services/api";
import { AuthContext, type User } from "./auth-context";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    void initializeCsrf()
      .then(() => api.get("/auth/session"))
      .then((response) => {
        if (!mounted) return;
        setUser(response.data.authenticated ? response.data.user : null);
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const login = (nextUser: User) => {
    setUser(nextUser);
  };

  const logout = async () => {
    await api.post("/auth/logout");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
