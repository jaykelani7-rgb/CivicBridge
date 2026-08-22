import { create } from "zustand";

type UIState = {
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
};

export const useUIStore = create<UIState>((set) => ({
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
}));
