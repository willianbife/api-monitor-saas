-- Create enums
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "WorkspacePlan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');
CREATE TYPE "BillingStatus" AS ENUM ('INACTIVE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'VIEWER');
CREATE TYPE "EndpointMethod" AS ENUM ('GET', 'POST', 'PUT', 'DELETE');
CREATE TYPE "CheckRegion" AS ENUM ('PRIMARY', 'US_EAST', 'US_WEST', 'EU_CENTRAL', 'SA_EAST');
CREATE TYPE "CheckState" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN');
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'MONITORING', 'RESOLVED');
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "IncidentVisibility" AS ENUM ('INTERNAL', 'PUBLIC');
CREATE TYPE "AlertChannelType" AS ENUM ('EMAIL', 'DISCORD', 'TELEGRAM', 'WHATSAPP');
CREATE TYPE "AlertEventType" AS ENUM ('FAILURE', 'RECOVERY', 'INCIDENT_OPENED', 'INCIDENT_RESOLVED');
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "AuditAction" AS ENUM (
  'USER_REGISTERED',
  'USER_LOGGED_IN',
  'USER_LOGGED_OUT',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'EMAIL_VERIFICATION_REQUESTED',
  'EMAIL_VERIFIED',
  'WORKSPACE_CREATED',
  'WORKSPACE_MEMBER_INVITED',
  'WORKSPACE_MEMBER_ROLE_UPDATED',
  'ENDPOINT_CREATED',
  'ENDPOINT_UPDATED',
  'ENDPOINT_DELETED',
  'ALERT_CHANNEL_CREATED',
  'ALERT_CHANNEL_UPDATED',
  'ALERT_CHANNEL_DELETED',
  'INCIDENT_CREATED',
  'INCIDENT_UPDATED',
  'INCIDENT_RESOLVED',
  'BILLING_UPDATED'
);
CREATE TYPE "UsageMetricType" AS ENUM ('ENDPOINTS', 'CHECKS', 'INCIDENTS', 'ALERTS');

-- Expand existing tables first
ALTER TABLE "User"
  ADD COLUMN "defaultWorkspaceId" TEXT,
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ApiEndpoint"
  ADD COLUMN "workspaceId" TEXT,
  ADD COLUMN "method" "EndpointMethod" NOT NULL DEFAULT 'GET',
  ADD COLUMN "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
  ADD COLUMN "retries" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requestHeadersEncrypted" TEXT,
  ADD COLUMN "requestBodyEncrypted" TEXT,
  ADD COLUMN "responseValidation" JSONB,
  ADD COLUMN "regions" JSONB,
  ADD COLUMN "alertCooldownSeconds" INTEGER NOT NULL DEFAULT 300,
  ADD COLUMN "currentState" "CheckState" NOT NULL DEFAULT 'HEALTHY',
  ADD COLUMN "lastCheckedAt" TIMESTAMP(3),
  ADD COLUMN "lastHealthyAt" TIMESTAMP(3);

ALTER TABLE "ApiCheckResult"
  ADD COLUMN "region" "CheckRegion" NOT NULL DEFAULT 'PRIMARY',
  ADD COLUMN "totalResponseMs" INTEGER,
  ADD COLUMN "dnsLookupMs" INTEGER,
  ADD COLUMN "tlsHandshakeMs" INTEGER,
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "responseSnippet" TEXT,
  ADD COLUMN "validationPassed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "state" "CheckState" NOT NULL DEFAULT 'HEALTHY';

-- New tables
CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "plan" "WorkspacePlan" NOT NULL DEFAULT 'FREE',
  "billingStatus" "BillingStatus" NOT NULL DEFAULT 'INACTIVE',
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "trialEndsAt" TIMESTAMP(3),
  "statusPageTitle" TEXT,
  "statusPageDescription" TEXT,
  "publicStatusEnabled" BOOLEAN NOT NULL DEFAULT false,
  "publicStatusSlug" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceMembership" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceInvitation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailVerificationToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EndpointAvailabilityWindow" (
  "id" TEXT NOT NULL,
  "endpointId" TEXT NOT NULL,
  "region" "CheckRegion" NOT NULL DEFAULT 'PRIMARY',
  "windowKey" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "windowEnd" TIMESTAMP(3) NOT NULL,
  "uptimePercentage" DOUBLE PRECISION NOT NULL,
  "healthyChecks" INTEGER NOT NULL DEFAULT 0,
  "degradedChecks" INTEGER NOT NULL DEFAULT 0,
  "downChecks" INTEGER NOT NULL DEFAULT 0,
  "totalChecks" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EndpointAvailabilityWindow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Incident" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "endpointId" TEXT,
  "createdById" TEXT,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
  "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
  "visibility" "IncidentVisibility" NOT NULL DEFAULT 'INTERNAL',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncidentNote" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "userId" TEXT,
  "body" TEXT NOT NULL,
  "visibility" "IncidentVisibility" NOT NULL DEFAULT 'INTERNAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncidentNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlertChannel" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "endpointId" TEXT,
  "name" TEXT NOT NULL,
  "type" "AlertChannelType" NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "target" TEXT NOT NULL,
  "configEncrypted" TEXT,
  "cooldownSeconds" INTEGER NOT NULL DEFAULT 300,
  "lastTriggeredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlertChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlertDelivery" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "endpointId" TEXT,
  "incidentId" TEXT,
  "eventType" "AlertEventType" NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "payload" JSONB,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlertDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StatusPage" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StatusPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StatusPageEndpoint" (
  "id" TEXT NOT NULL,
  "statusPageId" TEXT NOT NULL,
  "endpointId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "StatusPageEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageRecord" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "monthStart" TIMESTAMP(3) NOT NULL,
  "metric" "UsageMetricType" NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "userId" TEXT,
  "action" "AuditAction" NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Backfill workspaces for existing users
INSERT INTO "Workspace" (
  "id",
  "name",
  "slug",
  "createdById",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  split_part("email", '@', 1) || ' workspace',
  regexp_replace(lower(split_part("email", '@', 1)), '[^a-z0-9]+', '-', 'g'),
  "id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User";

INSERT INTO "WorkspaceMembership" (
  "id",
  "workspaceId",
  "userId",
  "role",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  w."id",
  u."id",
  'OWNER'::"WorkspaceRole",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
JOIN "Workspace" w ON w."createdById" = u."id";

UPDATE "User" u
SET "defaultWorkspaceId" = w."id"
FROM "Workspace" w
WHERE w."createdById" = u."id";

UPDATE "ApiEndpoint" e
SET "workspaceId" = u."defaultWorkspaceId"
FROM "User" u
WHERE u."id" = e."userId";

INSERT INTO "StatusPage" (
  "id",
  "workspaceId",
  "slug",
  "title",
  "isPublic",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  w."id",
  w."slug" || '-status',
  w."name" || ' status',
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Workspace" w;

INSERT INTO "StatusPageEndpoint" (
  "id",
  "statusPageId",
  "endpointId",
  "sortOrder",
  "isVisible"
)
SELECT
  gen_random_uuid()::text,
  sp."id",
  e."id",
  0,
  e."isPublic"
FROM "ApiEndpoint" e
JOIN "Workspace" w ON w."id" = e."workspaceId"
JOIN "StatusPage" sp ON sp."workspaceId" = w."id";

INSERT INTO "UsageRecord" (
  "id",
  "workspaceId",
  "monthStart",
  "metric",
  "quantity",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  e."workspaceId",
  date_trunc('month', CURRENT_TIMESTAMP),
  'ENDPOINTS'::"UsageMetricType",
  count(*),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ApiEndpoint" e
GROUP BY e."workspaceId";

ALTER TABLE "ApiEndpoint"
  ALTER COLUMN "workspaceId" SET NOT NULL;

UPDATE "ApiCheckResult"
SET "state" = CASE
  WHEN "statusCode" IS NULL OR "statusCode" >= 500 THEN 'DOWN'::"CheckState"
  WHEN "statusCode" >= 400 OR "isAnomaly" = true THEN 'DEGRADED'::"CheckState"
  ELSE 'HEALTHY'::"CheckState"
END;

UPDATE "ApiEndpoint" e
SET
  "currentState" = COALESCE((
    SELECT r."state"
    FROM "ApiCheckResult" r
    WHERE r."endpointId" = e."id"
    ORDER BY r."createdAt" DESC
    LIMIT 1
  ), 'HEALTHY'::"CheckState"),
  "lastCheckedAt" = (
    SELECT r."createdAt"
    FROM "ApiCheckResult" r
    WHERE r."endpointId" = e."id"
    ORDER BY r."createdAt" DESC
    LIMIT 1
  ),
  "lastHealthyAt" = (
    SELECT r."createdAt"
    FROM "ApiCheckResult" r
    WHERE r."endpointId" = e."id"
      AND r."state" = 'HEALTHY'::"CheckState"
    ORDER BY r."createdAt" DESC
    LIMIT 1
  );

-- Indexes
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
CREATE UNIQUE INDEX "Workspace_stripeCustomerId_key" ON "Workspace"("stripeCustomerId");
CREATE UNIQUE INDEX "Workspace_stripeSubscriptionId_key" ON "Workspace"("stripeSubscriptionId");
CREATE UNIQUE INDEX "Workspace_publicStatusSlug_key" ON "Workspace"("publicStatusSlug");
CREATE INDEX "Workspace_createdById_idx" ON "Workspace"("createdById");
CREATE INDEX "WorkspaceMembership_userId_idx" ON "WorkspaceMembership"("userId");
CREATE UNIQUE INDEX "WorkspaceMembership_workspaceId_userId_key" ON "WorkspaceMembership"("workspaceId", "userId");
CREATE UNIQUE INDEX "WorkspaceInvitation_tokenHash_key" ON "WorkspaceInvitation"("tokenHash");
CREATE INDEX "WorkspaceInvitation_workspaceId_email_idx" ON "WorkspaceInvitation"("workspaceId", "email");
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId", "expiresAt");
CREATE INDEX "EndpointAvailabilityWindow_endpointId_windowStart_idx" ON "EndpointAvailabilityWindow"("endpointId", "windowStart");
CREATE UNIQUE INDEX "EndpointAvailabilityWindow_endpointId_region_windowKey_key" ON "EndpointAvailabilityWindow"("endpointId", "region", "windowKey");
CREATE INDEX "Incident_workspaceId_status_idx" ON "Incident"("workspaceId", "status");
CREATE INDEX "Incident_endpointId_status_idx" ON "Incident"("endpointId", "status");
CREATE INDEX "IncidentNote_incidentId_createdAt_idx" ON "IncidentNote"("incidentId", "createdAt");
CREATE INDEX "AlertChannel_workspaceId_isEnabled_idx" ON "AlertChannel"("workspaceId", "isEnabled");
CREATE INDEX "AlertChannel_endpointId_isEnabled_idx" ON "AlertChannel"("endpointId", "isEnabled");
CREATE INDEX "AlertDelivery_endpointId_createdAt_idx" ON "AlertDelivery"("endpointId", "createdAt");
CREATE UNIQUE INDEX "AlertDelivery_channelId_dedupeKey_key" ON "AlertDelivery"("channelId", "dedupeKey");
CREATE UNIQUE INDEX "StatusPage_workspaceId_key" ON "StatusPage"("workspaceId");
CREATE UNIQUE INDEX "StatusPage_slug_key" ON "StatusPage"("slug");
CREATE INDEX "StatusPageEndpoint_statusPageId_sortOrder_idx" ON "StatusPageEndpoint"("statusPageId", "sortOrder");
CREATE UNIQUE INDEX "StatusPageEndpoint_statusPageId_endpointId_key" ON "StatusPageEndpoint"("statusPageId", "endpointId");
CREATE INDEX "UsageRecord_workspaceId_monthStart_idx" ON "UsageRecord"("workspaceId", "monthStart");
CREATE UNIQUE INDEX "UsageRecord_workspaceId_monthStart_metric_key" ON "UsageRecord"("workspaceId", "monthStart", "metric");
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "ApiEndpoint_workspaceId_createdAt_idx" ON "ApiEndpoint"("workspaceId", "createdAt");
CREATE INDEX "ApiEndpoint_workspaceId_currentState_idx" ON "ApiEndpoint"("workspaceId", "currentState");
CREATE INDEX "ApiEndpoint_userId_createdAt_idx" ON "ApiEndpoint"("userId", "createdAt");
CREATE INDEX "ApiCheckResult_endpointId_state_createdAt_idx" ON "ApiCheckResult"("endpointId", "state", "createdAt");
CREATE INDEX "ApiCheckResult_region_createdAt_idx" ON "ApiCheckResult"("region", "createdAt");

-- Foreign keys
ALTER TABLE "User" ADD CONSTRAINT "User_defaultWorkspaceId_fkey" FOREIGN KEY ("defaultWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiEndpoint" ADD CONSTRAINT "ApiEndpoint_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EndpointAvailabilityWindow" ADD CONSTRAINT "EndpointAvailabilityWindow_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "ApiEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "ApiEndpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IncidentNote" ADD CONSTRAINT "IncidentNote_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentNote" ADD CONSTRAINT "IncidentNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AlertChannel" ADD CONSTRAINT "AlertChannel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertChannel" ADD CONSTRAINT "AlertChannel_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "ApiEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "AlertChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "ApiEndpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StatusPage" ADD CONSTRAINT "StatusPage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StatusPageEndpoint" ADD CONSTRAINT "StatusPageEndpoint_statusPageId_fkey" FOREIGN KEY ("statusPageId") REFERENCES "StatusPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StatusPageEndpoint" ADD CONSTRAINT "StatusPageEndpoint_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "ApiEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
