import type { Task } from '@folio/shared-types'
import { create } from 'zustand'

/** Mirror of the main-process scheduler's task list, kept in sync via the `task:update` push. */
interface TaskStore {
  tasks: Task[]
  setTasks: (tasks: Task[]) => void
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
}))
