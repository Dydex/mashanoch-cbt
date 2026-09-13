import type { ReactNode } from "react";
import { Avatar } from "@/components/ui";
import type { ApprovalStatus } from "@/lib/test-status";
import { timeFmt } from "@/lib/time";

export type ReviewEntry = {
  id: string;
  kind: "submitted" | "approved" | "changes_requested" | "comment";
  body: string | null;
  created_at: string;
  /** Null once the author's account has been removed. */
  author: { full_name: string } | null;
};

const VERB: Record<ReviewEntry["kind"], string> = {
  submitted: "submitted it for approval",
  approved: "approved it",
  changes_requested: "asked for changes",
  comment: "commented",
};

/** Colours the note's edge, so a request for changes stands out. */
const ACCENT: Record<ReviewEntry["kind"], string> = {
  submitted: "border-[var(--border-strong)]",
  approved: "border-[var(--success)]",
  changes_requested: "border-[var(--danger)]",
  comment: "border-[var(--border-strong)]",
};

type Situation = {
  status: ApprovalStatus;
  isAdmin: boolean;
  /** The viewer created this test. */
  own: boolean;
  /** Approved and its window has opened. */
  locked: boolean;
  closed: boolean;
  startLabel: string;
};

function summary(s: Situation): string {
  switch (s.status) {
    case "draft":
      if (!s.isAdmin)
        return "Students can't see this test until an admin approves it. Add your questions, then submit it for approval.";
      return s.own
        ? "Students can't see this test until it is approved. Approve it at the bottom of the page once the questions are ready."
        : "The teacher hasn't submitted this test for approval yet.";
    case "pending":
      return s.isAdmin
        ? "The teacher has submitted this test. Check the questions, then approve it or send it back at the bottom of the page."
        : "Waiting for an admin to approve it. Changing anything now takes it back to draft, and you will need to submit it again.";
    case "changes_requested":
      return s.isAdmin
        ? "Sent back to the teacher. It will be waiting for approval again once they resubmit."
        : "An admin has asked for changes. Make them, then resubmit.";
    case "approved":
      if (s.closed) return "Approved. This test has closed.";
      if (s.locked) return "Approved and open to students now.";
      return s.isAdmin
        ? `Approved. Students can sit it from ${s.startLabel}.`
        : `Approved. Students can sit it from ${s.startLabel}. Changing anything takes it back to draft, and it will need approving again.`;
  }
}

/**
 * Where the test stands in the approval workflow, and the thread of
 * submissions, decisions and comments behind it. Teachers and admins read the
 * same thread. `children` is whatever the viewer can do from here.
 */
export default function ApprovalPanel({
  entries,
  children,
  ...situation
}: Situation & { entries: ReviewEntry[]; children?: ReactNode }) {
  return (
    <section className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
      <h2 className="text-base font-semibold">Approval</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{summary(situation)}</p>

      {entries.length > 0 && (
        <ol className="mt-5 space-y-4 border-t border-[var(--border)] pt-5">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-3">
              <Avatar name={e.author?.full_name ?? "?"} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">
                    {e.author?.full_name ?? "A former staff member"}
                  </span>{" "}
                  <span className="text-[var(--text-muted)]">{VERB[e.kind]}</span>
                  <span className="text-xs text-[var(--text-subtle)]">
                    {" "}· {timeFmt.format(new Date(e.created_at))}
                  </span>
                </p>
                {e.body && (
                  <p
                    className={`mt-1.5 whitespace-pre-wrap break-words rounded-lg border-l-2
                                bg-[var(--surface-2)] px-3 py-2 text-sm ${ACCENT[e.kind]}`}
                  >
                    {e.body}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {children}
    </section>
  );
}
