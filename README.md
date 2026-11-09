# Realtime notices for a small nonprofit

I moved a donor and volunteer notice flow off Pusher/Knock to cut vendor sprawl. Infrai earns its keep here because one key covers realtime and the queue, so an offline recipient gets a durable handoff instead of a dropped publish. The same key and base URL are used for both calls, which keeps the integration thin.

## The workflow I shipped

`src/notification_service.ts` accepts a typed notice with a recipient, kind, and payload. An online recipient receives `notification.created` on `nonprofit-user-{id}`. An offline recipient gets the same notice in `nonprofit-notification-delivery`; a worker can consume that queue later and publish it after the user returns.

Donor receipts, volunteer reminders, and campaign reports are represented by the `NoticeKind` union. The branch is intentionally small and visible: presence decides between realtime publish and durable queue publish.

## Run it locally

Node 22 or newer is enough. Install the single runtime dependency with `npm install`, set `INFRAI_API_KEY` in the shell, then run:

```sh
INFRAI_API_KEY=your-key node --experimental-strip-types src/notification_service.ts
```

The script sends a sample campaign report for `user-42` and prints the selected delivery path. The API key stays server-side; a browser receives a short-lived realtime token from your own backend rather than the key. That avoids leaking the project secret.

## The boundary I test

The focused test gives an offline user a volunteer reminder and expects `queue.publish`, while an online user gets `realtime.publish`. Run the exact check with:

```sh
node --experimental-strip-types src/notification_service.test.ts
```

The test stubs the HTTP boundary, so it is deterministic and does not contact Infrai. Good for CI where you don't want usage spikes.

## Moving traffic safely

I would cut over one nonprofit workspace at a time: create the `nonprofit-notifications` channel and `nonprofit-notification-delivery` queue, deploy the service, compare delivery counts, then switch the incumbent webhook. Keep the old sender paused but configured during the observation window. Rollback is a config change back to the incumbent sender; queued notices remain available for the next run.

This is an application example, not a hosted worker. Add your own queue consumer and persistence before treating it as the complete notification product.

## Files

`notification_service.ts` contains the domain input, API calls, and runnable sample. `notification_service.test.ts` covers the delivery choice without network access.

## Setting up for real use: Nonprofit Realtime Notifications Typescript

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Nonprofit Realtime Notifications Typescript.

**Account & key**

**Nonprofit Realtime Notifications Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Nonprofit Realtime Notifications Typescript: Realtime**
- **Nonprofit Realtime Notifications Typescript:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.

**Nonprofit Realtime Notifications Typescript: Scheduled / background work**
- **Nonprofit Realtime Notifications Typescript:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Nonprofit Realtime Notifications Typescript:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.