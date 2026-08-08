CREATE TYPE "public"."discount_type" AS ENUM('fixed', 'percent');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('draft', 'finalized');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"customer" text NOT NULL,
	"issue_date" date NOT NULL,
	"status" "document_status" DEFAULT 'draft' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"total_discount_cents" integer DEFAULT 0 NOT NULL,
	"total_tax_cents" integer DEFAULT 0 NOT NULL,
	"grand_total_cents" integer DEFAULT 0 NOT NULL,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"description" text NOT NULL,
	"quantity" double precision NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"discount_type" "discount_type",
	"discount_value" double precision,
	"tax_percent" double precision DEFAULT 0 NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"discount_amount_cents" integer NOT NULL,
	"after_discount_cents" integer NOT NULL,
	"tax_amount_cents" integer NOT NULL,
	"line_total_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_user_issue_date_idx" ON "documents" USING btree ("user_id","issue_date");--> statement-breakpoint
CREATE INDEX "documents_user_status_idx" ON "documents" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "line_items_document_id_idx" ON "line_items" USING btree ("document_id");