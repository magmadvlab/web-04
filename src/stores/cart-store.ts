import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  farmacoId: number;
  nomeFarmaco: string;
  principioAttivo: string;
  prezzo: number;
  quantita: number;
}

interface CartState {
  items: CartItem[];
  fotoRiferimento: string | null;
  addItem: (item: Omit<CartItem, "quantita">, quantita?: number) => void;
  removeItem: (farmacoId: number) => void;
  updateQuantity: (farmacoId: number, quantita: number) => void;
  setFotoRiferimento: (url: string | null) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      fotoRiferimento: null,

      addItem: (item, quantita = 1) => {
        const { items } = get();
        const existing = items.find((i) => i.farmacoId === item.farmacoId);
        const qty = Number.isFinite(quantita) ? Math.max(1, Math.floor(quantita)) : 1;
        if (existing) {
          set({
            items: items.map((i) =>
              i.farmacoId === item.farmacoId
                ? { ...i, quantita: i.quantita + qty }
                : i
            ),
          });
        } else {
          set({ items: [...items, { ...item, quantita: qty }] });
        }
      },

      removeItem: (farmacoId) => {
        set({ items: get().items.filter((i) => i.farmacoId !== farmacoId) });
      },

      updateQuantity: (farmacoId, quantita) => {
        if (quantita <= 0) {
          get().removeItem(farmacoId);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.farmacoId === farmacoId ? { ...i, quantita } : i
          ),
        });
      },

      setFotoRiferimento: (url) => set({ fotoRiferimento: url }),

      clearCart: () => set({ items: [], fotoRiferimento: null }),

      getTotal: () =>
        get().items.reduce((sum, i) => sum + i.prezzo * i.quantita, 0),

      getItemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantita, 0),
    }),
    {
      name: "ricettazero-cart",
    }
  )
);
