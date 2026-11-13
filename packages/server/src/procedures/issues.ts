/**
 * Daemon RPC procedures for local annotation issues (`.spin/issues.json`).
 */

import { oc } from "@orpc/contract";
import * as v from "valibot";
import { implement } from "@orpc/server";
import {
  CreateIssueInputSchema,
  IssueRecordSchema,
  createIssue,
  readIssues,
  removeIssue,
  reopenIssue,
  resolveIssue,
} from "../project/index.ts";
import { rootFor } from "./project-procedures.ts";

export const issuesContract = oc.tag("issues").router({
  issues: {
    list: oc
      .input(v.object({ root: v.optional(v.string()) }))
      .output(v.object({ issues: v.array(IssueRecordSchema) })),
    create: oc
      .input(
        v.object({
          root: v.optional(v.string()),
          ...CreateIssueInputSchema.entries,
        }),
      )
      .output(v.object({ issue: IssueRecordSchema })),
    resolve: oc
      .input(v.object({ root: v.optional(v.string()), id: v.string() }))
      .output(v.object({ issue: v.nullable(IssueRecordSchema) })),
    reopen: oc
      .input(v.object({ root: v.optional(v.string()), id: v.string() }))
      .output(v.object({ issue: v.nullable(IssueRecordSchema) })),
    remove: oc
      .input(v.object({ root: v.optional(v.string()), id: v.string() }))
      .output(v.object({ removed: v.boolean() })),
  },
});

const os = implement(issuesContract);

export const issuesRouter = os.router({
  issues: {
    list: os.issues.list.handler(async ({ input }) => {
      const root = await rootFor(input);
      return { issues: readIssues(root) };
    }),
    create: os.issues.create.handler(async ({ input }) => {
      const root = await rootFor(input);
      const issue = createIssue(root, {
        title: input.title,
        route: input.route,
        annotations: input.annotations,
      });
      return { issue };
    }),
    resolve: os.issues.resolve.handler(async ({ input }) => {
      const root = await rootFor(input);
      return { issue: resolveIssue(root, input.id) };
    }),
    reopen: os.issues.reopen.handler(async ({ input }) => {
      const root = await rootFor(input);
      return { issue: reopenIssue(root, input.id) };
    }),
    remove: os.issues.remove.handler(async ({ input }) => {
      const root = await rootFor(input);
      return { removed: removeIssue(root, input.id) };
    }),
  },
});
