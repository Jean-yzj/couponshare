-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LoginProvider" AS ENUM ('EMAIL', 'GOOGLE', 'APPLE', 'LINE', 'ANONYMOUS');

-- CreateEnum
CREATE TYPE "UserLevel" AS ENUM ('LEVEL_1', 'LEVEL_2', 'LEVEL_3');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('GIFT', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "CouponCategory" AS ENUM ('CONVENIENCE', 'COFFEE', 'DRINK', 'FASTFOOD', 'DESSERT', 'RESTAURANT', 'SHOPPING', 'ENTERTAINMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "CouponRedeemKind" AS ENUM ('FREE_ITEM', 'DISCOUNT');

-- CreateEnum
CREATE TYPE "CouponStatus" AS ENUM ('DRAFT', 'AVAILABLE', 'PENDING', 'CLAIMED', 'EXPIRED', 'CANCELLED', 'REPORTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UnlockPolicy" AS ENUM ('OWNER_APPROVAL', 'AUTO_REVEAL_AFTER_MESSAGE');

-- CreateEnum
CREATE TYPE "VisibilityLevel" AS ENUM ('PUBLIC', 'LEVEL_2_ONLY', 'LEVEL_3_ONLY');

-- CreateEnum
CREATE TYPE "ClaimRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('CREATED', 'COMPLETED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('INVALID_COUPON', 'EXPIRED_COUPON', 'ALREADY_USED', 'UNREASONABLE_EXCHANGE', 'NO_RESPONSE', 'ABUSIVE_MESSAGE', 'SCAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ScoreEventType" AS ENUM ('COUPON_GIFTED', 'COUPON_EXCHANGED', 'THANK_YOU_MESSAGE', 'POSITIVE_RATING', 'COUPON_WITHDRAWN', 'INVALID_COUPON_REPORT_CONFIRMED', 'NO_SHOW_REPORT_CONFIRMED', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ScoreReferenceType" AS ENUM ('COUPON', 'TRANSACTION', 'REPORT', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CLAIM_REQUEST_RECEIVED', 'CLAIM_APPROVED', 'CLAIM_REJECTED', 'COUPON_EXPIRING_SOON', 'COUPON_EXPIRED', 'TRANSACTION_COMPLETED', 'TRANSACTION_MESSAGE', 'RATING_RECEIVED', 'REPORT_UPDATED', 'BRAND_RESTOCK', 'APPEAL_UPDATED');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "email" TEXT,
    "password_hash" TEXT,
    "apple_sub" TEXT,
    "phone" TEXT,
    "login_provider" "LoginProvider" NOT NULL DEFAULT 'EMAIL',
    "device_id" TEXT,
    "contribution_score" INTEGER NOT NULL DEFAULT 0,
    "user_level" "UserLevel" NOT NULL DEFAULT 'LEVEL_1',
    "risk_flag" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),
    "birth_year" INTEGER,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "utm_term" TEXT,
    "landing_path" TEXT,
    "referred_by_id" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "blocker_id" TEXT NOT NULL,
    "blocked_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "description" TEXT,
    "expiry_date" TIMESTAMP(3),
    "type" "CouponType" NOT NULL,
    "category" "CouponCategory" NOT NULL DEFAULT 'OTHER',
    "exchange_target" TEXT,
    "status" "CouponStatus" NOT NULL DEFAULT 'DRAFT',
    "claimant_id" TEXT,
    "barcode_encrypted_data" TEXT,
    "barcode_mime" TEXT,
    "barcode_image_url" TEXT,
    "barcode_storage_key" TEXT,
    "redeem_code_encrypted" TEXT,
    "redeem_kind" "CouponRedeemKind",
    "unlock_policy" "UnlockPolicy" NOT NULL DEFAULT 'OWNER_APPROVAL',
    "visibility_level" "VisibilityLevel" NOT NULL DEFAULT 'PUBLIC',
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "claim_request_count" INTEGER NOT NULL DEFAULT 0,
    "report_count" INTEGER NOT NULL DEFAULT 0,
    "claimed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_requests" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "request_type" "CouponType" NOT NULL,
    "message" TEXT NOT NULL,
    "exchange_offer_text" TEXT,
    "exchange_offer_image_url" TEXT,
    "status" "ClaimRequestStatus" NOT NULL DEFAULT 'PENDING',
    "owner_response_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),

    CONSTRAINT "claim_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "claimant_id" TEXT NOT NULL,
    "claim_request_id" TEXT NOT NULL,
    "transaction_type" "CouponType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'CREATED',
    "owner_completed" BOOLEAN NOT NULL DEFAULT false,
    "claimant_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "offer_barcode_encrypted_data" TEXT,
    "offer_barcode_mime" TEXT,
    "owner_ready" BOOLEAN NOT NULL DEFAULT false,
    "claimant_ready" BOOLEAN NOT NULL DEFAULT false,
    "revealed_at" TIMESTAMP(3),
    "disputed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_messages" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "rating_score" INTEGER NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "coupon_id" TEXT,
    "transaction_id" TEXT,
    "reported_user_id" TEXT,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT,
    "evidence_image_url" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_ledgers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" "ScoreEventType" NOT NULL,
    "score_delta" INTEGER NOT NULL,
    "reference_type" "ScoreReferenceType" NOT NULL,
    "reference_id" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "before_value" JSONB,
    "after_value" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_follows" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "appeals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_apple_sub_key" ON "users"("apple_sub");

-- CreateIndex
CREATE INDEX "users_referred_by_id_created_at_idx" ON "users"("referred_by_id", "created_at");

-- CreateIndex
CREATE INDEX "users_birth_year_idx" ON "users"("birth_year");

-- CreateIndex
CREATE INDEX "users_utm_source_created_at_idx" ON "users"("utm_source", "created_at");

-- CreateIndex
CREATE INDEX "users_utm_campaign_created_at_idx" ON "users"("utm_campaign", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

-- CreateIndex
CREATE INDEX "blocks_blocked_id_idx" ON "blocks"("blocked_id");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_blocker_id_blocked_id_key" ON "blocks"("blocker_id", "blocked_id");

-- CreateIndex
CREATE INDEX "coupons_owner_id_idx" ON "coupons"("owner_id");

-- CreateIndex
CREATE INDEX "coupons_status_idx" ON "coupons"("status");

-- CreateIndex
CREATE INDEX "coupons_brand_idx" ON "coupons"("brand");

-- CreateIndex
CREATE INDEX "coupons_type_idx" ON "coupons"("type");

-- CreateIndex
CREATE INDEX "coupons_category_idx" ON "coupons"("category");

-- CreateIndex
CREATE INDEX "coupons_expiry_date_idx" ON "coupons"("expiry_date");

-- CreateIndex
CREATE INDEX "coupons_created_at_idx" ON "coupons"("created_at");

-- CreateIndex
CREATE INDEX "coupons_status_created_at_idx" ON "coupons"("status", "created_at");

-- CreateIndex
CREATE INDEX "coupons_status_expiry_date_idx" ON "coupons"("status", "expiry_date");

-- CreateIndex
CREATE INDEX "coupons_status_claim_request_count_idx" ON "coupons"("status", "claim_request_count");

-- CreateIndex
CREATE INDEX "coupons_status_visibility_level_expiry_date_idx" ON "coupons"("status", "visibility_level", "expiry_date");

-- CreateIndex
CREATE INDEX "coupons_status_brand_created_at_idx" ON "coupons"("status", "brand", "created_at");

-- CreateIndex
CREATE INDEX "claim_requests_coupon_id_idx" ON "claim_requests"("coupon_id");

-- CreateIndex
CREATE INDEX "claim_requests_requester_id_idx" ON "claim_requests"("requester_id");

-- CreateIndex
CREATE INDEX "claim_requests_status_idx" ON "claim_requests"("status");

-- CreateIndex
CREATE INDEX "claim_requests_coupon_id_status_idx" ON "claim_requests"("coupon_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "claim_requests_coupon_id_requester_id_key" ON "claim_requests"("coupon_id", "requester_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_coupon_id_key" ON "transactions"("coupon_id");

-- CreateIndex
CREATE INDEX "transactions_owner_id_idx" ON "transactions"("owner_id");

-- CreateIndex
CREATE INDEX "transactions_claimant_id_idx" ON "transactions"("claimant_id");

-- CreateIndex
CREATE INDEX "transaction_messages_transaction_id_idx" ON "transaction_messages"("transaction_id");

-- CreateIndex
CREATE INDEX "ratings_to_user_id_idx" ON "ratings"("to_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_transaction_id_from_user_id_to_user_id_key" ON "ratings"("transaction_id", "from_user_id", "to_user_id");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_coupon_id_idx" ON "reports"("coupon_id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporter_id_coupon_id_key" ON "reports"("reporter_id", "coupon_id");

-- CreateIndex
CREATE INDEX "score_ledgers_user_id_idx" ON "score_ledgers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "score_ledgers_user_id_event_type_reference_type_reference_i_key" ON "score_ledgers"("user_id", "event_type", "reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_action_created_at_idx" ON "audit_logs"("actor_id", "action", "created_at");

-- CreateIndex
CREATE INDEX "brand_follows_brand_idx" ON "brand_follows"("brand");

-- CreateIndex
CREATE UNIQUE INDEX "brand_follows_user_id_brand_key" ON "brand_follows"("user_id", "brand");

-- CreateIndex
CREATE INDEX "appeals_user_id_idx" ON "appeals"("user_id");

-- CreateIndex
CREATE INDEX "appeals_status_idx" ON "appeals"("status");

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_claimant_id_fkey" FOREIGN KEY ("claimant_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_requests" ADD CONSTRAINT "claim_requests_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_requests" ADD CONSTRAINT "claim_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_claimant_id_fkey" FOREIGN KEY ("claimant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_claim_request_id_fkey" FOREIGN KEY ("claim_request_id") REFERENCES "claim_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_messages" ADD CONSTRAINT "transaction_messages_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_messages" ADD CONSTRAINT "transaction_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_ledgers" ADD CONSTRAINT "score_ledgers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_follows" ADD CONSTRAINT "brand_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

