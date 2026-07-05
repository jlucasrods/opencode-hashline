import { tool } from "@opencode-ai/plugin"
import { mapOperationInput, runHashlineOperationsDetailed, type HashlineOperationInput } from "../lib/hashline-core.js"
import { type HashlineAnnotationCache, type HashlineRuntimeConfig } from "./hashline-shared.js"

const schema = tool.schema

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) return value
  }
  return undefined
}

function firstBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") return value
  }
  return undefined
}

function toHashlineOperations(args: {
  operation?: string
  ref?: string
  startRef?: string
  endRef?: string
  replacement?: string
  content?: string
  operations?: Array<{
    op: string
    ref?: string
    startRef?: string
    endRef?: string
    content?: string
    replacement?: string
  }>
}): HashlineOperationInput[] {
  if (Array.isArray(args.operations) && args.operations.length > 0) {
    return args.operations.map((entry) => ({
      op: entry.op as HashlineOperationInput["op"],
      ref: entry.ref,
      startRef: entry.startRef,
      endRef: entry.endRef,
      content: firstString(entry.content, entry.replacement),
    }))
  }

  const operation = firstString(args.operation)
  const ref = firstString(args.ref)
  const startRef = firstString(args.startRef, ref)
  if (!operation || !startRef) {
    throw new Error("edit requires either operations[] or operation plus startRef/ref")
  }

  return [
    {
      op: operation === "replace" && args.endRef ? "replace_range" : (operation as HashlineOperationInput["op"]),
      ref,
      startRef,
      endRef: args.endRef,
      content: firstString(args.replacement, args.content),
    },
  ]
}

export function createHashlineEditTool(config: HashlineRuntimeConfig, cache?: HashlineAnnotationCache) {
  return tool({
    description:
      "For existing files, prefer read + apply_patch_hashline using refs from read output. Use apply_patch or write for new files or when hashline refs are not suitable. Supports replace, delete, insert_before, insert_after, replace_range, and batched operations.",
    args: {
      filePath: schema.string().describe("Path to the file, absolute or relative to the current project directory."),
      operation: schema
        .enum(["replace", "delete", "insert_before", "insert_after", "replace_range"])
        .optional()
        .describe("Single edit operation. Use operations[] for batched edits."),
      ref: schema.string().optional().describe("Hashline reference for single-line operations."),
      startRef: schema.string().optional().describe("Start hashline reference copied from read output."),
      endRef: schema.string().optional().describe("End hashline reference for range operations."),
      replacement: schema.string().optional().describe("Replacement or inserted content."),
      content: schema.string().optional().describe("Alias for replacement."),
      operations: schema
        .array(
          schema.object({
            op: schema.enum(["replace", "delete", "insert_before", "insert_after", "replace_range"]),
            ref: schema.string().optional(),
            startRef: schema.string().optional(),
            endRef: schema.string().optional(),
            content: schema.string().optional(),
            replacement: schema.string().optional(),
          }),
        )
        .optional()
        .describe("Batch of hashline operations for the same file."),
      fileRev: schema
        .string()
        .optional()
        .describe("REV token from read output. Verifies the file was not changed before editing."),
      expectedFileHash: schema.string().optional().describe("Legacy full file hash guard."),
      safeReapply: schema.boolean().optional().describe("Try to relocate a moved line by hash when unambiguous."),
      dryRun: schema.boolean().optional().describe("Resolve the edit without writing the file."),
    },
    async execute(args, context) {
      const operations = toHashlineOperations(args)
      const result = await runHashlineOperationsDetailed({
        filePath: args.filePath,
        operations: operations.map(mapOperationInput),
        expectedFileHash: args.expectedFileHash,
        fileRev: args.fileRev,
        safeReapply: firstBoolean(args.safeReapply) ?? config.safeReapply,
        dryRun: args.dryRun,
        context: { directory: context.directory },
      })

      cache?.invalidateVariants(args.filePath)
      context.metadata({
        title: `edit: ${args.filePath}`,
        metadata: result.metadata,
      })

      return `${result.summary}\nRe-read the file to get fresh hashline refs before the next edit.`
    },
  })
}
