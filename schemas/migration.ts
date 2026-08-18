import { z } from "zod";
export const migrationManifestSchema=z.object({format:z.literal("budget-jr-export"),version:z.number().int().min(1).max(1),exportedAt:z.string().optional(),entities:z.array(z.object({key:z.string(),file:z.string(),count:z.number().int().nonnegative()})).optional()}).passthrough();
export type MigrationManifest=z.infer<typeof migrationManifestSchema>;
