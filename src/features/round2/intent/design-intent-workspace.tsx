"use client";

import { type Dispatch, type ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildDesignIntentQuestions,
  groupDesignIntentQuestions,
  type DesignIntentGroup,
  type DesignIntentQuestion,
  type DesignIntentSection,
  type DesignIntentValue
} from "../model/design-intent";
import { MeasuredPlan } from "../measurement/measured-plan";
import type {
  Round2PrototypeAction,
  Round2PrototypeState
} from "../round2-types";

type Answers = Record<string, DesignIntentValue>;

/**
 * Group headings, in the same register as the measurement rail's ROOM / WALL A /
 * OPENINGS — the questions read as one ordered list, not as scattered cards.
 */
const SECTION_TITLES: Record<DesignIntentSection, string> = {
  corners: "CORNERS",
  uppers: "UPPER CABINETS",
  appliances: "SINK ZONE"
};

function answerFor(question: DesignIntentQuestion, answers: Answers) {
  return answers[question.key] ?? question.defaultValue;
}

/** Confirmed only when every question in the group is, follow-ups included. */
function groupConfirmed(group: DesignIntentGroup, confirmed: Set<string>) {
  return group.questions.every((question) => confirmed.has(question.key));
}

function groupEdited(group: DesignIntentGroup, answers: Answers) {
  return group.questions.some(
    (question) => answerFor(question, answers) !== question.defaultValue
  );
}

/**
 * Against the ceiling the moulding values read as a finish treatment rather than
 * a moulding size, so the same three options relabel.
 */
function mouldingOptionLabel(value: DesignIntentValue, toCeiling: boolean) {
  if (!toCeiling) return null;
  if (value === "none") return "Flush to ceiling";
  if (value === "flat2") return "Scribe";
  if (value === "flat3") return "Flat moulding 3″";
  return null;
}

function optionLabel(
  question: DesignIntentQuestion,
  value: DesignIntentValue,
  toCeiling: boolean
) {
  const option = question.options.find((item) => item.value === value);
  if (question.kind === "flat-moulding") {
    return mouldingOptionLabel(value, toCeiling) ?? option?.label ?? String(value);
  }
  if (question.kind === "upper-termination" && value === "standard") {
    return "Standard";
  }
  return option?.label ?? String(value);
}

/** "Where this landed", for the confirmed line. */
function groupSummary(group: DesignIntentGroup, answers: Answers) {
  const toCeiling =
    group.kind === "upper-termination" &&
    answerFor(group.questions[0], answers) === "ceiling";
  return group.questions
    .map((question) =>
      optionLabel(question, answerFor(question, answers), toCeiling)
    )
    .join(" · ");
}

/** Two per row unless every label is as short as `None` / `2″`. */
function choiceColumns(labels: readonly string[]) {
  return labels.every((label) => label.length <= 6)
    ? "grid-cols-3"
    : "grid-cols-2";
}

export function DesignIntentWorkspace({
  state,
  dispatch
}: {
  state: Round2PrototypeState;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const questions = useMemo(
    () => buildDesignIntentQuestions(state.model, state.measurements),
    [state.measurements, state.model]
  );
  const groups = useMemo(
    () => groupDesignIntentQuestions(questions),
    [questions]
  );
  const confirmedKeys = useMemo(
    () => new Set(state.designIntent.confirmedKeys),
    [state.designIntent.confirmedKeys]
  );
  const answers = state.designIntent.answers;

  const open = groups.filter((group) => !groupConfirmed(group, confirmedKeys));
  const done = groups.length - open.length;
  const progress = groups.length === 0 ? 0 : (done / groups.length) * 100;
  // Mirrors the measurement rail's active field: the row being worked on is
  // outlined, and it points the plan at the wall the question affects.
  const [activeId, setActiveId] = useState<string | null>(null);

  const activate = (group: DesignIntentGroup) => {
    setActiveId(group.id);
    if (state.selectedWall !== group.wallId) {
      dispatch({ type: "SELECT_WALL", wall: group.wallId });
    }
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 overflow-auto md:grid-cols-[380px_minmax(0,1fr)] md:overflow-hidden">
      <aside className="min-h-0 border-b border-studio-line bg-white/50 backdrop-blur-xl md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="border-b border-studio-line px-6 pb-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[9px] tracking-[0.16em] text-studio-quiet">
                DESIGN INTENT
              </p>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.025em]">
                Settle the choices
              </h2>
            </div>
            <span className="shrink-0 rounded-full border border-studio-line-strong bg-white/75 px-2.5 py-1 font-mono text-[9px] text-studio-muted">
              FROM v{state.measurementVersion}
            </span>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
              <span
                className="block h-full rounded-full bg-studio-ink transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-mono text-[9px] text-studio-quiet">
              {String(done).padStart(2, "0")} /{" "}
              {String(groups.length).padStart(2, "0")}
            </span>
          </div>

          <p className="mt-3 text-[10.5px] leading-4 text-studio-muted">
            Defaults do not block the proposal; skipped items become Confirmation
            Required.
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          {groups.length === 0 ? (
            <div className="rounded-studio-control border border-studio-line bg-white/70 p-4">
              <p className="text-[12px] font-semibold">Nothing to settle yet</p>
              <p className="mt-1 text-[11px] leading-4 text-studio-muted">
                Design-intent questions are created from the locked Round 1
                topology and the measured room.
              </p>
            </div>
          ) : (
            groups.map((group, index) => (
              <IntentRow
                key={group.id}
                group={group}
                answers={answers}
                confirmed={groupConfirmed(group, confirmedKeys)}
                edited={groupEdited(group, answers)}
                active={activeId === group.id}
                showSection={
                  index === 0 || groups[index - 1]?.section !== group.section
                }
                onActivate={() => activate(group)}
                dispatch={dispatch}
              />
            ))
          )}
        </div>

        <div className="sticky bottom-0 border-t border-studio-line bg-[rgba(248,248,246,0.94)] p-5 backdrop-blur-xl">
          {open.length > 0 ? (
            <>
              <p className="mb-2 font-mono text-[9px] leading-4 tracking-[0.1em] text-[#9a5b17]">
                {String(open.length).padStart(2, "0")} ITEM
                {open.length === 1 ? "" : "S"} → CONFIRMATION REQUIRED
              </p>
              <button
                type="button"
                className="mb-2 min-h-8 w-full rounded-[8px] border border-[#c79b4b] bg-[#fbf4e4] px-2 font-mono text-[9px] tracking-[0.06em] text-[#6b4a18] transition-colors hover:bg-[#f2e4c4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-ink/25"
                onClick={() =>
                  dispatch({
                    type: "CONFIRM_DESIGN_INTENT",
                    keys: open.flatMap((group) =>
                      group.questions.map((question) => question.key)
                    )
                  })
                }
              >
                CONFIRM ALL {String(open.length).padStart(2, "0")} AS SHOWN
              </button>
            </>
          ) : (
            <p className="mb-2 flex items-center gap-1.5 font-mono text-[9px] tracking-[0.1em] text-studio-quiet">
              <span className="size-1.5 rounded-full bg-studio-ink" />
              ALL DESIGN INTENT CONFIRMED
            </p>
          )}
          <Button
            type="button"
            className="w-full"
            onClick={() => dispatch({ type: "GENERATE_PROPOSAL" })}
          >
            Generate design proposal
          </Button>
        </div>
      </aside>

      <section className="min-h-[580px] min-w-0 bg-studio-canvas p-4 sm:p-6 md:min-h-0">
        <MeasuredPlan
          model={state.model}
          measurements={state.measurements}
          selectedWall={state.selectedWall}
          selectedObjectId={null}
          activeMeasurementKey={null}
          onSelectWall={(wall) => dispatch({ type: "SELECT_WALL", wall })}
          onSelectMeasurement={() => {}}
        />
      </section>
    </div>
  );
}

/**
 * One question, shaped like a measurement field: group heading when the section
 * turns over, label with its status on the right, the control, then the helper.
 */
function IntentRow({
  group,
  answers,
  confirmed,
  edited,
  active,
  showSection,
  onActivate,
  dispatch
}: {
  group: DesignIntentGroup;
  answers: Answers;
  confirmed: boolean;
  edited: boolean;
  active: boolean;
  showSection: boolean;
  onActivate: () => void;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const lead = group.questions[0];
  const moulding = group.questions.find(
    (question) => question.kind === "flat-moulding"
  );
  const toCeiling = answerFor(lead, answers) === "ceiling";
  const status = confirmed ? "CONFIRMED" : edited ? "UNCONFIRMED" : "DEFAULT";

  return (
    <div
      onMouseEnter={onActivate}
      onFocusCapture={onActivate}
      className={cn(
        "block rounded-[12px] border p-3 transition-colors",
        active ? "border-studio-ink bg-white" : "border-transparent"
      )}
    >
      {showSection && (
        <span className="mb-2 block font-mono text-[9px] tracking-[0.15em] text-studio-quiet">
          {SECTION_TITLES[group.section]}
        </span>
      )}

      <span className="flex items-center justify-between gap-4">
        <span className="text-[12px] font-semibold text-studio-ink">
          {group.label}
        </span>
        <span
          className={cn(
            "shrink-0 font-mono text-[8px] tracking-[0.08em]",
            confirmed ? "text-studio-quiet" : "text-[#9a5b17]"
          )}
        >
          {status}
        </span>
      </span>

      {group.kind === "corner-strategy" ? (
        <CornerChoices question={lead} answers={answers} dispatch={dispatch} />
      ) : moulding ? (
        <>
          <SubLabel className="mt-2.5">UPPER HEIGHT</SubLabel>
          <ChoiceRow
            question={lead}
            answers={answers}
            toCeiling={toCeiling}
            dispatch={dispatch}
          />
          <SubLabel className="mt-2.5">
            {toCeiling ? "FINISH" : "FLAT MOULDING"}
          </SubLabel>
          <ChoiceRow
            question={moulding}
            answers={answers}
            toCeiling={toCeiling}
            dispatch={dispatch}
          />
        </>
      ) : (
        <div className="mt-2">
          <ChoiceRow
            question={lead}
            answers={answers}
            toCeiling={toCeiling}
            dispatch={dispatch}
          />
        </div>
      )}

      <span className="mt-1.5 block text-[10.5px] leading-4 text-studio-quiet">
        {toCeiling && moulding
          ? "Choose how the upper run closes against the measured ceiling."
          : group.helper}
      </span>

      <ConfirmActions
        group={group}
        answers={answers}
        confirmed={confirmed}
        edited={edited}
        dispatch={dispatch}
      />
    </div>
  );
}

/** Selecting sets the value only — confirming is a separate, explicit act. */
function setAnswer(
  dispatch: Dispatch<Round2PrototypeAction>,
  key: string,
  value: DesignIntentValue
) {
  dispatch({ type: "SET_DESIGN_INTENT", key, value, confirm: false });
}

function ChoiceRow({
  question,
  answers,
  toCeiling,
  dispatch
}: {
  question: DesignIntentQuestion;
  answers: Answers;
  toCeiling: boolean;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const selected = answerFor(question, answers);
  const labels = question.options.map((option) =>
    optionLabel(question, option.value, toCeiling)
  );

  return (
    <div
      className={cn("grid gap-1.5", choiceColumns(labels))}
      role="group"
      aria-label={question.label}
    >
      {question.options.map((option, index) => (
        <ChoiceButton
          key={String(option.value)}
          selected={option.value === selected}
          onClick={() => setAnswer(dispatch, question.key, option.value)}
        >
          {labels[index]}
        </ChoiceButton>
      ))}
    </div>
  );
}

/**
 * The two corner families stack in the rail rather than sitting side by side —
 * 380px cannot hold two columns of these labels. Both are always visible, so
 * there is no step to walk through.
 */
function CornerChoices({
  question,
  answers,
  dispatch
}: {
  question: DesignIntentQuestion;
  answers: Answers;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const selected = answerFor(question, answers);
  const families: { title: string; group: "cornerCabinet" | "blindCabinet" }[] = [
    { title: "CORNER CABINET", group: "cornerCabinet" },
    { title: "BLIND CABINET", group: "blindCabinet" }
  ];

  return (
    <>
      {families.map((family) => (
        <div key={family.group}>
          <SubLabel className="mt-2.5">{family.title}</SubLabel>
          <div
            className="grid grid-cols-2 gap-1.5"
            role="group"
            aria-label={`${question.label} — ${family.title}`}
          >
            {question.options
              .filter((option) => option.group === family.group)
              .map((option) => (
                <ChoiceButton
                  key={String(option.value)}
                  selected={option.value === selected}
                  onClick={() => setAnswer(dispatch, question.key, option.value)}
                >
                  {option.label}
                </ChoiceButton>
              ))}
          </div>
        </div>
      ))}
    </>
  );
}

function ConfirmActions({
  group,
  answers,
  confirmed,
  edited,
  dispatch
}: {
  group: DesignIntentGroup;
  answers: Answers;
  confirmed: boolean;
  edited: boolean;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const keys = group.questions.map((question) => question.key);

  if (confirmed) {
    return (
      <div className="mt-2 flex items-center gap-1.5 font-mono text-[8px] tracking-[0.08em] text-studio-quiet">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-studio-ink" />
        <span className="min-w-0 truncate">
          {groupSummary(group, answers).toUpperCase()}
        </span>
        <button
          type="button"
          className="ml-auto shrink-0 underline underline-offset-2 hover:text-studio-ink"
          // Reopening changes no value: it re-sets the current answer without
          // confirming, which is what drops it out of confirmedKeys.
          onClick={() => {
            for (const question of group.questions) {
              setAnswer(dispatch, question.key, answerFor(question, answers));
            }
          }}
        >
          REOPEN
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex justify-end gap-1.5">
      <button
        type="button"
        className={cn(
          "min-h-7 rounded-[7px] px-2.5 font-mono text-[9px] tracking-[0.06em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-ink/25",
          edited
            ? "border border-studio-line-strong bg-white text-studio-muted hover:border-studio-ink hover:text-studio-ink"
            : "border border-studio-ink bg-studio-ink text-white hover:bg-studio-action-strong"
        )}
        onClick={() => {
          // Accepting an untouched default changes nothing, so it must not stale
          // a generated proposal; reverting an edit genuinely does.
          if (!edited) {
            dispatch({ type: "CONFIRM_DESIGN_INTENT", keys });
            return;
          }
          for (const question of group.questions) {
            dispatch({
              type: "SET_DESIGN_INTENT",
              key: question.key,
              value: question.defaultValue
            });
          }
        }}
      >
        KEEP DEFAULT
      </button>
      {edited && (
        <button
          type="button"
          className="min-h-7 rounded-[7px] border border-studio-ink bg-studio-ink px-2.5 font-mono text-[9px] tracking-[0.06em] text-white transition-colors hover:bg-studio-action-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-ink/25"
          onClick={() => dispatch({ type: "CONFIRM_DESIGN_INTENT", keys })}
        >
          CONFIRM
        </button>
      )}
    </div>
  );
}

function SubLabel({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "mb-1.5 block font-mono text-[8px] tracking-[0.12em] text-studio-quiet",
        className
      )}
    >
      {children}
    </span>
  );
}

function ChoiceButton({
  selected,
  onClick,
  children
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "flex min-h-8 items-center gap-1.5 rounded-[8px] border px-2 py-1.5 text-left text-[10px] font-semibold leading-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-ink/25",
        selected
          ? "border-studio-ink bg-studio-ink text-white"
          : "border-studio-line-strong bg-white text-studio-muted hover:border-studio-ink hover:text-studio-ink"
      )}
      onClick={onClick}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full border",
          selected ? "border-white bg-white" : "border-studio-line-strong"
        )}
      />
      <span className="min-w-0">{children}</span>
    </button>
  );
}
