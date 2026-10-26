"use client"

import { RiUserSettingsLine } from "@remixicon/react"
import { createContext, useContext, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export interface SelectableCandidate {
  slug: string
  name: string
  party: string | null
}

interface CandidateSelection {
  candidates: SelectableCandidate[]
  selected: Set<string>
  setSelected: (selected: Set<string>) => void
}

const CandidateSelectionContext = createContext<CandidateSelection | null>(null)

function useCandidateSelection(): CandidateSelection {
  const selection = useContext(CandidateSelectionContext)
  if (!selection) {
    throw new Error("Candidate selection used outside its provider")
  }
  return selection
}

export function useSelectedCandidates(): Set<string> {
  return useCandidateSelection().selected
}

export function CandidateSelectionProvider({
  candidates,
  children,
}: {
  candidates: SelectableCandidate[]
  children: ReactNode
}) {
  const [selected, setSelected] = useState(
    () => new Set(candidates.map((candidate) => candidate.slug))
  )
  return (
    <CandidateSelectionContext value={{ candidates, selected, setSelected }}>
      {children}
    </CandidateSelectionContext>
  )
}

/** Marks screenshots of a filtered view so omitted candidates are never implied absent. */
export function CandidateSelectionBadge() {
  const { candidates, selected } = useCandidateSelection()
  if (selected.size === candidates.length) return null
  return (
    <span className="inline-flex shrink-0 items-center border border-foreground px-1.5 py-0.5 text-xs font-bold tracking-[0.12em] whitespace-nowrap">
      精簡版本
    </span>
  )
}

export function SelectedCandidate({
  slug,
  children,
}: {
  slug: string
  children: ReactNode
}) {
  return useSelectedCandidates().has(slug) ? children : null
}

export function CandidateSelectionDialog() {
  const { candidates, selected, setSelected } = useCandidateSelection()

  function toggle(slug: string, checked: boolean) {
    const next = new Set(selected)
    if (checked) next.add(slug)
    else next.delete(slug)
    setSelected(next)
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <RiUserSettingsLine aria-hidden="true" />
        選擇候選人
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base font-bold">選擇候選人</DialogTitle>
        </DialogHeader>
        <ul className="divide-y border-y">
          {candidates.map((candidate) => {
            const checked = selected.has(candidate.slug)
            return (
              <li key={candidate.slug}>
                <label className="flex cursor-pointer items-center gap-3 px-1 py-2.5 text-sm">
                  <Checkbox
                    checked={checked}
                    disabled={checked && selected.size === 1}
                    onCheckedChange={(value) => toggle(candidate.slug, value)}
                  />
                  <span className="font-bold">{candidate.name}</span>
                  <span className="text-muted-foreground">
                    {candidate.party}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={selected.size === candidates.length}
            onClick={() =>
              setSelected(
                new Set(candidates.map((candidate) => candidate.slug))
              )
            }
          >
            全部顯示
          </Button>
          <DialogClose render={<Button />}>完成</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
