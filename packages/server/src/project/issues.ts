/**
 * Local OSS annotation issues store at `.spin/issues.json`.
 *
 * Runtime/agent inbox state lives in `.spin/` (gitignored) so `spin/` stays
 * strictly committed design truth.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as v from "valibot";

export const ISSUES_REL_PATH = ".spin/issues.json";

export const IssueStatusSchema = v.picklist(["open", "resolved"]);
export type IssueStatus = v.InferOutput<typeof IssueStatusSchema>;

export const IssueBoundingBoxSchema = v.object({
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number(),
});

export const IssueAnnotationSchema = v.object({
  selector: v.string(),
  boundingBox: IssueBoundingBoxSchema,
  route: v.string(),
  tag: v.string(),
  classes: v.optional(v.string()),
  component: v.optional(v.string()),
  comment: v.string(),
});
export type IssueAnnotation = v.InferOutput<typeof IssueAnnotationSchema>;

export const IssueRecordSchema = v.object({
  id: v.string(),
  title: v.string(),
  status: IssueStatusSchema,
  route: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
  annotations: v.array(IssueAnnotationSchema),
});
export type IssueRecord = v.InferOutput<typeof IssueRecordSchema>;

export const CreateIssueInputSchema = v.object({
  title: v.optional(v.string()),
  route: v.string(),
  annotations: v.pipe(v.array(IssueAnnotationSchema), v.minLength(1)),
});
export type CreateIssueInput = v.InferOutput<typeof CreateIssueInputSchema>;

const IssuesFileSchema = v.object({
  issues: v.array(IssueRecordSchema),
});

function issuesPath(root: string): string {
  return join(root, ISSUES_REL_PATH);
}

function writeIssues(root: string, issues: readonly IssueRecord[]): void {
  const dir = join(root, ".spin");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    issuesPath(root),
    JSON.stringify({ issues }, null, 2) + "\n",
    "utf8",
  );
}

export function readIssues(root: string): IssueRecord[] {
  const path = issuesPath(root);
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const parsed = v.safeParse(IssuesFileSchema, raw);
  return parsed.success ? [...parsed.output.issues] : [];
}

export function createIssue(
  root: string,
  input: CreateIssueInput,
): IssueRecord {
  const checked = v.parse(CreateIssueInputSchema, input);
  const now = new Date().toISOString();
  const firstComment = checked.annotations[0]?.comment.trim() ?? "UI annotation";
  const title = checked.title?.trim() || firstComment.slice(0, 72);
  const id = `iss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const record: IssueRecord = {
    id,
    title,
    status: "open",
    route: checked.route,
    createdAt: now,
    updatedAt: now,
    annotations: checked.annotations,
  };
  const issues = readIssues(root);
  issues.unshift(record);
  writeIssues(root, issues);
  return record;
}

function setIssueStatus(
  root: string,
  id: string,
  status: IssueStatus,
): IssueRecord | null {
  const issues = readIssues(root);
  const idx = issues.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  const updated: IssueRecord = {
    ...issues[idx]!,
    status,
    updatedAt: new Date().toISOString(),
  };
  issues[idx] = updated;
  writeIssues(root, issues);
  return updated;
}

export function resolveIssue(root: string, id: string): IssueRecord | null {
  return setIssueStatus(root, id, "resolved");
}

export function reopenIssue(root: string, id: string): IssueRecord | null {
  return setIssueStatus(root, id, "open");
}

export function removeIssue(root: string, id: string): boolean {
  const issues = readIssues(root);
  const next = issues.filter((item) => item.id !== id);
  if (next.length === issues.length) return false;
  writeIssues(root, next);
  return true;
}
