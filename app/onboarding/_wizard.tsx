"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import {
  Building,
  Check,
  GitHub,
  UploadCloud,
} from "@/components/ui/icons"
import {
  completeWorkspaceStep,
  completeIntegration,
  type WorkspaceActionState,
  type IntegrationActionState,
} from "@/app/onboarding/actions"

const W_INIT: WorkspaceActionState = {}
const I_INIT: IntegrationActionState = {}

interface Props {
  defaultWorkspaceName: string
  userLogin: string
}

type Step = 1 | 2 | 3
type Source = "github" | "zip" | null

export function OnboardingWizard({ defaultWorkspaceName, userLogin }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [orgId, setOrgId] = useState("")
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [step2Error, setStep2Error] = useState("")

  // Step 1 — workspace
  const [ws, wsAction, wsPending] = useActionState(completeWorkspaceStep, W_INIT)

  // Step 3 — integration
  const [int, intAction, intPending] = useActionState(completeIntegration, I_INIT)

  // Advance from step 1 → 2 when server action returns orgId
  useEffect(() => {
    if (ws.ok && ws.orgId) {
      setOrgId(ws.orgId)
      setStep(2)
    }
  }, [ws.ok, ws.orgId])

  function handleProjectContinue() {
    if (!projectName.trim()) {
      setStep2Error("Enter a project name.")
      return
    }
    setStep2Error("")
    setStep(3)
  }

  return (
    <div className="w-full flex flex-col gap-7">
      <StepIndicator step={step} />

      {step === 1 && (
        <WorkspaceStep
          action={wsAction}
          pending={wsPending}
          error={ws.error}
          defaultName={defaultWorkspaceName}
        />
      )}

      {step === 2 && (
        <ProjectStep
          projectName={projectName}
          projectDescription={projectDescription}
          onNameChange={(v) => { setProjectName(v); setStep2Error("") }}
          onDescriptionChange={setProjectDescription}
          onContinue={handleProjectContinue}
          error={step2Error}
        />
      )}

      {step === 3 && (
        <IntegrationStep
          action={intAction}
          pending={intPending}
          error={int.error}
          orgId={orgId}
          projectName={projectName}
          projectDescription={projectDescription}
          userLogin={userLogin}
        />
      )}
    </div>
  )
}

/* ── Step Indicator ──────────────────────────────────────────────── */

function StepIndicator({ step }: { step: Step }) {
  const steps: { n: Step; label: string }[] = [
    { n: 1, label: "Workspace" },
    { n: 2, label: "Project" },
    { n: 3, label: "Connect" },
  ]

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors
                  ${
                    step > s.n
                      ? "bg-white border-white text-black"
                      : step === s.n
                      ? "border-white/50 text-white"
                      : "border-white/15 text-[#444444]"
                  }`}
              >
                {step > s.n ? (
                  <Check size={11} strokeWidth={2.5} />
                ) : (
                  <span className="text-[10px] font-mono">{s.n}</span>
                )}
              </div>
              <span
                className={`text-[9px] font-mono uppercase tracking-[0.08em] transition-colors
                  ${step >= s.n ? "text-[#666666]" : "text-[#333333]"}`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-px mx-2 mb-5 transition-colors ${
                  step > s.n ? "bg-white/25" : "bg-white/08"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Step 1: Workspace ───────────────────────────────────────────── */

function WorkspaceStep({
  action,
  pending,
  error,
  defaultName,
}: {
  action: (payload: FormData) => void
  pending: boolean
  error?: string
  defaultName: string
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-0.5">
          <Building size={14} className="text-[#a1a1aa]" />
          <h2
            className="text-[15px] font-semibold text-white"
            style={{ letterSpacing: "-0.3px" }}
          >
            Create your workspace
          </h2>
        </div>
        <p className="text-[13px] text-[#666666]" style={{ letterSpacing: "-0.26px" }}>
          This is your tenant environment. All projects and scans live here.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">
            Workspace Name
          </span>
          <input
            name="workspaceName"
            type="text"
            defaultValue={defaultName}
            placeholder="Acme Security"
            maxLength={80}
            className="h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10
                       text-[14px] text-white placeholder:text-[#444444]
                       focus:border-white/25 focus:bg-white/[0.04]
                       focus-visible:outline-none transition-colors"
            style={{ letterSpacing: "-0.28px" }}
          />
          <p className="text-[11px] font-mono text-[#444444]">
            Your company or team name. You can change this later.
          </p>
        </label>

        {error && <ErrorLine message={error} />}

        <PrimaryButton pending={pending}>
          Continue →
        </PrimaryButton>
      </form>
    </div>
  )
}

/* ── Step 2: Project ─────────────────────────────────────────────── */

function ProjectStep({
  projectName,
  projectDescription,
  onNameChange,
  onDescriptionChange,
  onContinue,
  error,
}: {
  projectName: string
  projectDescription: string
  onNameChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onContinue: () => void
  error: string
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2
          className="text-[15px] font-semibold text-white"
          style={{ letterSpacing: "-0.3px" }}
        >
          Create your first project
        </h2>
        <p className="text-[13px] text-[#666666]" style={{ letterSpacing: "-0.26px" }}>
          A project maps to one codebase or service you want to scan.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">
            Project Name
          </span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Core API"
            maxLength={80}
            className="h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10
                       text-[14px] text-white placeholder:text-[#444444]
                       focus:border-white/25 focus:bg-white/[0.04]
                       focus-visible:outline-none transition-colors"
            style={{ letterSpacing: "-0.28px" }}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">
            Description{" "}
            <span className="text-[#444444] normal-case tracking-normal">— optional</span>
          </span>
          <textarea
            value={projectDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Backend REST API powering the main product"
            rows={3}
            maxLength={280}
            className="px-3 py-2.5 rounded-[8px] bg-white/[0.02] border border-white/10
                       text-[14px] text-white placeholder:text-[#444444] resize-none
                       focus:border-white/25 focus:bg-white/[0.04]
                       focus-visible:outline-none transition-colors"
            style={{ letterSpacing: "-0.28px" }}
          />
        </label>

        {error && <ErrorLine message={error} />}

        <PrimaryButton pending={false} onClick={onContinue} type="button">
          Continue →
        </PrimaryButton>
      </div>
    </div>
  )
}

/* ── Step 3: Integration ─────────────────────────────────────────── */

function IntegrationStep({
  action,
  pending,
  error,
  orgId,
  projectName,
  projectDescription,
  userLogin,
}: {
  action: (payload: FormData) => void
  pending: boolean
  error?: string
  orgId: string
  projectName: string
  projectDescription: string
  userLogin: string
}) {
  const [source, setSource] = useState<Source>(null)
  const [selectedRepo, setSelectedRepo] = useState("")
  const [customRepo, setCustomRepo] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [droppedFile, setDroppedFile] = useState<{ name: string; size: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const login = userLogin || "your-org"
  const suggestedRepos = [
    `${login}/${projectName.toLowerCase().replace(/\s+/g, "-") || "core-api"}`,
    `${login}/frontend`,
    `${login}/infrastructure`,
  ]

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) setDroppedFile({ name: file.name, size: file.size })
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setDroppedFile({ name: file.name, size: file.size })
  }

  const effectiveRepo =
    source === "github" ? (selectedRepo || customRepo).trim() : ""

  const canSubmit =
    source === "github"
      ? effectiveRepo.length > 0
      : source === "zip"
      ? droppedFile !== null
      : false

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2
          className="text-[15px] font-semibold text-white"
          style={{ letterSpacing: "-0.3px" }}
        >
          Connect your code source
        </h2>
        <p className="text-[13px] text-[#666666]" style={{ letterSpacing: "-0.26px" }}>
          Tell Oculs where to pull the codebase for{" "}
          <span className="text-white font-medium">{projectName}</span>.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-3">
        {/* Hidden fields — carry state from steps 1 & 2 */}
        <input type="hidden" name="orgId" value={orgId} />
        <input type="hidden" name="projectName" value={projectName} />
        <input type="hidden" name="projectDescription" value={projectDescription} />
        <input type="hidden" name="sourceType" value={source ?? ""} />
        <input type="hidden" name="repoFullName" value={effectiveRepo} />
        <input
          type="hidden"
          name="zipFileName"
          value={droppedFile?.name ?? ""}
        />

        {/* Option A — GitHub */}
        <div
          className={`rounded-[12px] border overflow-hidden transition-colors ${
            source === "github" ? "border-white/30" : "border-white/10"
          }`}
        >
          <button
            type="button"
            onClick={() => setSource("github")}
            className="w-full flex items-center gap-3.5 px-5 py-4 text-left"
          >
            <div
              className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors ${
                source === "github"
                  ? "border-white bg-white"
                  : "border-white/25"
              }`}
            >
              {source === "github" && (
                <span className="w-2 h-2 rounded-full bg-black block" />
              )}
            </div>
            <GitHub size={15} className="text-white flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p
                className="text-[13px] font-medium text-white"
                style={{ letterSpacing: "-0.26px" }}
              >
                Connect via GitHub
              </p>
              <p className="text-[11px] text-[#555555] mt-0.5">
                Import from your repositories
              </p>
            </div>
          </button>

          {source === "github" && (
            <div className="px-5 pb-5 border-t border-white/[0.07] flex flex-col gap-2">
              <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#555555] mt-3 mb-1">
                Suggested repositories
              </p>
              {suggestedRepos.map((repo) => (
                <label
                  key={repo}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-[8px] border cursor-pointer transition-colors ${
                    selectedRepo === repo
                      ? "border-white/25 bg-white/[0.06]"
                      : "border-white/10 bg-white/[0.01] hover:bg-white/[0.03]"
                  }`}
                >
                  <input
                    type="radio"
                    name="_repo_radio"
                    value={repo}
                    checked={selectedRepo === repo}
                    onChange={() => {
                      setSelectedRepo(repo)
                      setCustomRepo("")
                    }}
                    className="sr-only"
                  />
                  <span
                    className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors ${
                      selectedRepo === repo
                        ? "border-white bg-white"
                        : "border-white/25"
                    }`}
                  >
                    {selectedRepo === repo && (
                      <span className="w-1.5 h-1.5 rounded-full bg-black block" />
                    )}
                  </span>
                  <span
                    className="text-[12px] font-mono text-[#a1a1aa]"
                    style={{ letterSpacing: "-0.12px" }}
                  >
                    {repo}
                  </span>
                </label>
              ))}

              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[10px] font-mono text-[#333333]">or enter manually</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              <input
                type="text"
                value={customRepo}
                onChange={(e) => {
                  setCustomRepo(e.target.value)
                  setSelectedRepo("")
                }}
                placeholder="owner/repository"
                className="h-9 px-3 rounded-[8px] bg-white/[0.02] border border-white/10
                           text-[13px] text-white placeholder:text-[#444444] font-mono
                           focus:border-white/25 focus:bg-white/[0.04]
                           focus-visible:outline-none transition-colors"
                style={{ letterSpacing: "-0.14px" }}
              />
            </div>
          )}
        </div>

        {/* Option B — ZIP Upload */}
        <div
          className={`rounded-[12px] border overflow-hidden transition-colors ${
            source === "zip" ? "border-white/30" : "border-white/10"
          }`}
        >
          <button
            type="button"
            onClick={() => setSource("zip")}
            className="w-full flex items-center gap-3.5 px-5 py-4 text-left"
          >
            <div
              className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors ${
                source === "zip"
                  ? "border-white bg-white"
                  : "border-white/25"
              }`}
            >
              {source === "zip" && (
                <span className="w-2 h-2 rounded-full bg-black block" />
              )}
            </div>
            <UploadCloud size={15} className="text-white flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p
                className="text-[13px] font-medium text-white"
                style={{ letterSpacing: "-0.26px" }}
              >
                Upload ZIP file
              </p>
              <p className="text-[11px] text-[#555555] mt-0.5">
                Manually upload your codebase archive
              </p>
            </div>
          </button>

          {source === "zip" && (
            <div className="px-5 pb-5 border-t border-white/[0.07]">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`mt-3 rounded-[10px] border-2 border-dashed px-5 py-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                  isDragging
                    ? "border-white/40 bg-white/[0.05]"
                    : droppedFile
                    ? "border-white/25 bg-white/[0.03]"
                    : "border-white/15 hover:border-white/25 hover:bg-white/[0.02]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileInput}
                  className="sr-only"
                />
                <UploadCloud size={20} className="text-[#555555]" />
                {droppedFile ? (
                  <>
                    <p
                      className="text-[13px] text-white font-medium"
                      style={{ letterSpacing: "-0.26px" }}
                    >
                      {droppedFile.name}
                    </p>
                    <p className="text-[11px] font-mono text-[#555555]">
                      {(droppedFile.size / 1024).toFixed(0)} KB — click to change
                    </p>
                  </>
                ) : (
                  <>
                    <p
                      className="text-[13px] text-[#a1a1aa]"
                      style={{ letterSpacing: "-0.26px" }}
                    >
                      Drop your <span className="font-mono">.zip</span> file here
                    </p>
                    <p className="text-[11px] font-mono text-[#444444]">
                      or click to browse
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {error && <ErrorLine message={error} />}

        <PrimaryButton pending={pending} disabled={!canSubmit || pending}>
          {pending ? "Finishing setup…" : "Launch dashboard →"}
        </PrimaryButton>
      </form>
    </div>
  )
}

/* ── Shared primitives ───────────────────────────────────────────── */

function PrimaryButton({
  pending,
  disabled,
  onClick,
  type = "submit",
  children,
}: {
  pending?: boolean
  disabled?: boolean
  onClick?: () => void
  type?: "submit" | "button"
  children: React.ReactNode
}) {
  return (
    <button
      type={type}
      disabled={disabled ?? pending}
      onClick={onClick}
      className="mt-1 w-full inline-flex items-center justify-center gap-2 h-11 px-5
                 text-[14px] font-medium text-black bg-white rounded-[8px]
                 hover:bg-[#e5e5e5] active:bg-[#d4d4d4]
                 disabled:opacity-50 disabled:cursor-not-allowed
                 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.3)]
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      style={{ letterSpacing: "-0.28px" }}
    >
      {children}
    </button>
  )
}

function ErrorLine({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p
      className="text-[12px] text-[#f87171] flex items-center gap-1.5"
      role="alert"
      style={{ letterSpacing: "-0.24px" }}
    >
      <span className="inline-block w-1 h-1 rounded-full bg-[#f87171]" aria-hidden="true" />
      {message}
    </p>
  )
}
