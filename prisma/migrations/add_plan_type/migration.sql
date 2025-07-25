-- Add planType column to payments table
ALTER TABLE "payments" ADD COLUMN "planType" TEXT NOT NULL DEFAULT 'basic';

-- Add comment for the column
COMMENT ON COLUMN "payments"."planType" IS 'Plan type: basic, standard, pro'; 