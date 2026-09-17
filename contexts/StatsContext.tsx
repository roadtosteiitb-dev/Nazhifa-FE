import React, { createContext, useContext, useState } from "react";

interface Stats {
  totalLands: number;
  totalViews: number;
  totalFavorites: number;
  totalIncome: number;
}

const StatsContext = createContext<any>(null);

export function StatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<Stats>({
    totalLands: 0,
    totalViews: 0,
    totalFavorites: 0,
    totalIncome: 0,
  });

  const updateStats = (newData: Partial<Stats>) => {
    setStats((prev) => ({ ...prev, ...newData }));
  };

  return (
    <StatsContext.Provider value={{ stats, updateStats }}>
      {children}
    </StatsContext.Provider>
  );
}

export const useStats = () => useContext(StatsContext);
