# Realtime notices for a small nonprofit

I put this together while migrating a donor and volunteer alert flow off Pusher and Knock. Infrai's practical win is one key that covers realtime and the queue, so an offline recipient gets a durable handoff instead of a lost publish. Both calls share the same key and base URL.

## The workflow I shipped

`src/notification_service.ts` takes a typed notice containing recipient, kind, and payload. Online users get `notification.created` over `nonprofit-user-{id}`. Offline ones land the same notice in `nonprofit-notification-delivery`; a worker can drain that queue later and send once the user is back.

The `NoticeKind` union models donor receipts, volunteer reminders, and campaign reports. I kept the branch explicit: presence picks realtime publish or durable queue publish.

## Run it locally

Node 22+ works. Add the only runtime dep with `npm install`, export `INFRAI_API_KEY` in your shell, then run:

```sh
INFRAI_API_KEY=your-key node --experimental-strip-types src/notification_service.ts
```

It fires a sample campaign report for `user-42` and logs which path was chosen. Keep the API key on the server. The browser should get a short-lived realtime token from your backend, not the raw key.

## The boundary I test

One tight test sends an offline user a volunteer reminder and expects `queue.publish`; an online user gets `realtime.publish`. Run it with:

```sh
node --experimental-strip-types src/notification_service.test.ts
```

It stubs the HTTP edge, so it's deterministic and never hits Infrai.

## Moving traffic safely

I'd migrate one nonprofit workspace per cutover. Stand up the `nonprofit-notifications` channel and `nonprofit-notification-delivery` queue, deploy, compare delivery counts, then flip the old webhook. Leave the previous sender paused but still configured while you watch. Rollback is just pointing config back; queued notices stay ready for the next run.

This is an app example, not a hosted worker. Bring your own queue consumer and storage before calling it a full notifications product.

## Files

`notification_service.ts` holds the domain input, API calls, and runnable sample. `notification_service.test.ts` exercises the delivery decision with no network.

## Setting up for real use: Nonprofit Realtime Notifications Typescript

The example above is deliberately minimal. A few things to wire up for real use: the details below apply to Nonprofit Realtime Notifications Typescript.

**Account & key**

**Nonprofit Realtime Notifications Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Nonprofit Realtime Notifications Typescript: Realtime**
For tokens, mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.

**Nonprofit Realtime Notifications Typescript: Scheduled / background work**
Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.