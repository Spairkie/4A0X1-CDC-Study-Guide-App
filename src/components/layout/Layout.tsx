import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { useAppStore } from '../../store/useAppStore';

export const Layout: React.FC = () => {
  const storageError = useAppStore(s => s.storageError);
  const clearStorageError = useAppStore(s => s.clearStorageError);

  return (
    <div className="min-h-screen bg-subtle flex">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <Outlet />
      </main>
      <BottomNav />
      {/* BUG FIX #8: Surface storage errors to the user */}
      {storageError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-full px-4">
          <div className="bg-red-600 text-white text-sm rounded-2xl px-4 py-3 shadow-lg flex items-center gap-3">
            <span className="flex-1">{storageError}</span>
            <button onClick={clearStorageError} className="font-bold text-white/80 hover:text-white flex-shrink-0">✕</button>
          </div>
        </div>
      )}
    </div>
  );
};
