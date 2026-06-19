"use client"

import { useTransition } from "react"
import { OnboardingChecklist } from "./OnboardingChecklist"
import type { OnboardingStatus } from "@/lib/db/queries"

export function OnboardingChecklistWrapper({
  status,
  dismiss,
}: {
  status: OnboardingStatus
  dismiss: () => Promise<void>
}) {
  const [, startTransition] = useTransition()

  return (
    <OnboardingChecklist
      status={status}
      onDismiss={() => startTransition(() => { dismiss() })}
    />
  )
}
