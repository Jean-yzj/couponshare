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
  // 券內容：免費兌換／折價券／買一送一。與品牌分類正交，上架時必選。
  redeem_kind: z.enum(["FREE_ITEM", "DISCOUNT", "BOGO"]),
  // 文字兌換碼（條碼圖片的替代；加密保存、只有領取者看得到）。
  redeem_code: z.string().trim().min(1).max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  expiry_date: z.coerce.date().nullable().optional(),
  type: z.enum(["GIFT", "EXCHANGE"]),
  exchange_target: z.string().max(200).optional().nullable(),
  // Attestation: the coupon is directly redeemable (no add-friend / task gimmicks).
  directly_redeemable: z.literal(true),
  // Attestation: sharer declaration — self-obtained, unused, restrictions disclosed
  // (使用條款第二條). UI copy lives in app/new/Client.tsx.
  sharer_declaration: z.literal(true),
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
  // A base64 data-URI screenshot (validated server-side). External URLs are dropped.
  evidence_image_url: z.string().max(700_000).optional().nullable(),
  // The reporter checked "I'll stand behind this report" — enforced in the route.
  acknowledged: z.boolean().optional(),
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
  // Bounded like the report schema — the route keeps only inline data-URI images.
  evidence_image_url: z.string().max(700_000).optional().nullable(),
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

// 社群發文換申請次數 — both proofs (public link + screenshot) are required.
export const socialPostSchema = z.object({
  topic: z.string().trim().min(2).max(200),
  post_date: z.coerce.date(),
  post_url: z.string().trim().url().max(500),
  evidence_image: z.string().min(1).max(700_000),
});

// Admin decision. APPROVE grants a bonus tier: 10 (normal) or 20 (screenshot shows
// 100+ likes). REJECT (e.g. negative post) grants nothing.
export const socialPostResolveSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  bonus: z.union([z.literal(10), z.literal(20)]).optional(),
  note: z.string().max(500).optional().nullable(),
});

// 企業合作窗口 — public lead form (all four fields required; the admin replies by
// email, so email format matters most).
export const businessLeadSchema = z.object({
  // Required: keep friction low — brand, name, email, and at least one goal.
  name: z.string().trim().min(1, "請填寫姓名").max(40, "姓名太長了"),
  company: z.string().trim().min(1, "請填寫公司 / 品牌名稱").max(60),
  email: z.string().trim().email("請輸入正確的 Email").max(120),
  goals: z.array(z.string().trim().max(20)).min(1, "請至少選一個合作目標").max(10),
  // Optional contact + qualifying fields.
  job_title: z.string().trim().max(40).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  line_id: z.string().trim().max(80).optional().or(z.literal("")),
  // Which plan the lead picked on /business (optional free-text label).
  plan: z.string().trim().max(40).optional().or(z.literal("")),
  categories: z.array(z.string().trim().max(20)).max(15).optional().default([]),
});

export const businessLeadStatusSchema = z.object({
  status: z.enum(["PENDING", "CONTACTED"]),
});

// Admin generates a one-time reset link for an email-login user who forgot their password.
export const adminResetLinkSchema = z.object({
  email: z.string().trim().email("請輸入正確的 Email"),
});

// A user sets a new password using a one-time reset token (from the admin's link).
export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(500),
  password: z.string().min(6, "密碼至少 6 個字").max(200),
});

// ─── 企業官方福利券（admin-managed）───
export const brandCreateSchema = z.object({
  name: z.string().trim().min(1, "請填品牌名稱").max(40),
  logo_text: z.string().trim().max(2).optional().nullable(),
  category: z.string().trim().max(20).optional().nullable(),
  description: z.string().trim().max(300).optional().nullable(),
  website_url: z.string().trim().url("網址格式不正確").max(300).optional().nullable().or(z.literal("")),
  contact_name: z.string().trim().max(40).optional().nullable(),
  contact_email: z.string().trim().email("Email 格式不正確").max(120).optional().nullable().or(z.literal("")),
});

// Data-URI image (logo / coupon image). Magic-byte validated server-side too.
const dataUriImage = z.string().startsWith("data:image/").max(700_000);

export const brandCouponCreateSchema = z.object({
  title: z.string().trim().min(2, "請填券標題").max(60),
  description: z.string().trim().max(300).optional().nullable(),
  category: z.string().trim().max(20).optional().nullable(),
  redeem_info: z.string().trim().max(300).optional().nullable(),
  image_url: dataUriImage.optional().nullable().or(z.literal("")),
  application_mode: z.enum(["DIRECT_CLAIM", "MESSAGE_APPLICATION", "TASK_UNLOCK"]),
  task_instruction: z.string().trim().max(300).optional().nullable(),
  task_url: z.string().trim().url("網址格式不正確").max(500).optional().nullable().or(z.literal("")),
  max_applications: z.number().int().min(1).max(100000),
  max_per_user: z.number().int().min(1).max(100).default(1),
  cta_text: z.string().trim().max(20).optional().nullable(),
  cta_url: z.string().trim().url("網址格式不正確").max(500).optional().nullable().or(z.literal("")),
  usage_expiry: z.coerce.date().optional().nullable(),
});

export const brandCouponStatusSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ENDED"]),
});

// Brand owner edits their brand's public identity.
export const brandEditSchema = z.object({
  name: z.string().trim().min(1, "請填品牌名稱").max(40),
  category: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  description: z.string().trim().max(300).optional().nullable().or(z.literal("")),
  logo_url: dataUriImage.optional().nullable().or(z.literal("")),
});

// Admin assigns a person (by email) as a brand owner, with a plan tier.
export const adminAssignBrandSchema = z.object({
  email: z.string().trim().email("請輸入正確的 Email"),
  brand_name: z.string().trim().min(1, "請填品牌名稱").max(40),
  plan: z.enum(["PRO", "MAX"]),
});

export const brandPlanSchema = z.object({ plan: z.enum(["PRO", "MAX"]) });

// Admin changes brand approval status.
export const brandStatusSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]),
});

export const brandCouponApplySchema = z.object({
  message: z.string().trim().max(200).optional().nullable(),
});

export const brandApplicationDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
});
