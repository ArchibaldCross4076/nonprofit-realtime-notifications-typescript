import assert from "node:assert/strict";
import { chooseDelivery } from "./notification_service.ts";

const notice = { recipientId: "volunteer-7", kind: "volunteer_reminder" as const, payload: { shift: "Saturday" } };
const offline = chooseDelivery(notice, false);
assert.equal(offline.path, "queue.publish");
assert.equal(offline.target, "nonprofit-notification-delivery");
assert.match(String(offline.body.payload), /volunteer-7/);

const online = chooseDelivery(notice, true);
assert.equal(online.path, "realtime.publish");
assert.equal(online.target, "nonprofit-user-volunteer-7");
console.log("delivery decision test passed");

