import type { Tone } from "@/components/ui";

/**
 * Where a test is in the approval workflow (0010_test_approval.sql).
 *
 *   draft              being written; students cannot see it
 *   pending            submitted by its teacher, waiting on an admin
 *   changes_requested  an admin sent it back with a note
 *   approved           students may sit it while its window is open
 */
export type ApprovalStatus =
  | "draft"
  | "pending"
  | "changes_requested"
  | "approved";

type Timed = {
  approval_status: ApprovalStatus;
  start_time: string;
  end_time: string;
};

/**
 * The status shown for a test on every staff screen.
 *
 * Approval comes first: until a test is approved its window means nothing,
 * because students cannot see it. Only an approved test is Scheduled, Live or
 * Closed.
 */
export function testStatus(test: Timed): { label: string; tone: Tone } {
  switch (test.approval_status) {
    case "draft":
      return { label: "Draft", tone: "neutral" };
    case "pending":
      return { label: "Awaiting approval", tone: "warning" };
    case "changes_requested":
      return { label: "Changes requested", tone: "danger" };
  }

  const now = Date.now();
  if (now < new Date(test.start_time).getTime())
    return { label: "Scheduled", tone: "primary" };
  if (now > new Date(test.end_time).getTime())
    return { label: "Closed", tone: "neutral" };
  return { label: "Live now", tone: "success" };
}

/** True while students can actually open the test. */
export function isLive(test: Timed): boolean {
  const now = Date.now();
  return (
    test.approval_status === "approved" &&
    now >= new Date(test.start_time).getTime() &&
    now <= new Date(test.end_time).getTime()
  );
}

/**
 * True once the paper is frozen: the test is approved and its window has
 * opened, so a student may already be sitting it. An unapproved test stays
 * editable past its start time, because no student has ever seen it.
 *
 * Database triggers enforce this for real (0008, amended by 0010). This only
 * decides what the UI offers, and lets actions return a readable message.
 */
export function isLocked(
  test: Pick<Timed, "approval_status" | "start_time">,
): boolean {
  return test.approval_status === "approved" && hasStarted(test);
}

/** True once the window's opening time has passed, approved or not. */
export function hasStarted(test: Pick<Timed, "start_time">): boolean {
  return Date.now() >= new Date(test.start_time).getTime();
}

/** True once the window's closing time has passed. */
export function isClosed(test: Pick<Timed, "end_time">): boolean {
  return Date.now() > new Date(test.end_time).getTime();
}
