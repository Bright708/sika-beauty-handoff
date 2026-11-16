import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// The checked spreadsheet, kept between the Products page and the review screen.
// Saved for this browser tab only, so a refresh does not lose it.
export const useImportStore = create(
  persist(
    (set) => ({
      fileName: '',
      preview: null, // { rows, summary } from /api/admin/import/preview
      setPreview: (fileName, preview) => set({ fileName, preview }),
      clear: () => set({ fileName: '', preview: null }),
    }),
    {
      name: 'sika-import',
      storage: createJSONStorage(() => {
        try {
          return sessionStorage
        } catch {
          return undefined
        }
      }),
    },
  ),
)
