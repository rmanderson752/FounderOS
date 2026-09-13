// src/lib/decompose/schema.ts
//
// The ladder's shape, as a schema the model must satisfy. Treated as a
// software contract: the decomposition route inserts exactly these fields,
// the card turn reads exactly these candidates, and the server rejects
// anything that fails the checks in ./decompose.ts before a row is written.

import { z } from 'zod'

export const CandidateSchema = z.object({
  deliverable: z
    .string()
    .describe('A finished artifact of 30–180 minutes, named specifically (file, screen, document, message). Never a label.'),
  estimated_minutes: z.number().int().min(30).max(180),
  expected_paths: z
    .array(z.string())
    .describe('Files or folders this work will touch, relative to the repo root. Empty for non-code work.'),
})

export const MilestoneSchema = z.object({
  title: z.string().describe('Short, specific, in the user\'s vocabulary. Not a project name.'),
  definition_of_done: z.string().describe('One or two sentences: what is observably true when this is done.'),
  estimated_minutes: z.number().int().min(30).describe('Total remaining effort for the whole milestone.'),
  already_done: z.boolean().describe('True only when the commit history shows this milestone is already finished.'),
  evidence: z
    .array(z.string())
    .describe('Commit hashes or subjects from the provided history that show already_done. Empty otherwise.'),
  candidates: z.array(CandidateSchema).min(2).max(4).describe('2–4 concrete deliverables that advance this milestone.'),
})

export const LadderSchema = z.object({
  definition_of_done: z
    .string()
    .describe('What is observably true when the whole outcome is achieved. Drafted from the docs when they say it.'),
  assumptions: z.array(z.string()).describe('Things assumed because the docs and history did not say. 0–5 items.'),
  milestones: z.array(MilestoneSchema).min(3).max(7).describe('Ordered. Earlier milestones unblock later ones.'),
})

export type Ladder = z.infer<typeof LadderSchema>
export type LadderMilestone = z.infer<typeof MilestoneSchema>
