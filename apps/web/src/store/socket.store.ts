import { create } from 'zustand';

interface SocketState {
  isConnected: boolean;
  connectionError: string | null;
  setConnected: (isConnected: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  isConnected: false,
  connectionError: null,
  setConnected: (isConnected) => set({ isConnected }),
  setError: (connectionError) => set({ connectionError }),
}));
