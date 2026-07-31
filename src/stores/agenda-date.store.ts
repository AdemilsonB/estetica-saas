import { create } from 'zustand'

type AgendaDateState = {
  selectedDate: Date
  setSelectedDate: (date: Date) => void
}

// Fonte única da data selecionada na Agenda — usada pela timeline/strip e
// pelo botão "+" (tanto o do header quanto o FAB global do AppShell), pra
// que os dois abram o modal de novo agendamento com a mesma data.
export const useAgendaDateStore = create<AgendaDateState>((set) => ({
  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),
}))
