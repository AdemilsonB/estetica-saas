import twilio from "twilio";
import { NotificationStatus } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";

// Rate limiter in-memory — funciona por processo (não distribuído)
// Em produção com múltiplas instâncias, substituir por Upstash Redis
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = 100;

  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (entry.count >= maxRequests) return true;
  entry.count++;
  return false;
}

function mapTwilioStatus(twilioStatus: string): NotificationStatus {
  switch (twilioStatus) {
    case "delivered":
      return NotificationStatus.DELIVERED;
    case "failed":
    case "undelivered":
      return NotificationStatus.FAILED;
    default:
      return NotificationStatus.SENT;
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  if (isRateLimited(ip)) {
    return new Response(null, { status: 429 });
  }

  const bodyText = await request.text();
  const params = new URLSearchParams(bodyText);
  const paramObject = Object.fromEntries(params.entries());

  const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
  const signature = request.headers.get("x-twilio-signature") ?? "";
  const url = `${process.env.APP_URL}/api/webhooks/twilio/status`;

  const isValid = twilio.validateRequest(authToken, signature, url, paramObject);
  if (!isValid) {
    return new Response(null, { status: 403 });
  }

  const messageSid = params.get("MessageSid");
  const messageStatus = params.get("MessageStatus") ?? "";
  const errorCode = params.get("ErrorCode") ?? null;

  if (!messageSid) {
    return new Response(null, { status: 400 });
  }

  const status = mapTwilioStatus(messageStatus);

  await prisma.notificationLog.updateMany({
    where: { externalId: messageSid },
    data: { status, errorMessage: errorCode },
  });

  return new Response(null, { status: 204 });
}
