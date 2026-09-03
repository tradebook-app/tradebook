'use client'
import { useEffect, useRef, useState } from 'react'

export const PAGE_SIZE_OPTIONS = [15, 25, 50, 100] as const
const DEFAULT_PAGE_SIZE = 15

export type Pagination = {
  page: number          // 0-indexed, always clamped to a valid page
  pageSize: number
  totalPages: number
  start: number          // slice start index into the full list
  end: number            // slice end index (exclusive)
  rangeLabel: string     // e.g. "1–50 of 157"
  canPrev: boolean
  canNext: boolean
  prev: () => void
  next: () => void
  setPageSize: (n: number) => void
  slice: <T>(arr: T[]) => T[]
}

/**
 * Client-side pagination for a list of `totalItems`. Optionally persists the
 * chosen page size under `storageKey` in localStorage. The current page resets
 * to the first page whenever the list length changes, whenever `resetKey`
 * changes (e.g. a filter that doesn't alter the count), and is always clamped
 * to a valid range.
 */
export function usePagination(totalItems: number, storageKey?: string, resetKey?: unknown): Pagination {
  const [pageSize, setSize] = useState<number>(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const v = Number(window.localStorage.getItem(storageKey))
        if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(v)) return v
      } catch { /* ignore */ }
    }
    return DEFAULT_PAGE_SIZE
  })
  const [rawPage, setRawPage] = useState(0)

  // Reset to the first page when the underlying list changes size.
  const prevTotal = useRef(totalItems)
  useEffect(() => {
    if (prevTotal.current !== totalItems) {
      prevTotal.current = totalItems
      setRawPage(0)
    }
  }, [totalItems])

  // Reset when an external signal (filter, search, tab) changes.
  const firstReset = useRef(true)
  useEffect(() => {
    if (firstReset.current) { firstReset.current = false; return }
    setRawPage(0)
  }, [resetKey])

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const page = Math.min(Math.max(rawPage, 0), totalPages - 1)
  const start = totalItems === 0 ? 0 : page * pageSize
  const end = Math.min(start + pageSize, totalItems)

  function setPageSize(n: number) {
    setSize(n)
    setRawPage(0)
    if (storageKey && typeof window !== 'undefined') {
      try { window.localStorage.setItem(storageKey, String(n)) } catch { /* ignore */ }
    }
  }

  return {
    page,
    pageSize,
    totalPages,
    start,
    end,
    rangeLabel: totalItems === 0 ? '0 of 0' : `${start + 1}–${end} of ${totalItems}`,
    canPrev: page > 0,
    canNext: page < totalPages - 1,
    prev: () => setRawPage(p => Math.max(0, Math.min(p, totalPages - 1) - 1)),
    next: () => setRawPage(p => Math.min(totalPages - 1, Math.min(p, totalPages - 1) + 1)),
    setPageSize,
    slice: <T>(arr: T[]) => arr.slice(start, end),
  }
}
