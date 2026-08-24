import { z } from 'zod';

const participantSchema = z
  .object({
    _id: z.string(),
    Name: z.string(),
    Country: z.string().optional(),
    VenueRole: z.enum(['Home', 'Away']).or(z.string()),
  })
  .passthrough();

const selectionSchema = z
  .object({
    _id: z.string(),
    MarketId: z.string(),
    EventId: z.string(),
    Name: z.string(),
    IsDisabled: z.boolean(),
    DisplayOdds: z.object({ Decimal: z.union([z.string(), z.number()]) }).passthrough(),
    Status: z.union([z.string(), z.number()]).optional(),
    OutcomeType: z.union([z.string(), z.number()]).optional(),
    Points: z.union([z.string(), z.number()]).nullable().optional(),
  })
  .passthrough();

const marketSchema = z
  .object({
    _id: z.string(),
    EventId: z.string(),
    Name: z.string(),
    IsSuspended: z.boolean(),
    IsLive: z.boolean(),
    MarketType: z.object({ _id: z.string(), Name: z.string() }).passthrough(),
    Selections: z.array(selectionSchema),
  })
  .passthrough();

const eventSchema = z
  .object({
    _id: z.string(),
    EventName: z.string(),
    StartEventDate: z.string().datetime(),
    LeagueId: z.string(),
    LeagueName: z.string(),
    SportName: z.string(),
    IsLive: z.boolean(),
    IsSuspended: z.boolean(),
    IsEarlyPayout: z.boolean(),
    Status: z.union([z.string(), z.number()]).optional(),
    Participants: z.array(participantSchema),
    Markets: z.array(marketSchema),
    Settings: z.record(z.string(), z.unknown()).optional(),
    Metadata: z.unknown().optional(),
    Score: z.unknown().optional(),
    LiveGameState: z.unknown().optional(),
  })
  .passthrough();

export const externalDatasetSchema = z
  .object({
    Events: z.array(eventSchema),
    TotalCount: z.number().int().nonnegative(),
  })
  .superRefine((data, context) => {
    if (data.TotalCount !== data.Events.length) {
      context.addIssue({ code: 'custom', message: 'TotalCount no coincide con Events.length' });
    }
  });

export type ExternalDataset = z.infer<typeof externalDatasetSchema>;
