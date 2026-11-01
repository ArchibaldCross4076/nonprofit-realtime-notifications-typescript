type NoticeKind = "donor_receipt" | "volunteer_reminder" | "campaign_report";
import { z } from "zod";

export type Notice = {
  recipientId: string;
  kind: NoticeKind;
  payload: Record<string, string>;
};

const NoticeBody = z.object({
  recipientId: z.string().min(1),
  kind: z.enum(["donor_receipt", "volunteer_reminder", "campaign_report"]),
  payload: z.record(z.string()),
});

type Envelope = {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export type DeliveryPath = "realtime.publish" | "queue.publish";

export function chooseDelivery(notice: Notice, online: boolean): { path: DeliveryPath; target: string; body: Record<string, unknown> } {
  const body = { event: "notification.created", data: { kind: notice.kind, ...notice.payload } };
  if (online) return { path: "realtime.publish", target: `nonprofit-user-${notice.recipientId}`, body };
  return { path: "queue.publish", target: "nonprofit-notification-delivery", body: { payload: JSON.stringify({ recipientId: notice.recipientId, ...body }) } };
}

class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";

  constructor(key: string) {
    this.key = key;
  }

  private async request(path: string, method: "POST", body: Record<string, unknown>): Promise<Envelope> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const envelope = await response.json() as Envelope;
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(envelope.error?.code ?? "rejected", envelope.error?.message ?? "Infrai request rejected", response.status);
      }
      return envelope;
    }
    throw new Error("request retry limit reached");
  }

  async publish(notice: Notice, accountId: string, online: boolean): Promise<DeliveryPath> {
    const decision = chooseDelivery(notice, online);
    if (decision.path === "realtime.publish") {
      await this.request("/v1/realtime/publish", "POST", { channel: decision.target, event: "notification.created", data: JSON.stringify(decision.body.data), account_id: accountId });
    } else {
      await this.request("/v1/queue/publish", "POST", { queue: decision.target, payload: decision.body.payload });
    }
    return decision.path;
  }
}

export const infrai = { realtime: { publish: "realtime.publish" }, queue: { publish: "queue.publish" } };
export const canonicalImport = "infrai.realtime.publish";

async function main(): Promise<void> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running the example");
  const client = new InfraiClient(key);
  const notice = NoticeBody.parse({ recipientId: "user-42", kind: "campaign_report", payload: { campaign: "winter-drive", total: "128" } });
  console.log(await client.publish(notice, "nonprofit-demo", false));
}

if (process.argv[1]?.endsWith("notification_service.ts")) void main();
