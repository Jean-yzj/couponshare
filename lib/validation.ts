import { z } from "zod";

const emailSchema = z.string().trim().email().transform((v) => v.toLowerCase());
const thisYear = new Date().getFullYear();

const utmSchema = z
  .object({
    utm_source: z.string().trim().max(80).optional(),
    utm_medium: z.string().trim().max(80).optional(),
    utm_campaign: z.string().trim().max(120).optional(),
    utm_content: z.string().trim().max(160).optional(),
    utm_term: z.string().trim().max(120).optional(),
    landing_path: z.string().trim().max(300).optional(),
  })
  .optional();

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(6).max(200),
  display_name: z.string().trim().min(1).max(40),
  birth_year: z.coerce.number().int().min(thisYear - 100).max(thisYear - 13).optional().nullable(),
  utm: utmSchema,
  // Optional inviter user id from an invite link (?ref=). Rewards the inviter.
  ref: z.string().trim().max(40).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const nativeGoogleSchema = z.object({
  id_token: z.string().min(20),
});

export const appleLoginSchema = z.object({
  identity_token: z.string().min(20),
  full_name: z
    .union([
      z.string().trim().min(1).max(80),
      z.object({
        givenName: z.string().trim().max(40).optional().nullable(),
        familyName: z.string().trim().max(40).optional().nullable(),
      }),
    ])
    .optional()
    .nullable(),
});

export const pushTokenSchema = z.object({
  token: z.string().min(10).max(300),
  platform: z.literal("ios"),
});

export const deletePushTokenSchema = z.object({
  token: z.string().min(10).max(300).optional(),
});

export const blockUserSchema = z.object({
  user_id: z.string().min(1),
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
  // 券內容：免費兌換實體 vs 折價券。與品牌分類正交，上架時必選。
  redeem_kind: z.enum(["FREE_ITEM", "DISCOUNT"]),
  // 文字兌換碼（條碼圖片的替代；加密保存、只有領取者看得到）。
  redeem_code: z.string().trim().min(1).max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  expiry_date: z.coerce.date().nullable().optional(),
  type: z.enum(["GIFT", "EXCHANGE"]),
  exchange_target: z.string().max(200).optional().nullable(),
  // Attestation: the coupon is directly redeemable (no add-friend / task gimmicks).
  directly_redeemable: z.literal(true),
  unlock_policy: z.enum(["OWNER_APPROVAL", "AUTO_REVEAL_AFTER_MESSAGE"]).optional(),
  visibility_level: z.enum(["PUBLIC", "LEVEL_2_ONLY", "LEVEL_3_ONLY"]).optional(),
});

// Owner fixes listing info after upload. Type is deliberately NOT editable —
// existing applications were made against GIFT vs EXCHANGE semantics.
export const updateCouponSchema = z
  .object({
    title: z.string().min(1).max(80),
    brand: z.string().min(1).max(40),
    category: createCouponSchema.shape.category,
    redeem_kind: createCouponSchema.shape.redeem_kind,
    redeem_code: createCouponSchema.shape.redeem_code,
    description: z.string().max(1000).nullable(),
    expiry_date: z.coerce.date().nullable(),
    exchange_target: z.string().max(200).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "沒有任何要更新的欄位" });

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
  // A base64 data-URI screenshot (validated server-side) or an external URL.
  evidence_image_url: z.string().max(700_000).optional().nullable(),
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
  message: z.string().max(500).optional().default(""),
  image: z.string().max(700_000).optional().nullable(),
}).refine((v) => v.message.trim().length > 0 || !!v.image, {
  message: "請輸入訊息或選擇圖片",
});

export const updateProfileSchema = z.object({
  display_name: z.string().trim().min(1).max(40),
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
