import React, { createContext, useContext, useState } from "react";

const ActivityContext = createContext<any>(null);

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [activities, setActivities] = useState([
    { id: 1, text: "Tanah baru ditambahkan", icon: "add", time: "Baru saja" },
  ]);

  const addActivity = (text: string, icon: string = "alert-circle-outline") => {
    const newActivity = {
      id: Date.now(),
      text,
      icon,
      time: "Baru saja",
    };
    setActivities((prev) => [newActivity, ...prev]);
  };

  return (
    <ActivityContext.Provider value={{ activities, addActivity }}>
      {children}
    </ActivityContext.Provider>
  );
}

export const useActivity = () => useContext(ActivityContext);
