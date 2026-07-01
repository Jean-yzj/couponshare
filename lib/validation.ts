import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(200),
  display_name: z.string().min(1).max(40),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createCouponSchema = z.object({
  title: z.string().min(1).max(80),
  brand: z.string().min(1).max(40),
  category: z.enum([
    "CONVENIENCE",
    "COFFEE",
    "DRINK",
    "FASTFOOD",
    "DESSERT",
    "RESTAURANT",
    "SHOPPING",
    "ENTERTAINMENT",
    "OTHER",
  ]),
  description: z.string().max(1000).optional().nullable(),
  expiry_date: z.coerce.date().nullable().optional(),
  type: z.enum(["GIFT", "EXCHANGE"]),
  exchange_target: z.string().max(200).optional().nullable(),
  // Attestation: the coupon is directly redeemable (no add-friend / task gimmicks).
  directly_redeemable: z.literal(true),
  unlock_policy: z.enum(["OWNER_APPROVAL", "AUTO_REVEAL_AFTER_MESSAGE"]).optional(),
  visibility_level: z.enum(["PUBLIC", "LEVEL_2_ONLY", "LEVEL_3_ONLY"]).optional(),
});

export const claimRequestSchema = z.object({
  message: z.string().min(1).max(500),
  request_type: z.enum(["GIFT", "EXCHANGE"]),
  exchange_offer_text: z.string().max(500).optional().nullable(),
});

export const rejectSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const ratingSchema = z.object({
  to_user_id: z.string().min(1),
  rating_score: z.number().int().min(1).max(5),
  tags: z.array(z.string().max(20)).max(10).optional(),
  comment: z.string().max(500).optional().nullable(),
});

export const reportSchema = z.object({
  coupon_id: z.string().optional().nullable(),
  transaction_id: z.string().optional().nullable(),
  reported_user_id: z.string().optional().nullable(),
  reason: z.enum([
    "INVALID_COUPON",
    "EXPIRED_COUPON",
    "ALREADY_USED",
    "UNREASONABLE_EXCHANGE",
    "NO_RESPONSE",
    "ABUSIVE_MESSAGE",
    "SCAM",
    "OTHER",
  ]),
  description: z.string().max(1000).optional().nullable(),
  evidence_image_url: z.string().url().optional().nullable(),
});

export const demoLoginSchema = z.object({ user_id: z.string().min(1) });

export const disputeSchema = z.object({
  reason: z.enum([
    "INVALID_COUPON",
    "ALREADY_USED",
    "EXPIRED_COUPON",
    "NO_RESPONSE",
    "SCAM",
    "OTHER",
  ]),
  description: z.string().max(1000).optional().nullable(),
  evidence_image_url: z.string().url().optional().nullable(),
});

export const transactionMessageSchema = z.object({
  message: z.string().min(1).max(500),
});

export const brandSchema = z.object({
  brand: z.string().min(1).max(60),
});

export const appealSchema = z.object({
  message: z.string().min(5).max(1000),
});

export const adminResolveSchema = z.object({
  decision: z.enum(["ACCEPT", "REJECT"]),
  note: z.string().max(500).optional().nullable(),
});
