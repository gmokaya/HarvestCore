import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface AuthUser {
  userId: string;
  name: string;
  email: string;
  role: string;
  token: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
}

const MOCK_CREDENTIALS: Array<AuthUser & { password: string }> = [
  { userId: "admin-001",   name: "Admin User",        email: "admin@harvestcore.io",        role: "admin",               password: "admin123",  token: "mock-token-admin-001" },
  { userId: "farmer-001",  name: "James Mwangi",       email: "james.mwangi@farm.ke",        role: "farmer",              password: "Demo@2025", token: "mock-token-farmer-001" },
  { userId: "trader-001",  name: "Ali Hassan",         email: "ali.hassan@egta.co.ke",       role: "trader",              password: "Demo@2025", token: "mock-token-trader-001" },
  { userId: "colmgr-001",  name: "Margaret Kamau",     email: "margaret.kamau@kcb.co.ke",    role: "collateral_manager",  password: "Demo@2025", token: "mock-token-colmgr-001" },
  { userId: "proc-001",    name: "Daniel Njoroge",     email: "daniel.njoroge@mcpl.co.ke",   role: "processor",           password: "Demo@2025", token: "mock-token-proc-001" },
  { userId: "wop-001",     name: "David Ochieng",      email: "warehouse@nairobistore.ke",    role: "warehouse_op",        password: "Demo@2025", token: "mock-token-wop-001" },
  { userId: "checker-001", name: "Sarah Otieno",       email: "checker@harvestcore.io",       role: "checker",             password: "Demo@2025", token: "mock-token-checker-001" },
  { userId: "lender-001",  name: "Equity Bank Kenya",  email: "equity@bank.ke",              role: "lender",              password: "Demo@2025", token: "mock-token-lender-001" },
];

const SESSION_KEY = "th_session";

function loadSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadSession);

  const login = useCallback((email: string, password: string): { ok: boolean; error?: string } => {
    const match = MOCK_CREDENTIALS.find(
      (c) => c.email.toLowerCase() === email.toLowerCase().trim() && c.password === password
    );
    if (!match) {
      return { ok: false, error: "Invalid email or password." };
    }
    const { password: _, ...session } = match;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const DEMO_ACCOUNTS = MOCK_CREDENTIALS.map(({ password: _, ...u }) => u);
