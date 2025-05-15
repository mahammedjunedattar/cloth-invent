// contexts/StoreContext.jsx
'use client';
import { createContext, useContext } from 'react';

const StoreContext = createContext();

export function StoreWrapper({ store, children }) {
  return (
    <StoreContext.Provider value={store}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}