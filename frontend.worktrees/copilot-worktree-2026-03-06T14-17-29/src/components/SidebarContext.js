import { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext();

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar deve ser usado dentro de SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({ children }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  
  const toggleSidebar = () => {
    setIsMinimized(!isMinimized);
    localStorage.setItem('sidebarMinimized', !isMinimized);
  };

  useEffect(() => {
    const saved = localStorage.getItem('sidebarMinimized');
    if (saved === 'true') {
      setIsMinimized(true);
    }
  }, []);

  return (
    <SidebarContext.Provider value={{ isMinimized, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
};
