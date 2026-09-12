import { create } from 'zustand';
import type { User } from '../types';
type AuthState = { user: User | null; accessToken: string | null; ready: boolean; setSession: (user: User, accessToken: string) => void; setUser: (user: User) => void; clear: () => void; setReady: () => void };
export const useAuthStore = create<AuthState>((set) => ({ user: null, accessToken: null, ready: false, setSession: (user, accessToken) => set({ user, accessToken, ready: true }), setUser: (user) => set({user}), clear: () => set({user: null, accessToken: null, ready: true}), setReady: () => set({ready: true}) }));
