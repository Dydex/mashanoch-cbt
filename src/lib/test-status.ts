import type { Tone } from "@/components/ui";

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

export function isLive(test: Timed): boolean {
  const now = Date.now();
  return (
    test.approval_status === "approved" &&
    now >= new Date(test.start_time).getTime() &&
    now <= new Date(test.end_time).getTime()
  );
}

export function isLocked(
  test: Pick<Timed, "approval_status">,
  submissions: number,
): boolean {
  return test.approval_status === "approved" && submissions > 0;
}

export function hasStarted(test: Pick<Timed, "start_time">): boolean {
  return Date.now() >= new Date(test.start_time).getTime();
}

export function isClosed(test: Pick<Timed, "end_time">): boolean {
  return Date.now() > new Date(test.end_time).getTime();
}
