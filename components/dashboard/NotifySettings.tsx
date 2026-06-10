"use client"

import { useActionState } from "react"
import { updateNotifySettings } from "@/app/dashboard/settings/notify-actions"

const INIT: { ok?: boolean; error?: string } = {}

export function NotifySettings({
  initialUrl,
  initialThreshold,
}: {
  initialUrl: string | null
  initialThreshold: string
}) {
  const [state, action, pending] = useActionState(updateNotifySettings, INIT)

  return (
    <form action={action} className="border border-white/10 rounded-[12px] bg-white/[0.02] p-5 flex flex-col gap-4 max-w-[560px]">
      <div>
        <p className="text-[14px] font-semibold text-white" style={{ letterSpacing: "-0.28px" }}>Alert notifications</p>
        <p className="text-[12px] text-[#555555] mt-1">
          Get a Slack or Discord message when a scan finds new issues. Paste an incoming-webhook URL.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">Webhook URL</label>
        <input
          name="alertWebhookUrl"
          type="url"
          defaultValue={initialUrl ?? ""}
          placeholder="https://hooks.slack.com/services/…  or  https://discord.com/api/webhooks/…"
          className="h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10 text-[13px] text-white
                     placeholder:text-[#444444] font-mono focus:border-white/25 focus-visible:outline-none transition-colors"
          style={{ letterSpacing: "-0.14px" }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">Alert me on</label>
        <select
          name="alertThreshold"
          defaultValue={initialThreshold}
          className="h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10 text-[13px] text-white
                     focus:border-white/25 focus-visible:outline-none transition-colors"
        >
          <option value="off">Off — never notify</option>
          <option value="critical">Critical findings only</option>
          <option value="high">High or above</option>
        </select>
      </div>

      {state.error && <p className="text-[12px] text-[#f87171]">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="h-10 px-5 rounded-[8px] bg-white text-black text-[13px] font-medium
                     hover:bg-white/90 disabled:opacity-50 transition-colors" style={{ letterSpacing: "-0.26px" }}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state.ok && <span className="text-[12px] font-mono text-[#4ade80]">Saved ✓</span>}
      </div>
    </form>
  )
}