import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { defaultPortfolioData, type PortfolioData } from "../data/portfolio";
import { subscribeToPortfolio } from "../lib/firestore";

export interface PortfolioContextValue extends PortfolioData {
  /** True once at least one live snapshot has arrived from Firestore. */
  isSynced: boolean;
  /** Non-fatal sync error (the portfolio keeps displaying fallback data). */
  syncError: string | null;
}

const PortfolioContext = createContext<PortfolioContextValue>({
  ...defaultPortfolioData,
  isSynced: false,
  syncError: null,
});

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PortfolioData>(defaultPortfolioData);
  const [isSynced, setIsSynced] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToPortfolio(
      (nextData) => {
        setData(nextData);
        setIsSynced(true);
        setSyncError(null);
      },
      (err) => {
        setSyncError(err.message);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    document.title = `${data.profile.name} | ${data.profile.role}`;
  }, [data.profile.name, data.profile.role]);

  return (
    <PortfolioContext.Provider value={{ ...data, isSynced, syncError }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio(): PortfolioContextValue {
  return useContext(PortfolioContext);
}
