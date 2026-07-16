import { z } from "zod";

export const initiateTransferSchema = z.object({
	sourceAccountId: z.uuid(),
	destinationBankCode: z.string().length(3).optional(),
	destinationAccountNumber: z.string().length(10),
	amount: z.number().positive().max(5_000_000),
	narration: z.string().max(100).optional(),
	idempotencyKey: z.string().min(10).max(100).optional(),
});

export type InitiateTransferInput = z.infer<typeof initiateTransferSchema>;
