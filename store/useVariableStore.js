import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useVariableStore = create(
  persist(
    (set, get) => ({
      variables: [
        { id: '1', name: 'LEARNING_RATE', value: '0.001', type: 'number' },
        { id: '2', name: 'BATCH_SIZE', value: '32', type: 'number' },
        { id: '3', name: 'EPOCHS', value: '10', type: 'number' },
      ],
      panelOpen: false,

      togglePanel: () => set({ panelOpen: !get().panelOpen }),
      setPanelOpen: (open) => set({ panelOpen: open }),

      addVariable: (variable) => set({
        variables: [...get().variables, { id: Math.random().toString(36).substring(2, 9), ...variable }]
      }),

      updateVariable: (id, patch) => set({
        variables: get().variables.map(v => v.id === id ? { ...v, ...patch } : v)
      }),

      removeVariable: (id) => set({
        variables: get().variables.filter(v => v.id !== id)
      }),

      getVariableValue: (name) => {
        const v = get().variables.find(v => v.name === name);
        return v ? v.value : null;
      },

      getVariablesAsObject: () => {
        return Object.fromEntries(get().variables.map(v => [v.name, v.value]));
      }
    }),
    {
      name: 'proto-ml-variables',
    }
  )
);
