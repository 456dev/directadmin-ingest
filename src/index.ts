/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { buildLibsqlClient, InEmail, OutEmail } from "./db";
import { EmailDeliveryState, EmailLogEntry, getEmailLogs } from "./directadmin";
import { logToDiscord } from "./util";

function log(msg: string, env: Env, ctx: ExecutionContext, forceDiscord: boolean = false) {
  console.log(msg);
  if (forceDiscord) {
    ctx.waitUntil(logToDiscord(msg, env));
  }
}

async function onCronTrigger(event: ScheduledController | null, env: Env, ctx: ExecutionContext): Promise<void> {
  // get current datetime
  const now = new Date();
  log("Fetching emails - triggered at" + now.toISOString(), env, ctx);

  // get last successfully fetched emails stored time
  const lastTimeString = await env.STATE_KV.get("last_fetched_email_time");
  const lastRunTime = await env.STATE_KV.get("last_run_time");
  log("Last fetched email time" + lastTimeString, env, ctx);
  let fromTime;
  if (lastTimeString !== null) {
    fromTime = new Date(lastTimeString);
  }

  const minTime = new Date(now.getTime() - env.DIRECTADMIN_MAILLOG_MAX_AGE);
  if (fromTime === undefined || fromTime < minTime) {
    fromTime = minTime;
  }

  const toTime = new Date(fromTime.getTime() + env.DIRECTADMIN_MAILLOG_FETCH_MAX);
  log("Fetching emails from " + fromTime.toISOString() + " to " + toTime.toISOString(), env, ctx);
  const logs = await getEmailLogs(env, fromTime, toTime);

  const incomplete = logs.more;

  log("Recieved " + logs.emails.length + " email logs, incomplete: " + incomplete, env, ctx);

  if (incomplete) {
    log(`Recieved incomplete email response. got ${logs.emails.length} messages`, env, ctx, true);
  }
  // fetch emails
  // if "more:true" - ensure all emails in period are fetched?
  // TODO determine more behaviour. if its strongly ordered, which i suspect it is, we can set last successfull fetch to that of the last email present.
  // currently assuming true, maybe send alert.

  // process emails, storing (changes) in db
  let nextStartTime = await processEmails(logs.emails, env, ctx);
  // if a date is returned, it signifies the first email in the response that might change in the future

  if (nextStartTime === null) {
    if (incomplete) {
      const lastEmail = logs.emails[logs.emails.length - 1];
      nextStartTime = new Date(lastEmail.datetime);
      log("using time from last email in list: " + nextStartTime.toISOString(), env, ctx);
    } else {
      nextStartTime = toTime;
      log("using time from end of period: " + nextStartTime.toISOString(), env, ctx);
    }
  } else {
    log("using time from process emails: " + nextStartTime.toISOString(), env, ctx);
  }

  const endTime = new Date();
  log("done: Next fetch from " + nextStartTime.toISOString(), env, ctx);
  log("ran in " + (endTime.getTime() - now.getTime()) + "ms", env, ctx);
  ctx.waitUntil(env.STATE_KV.put("last_run_time", endTime.toISOString()));
  ctx.waitUntil(env.STATE_KV.put("last_fetched_email_time", nextStartTime.toISOString()));

  // set last successfully fetched email time, to the first email with the state that isnt "delivered or failed" (since failed isnt going to change either)
  // if all emails are delivered
  //  if more=false
  //    set to the end period datetime, since there are no emails between last email and now.
  //  else more=true
  //    set to the last email datetime, since there are more emails to fetch after last returned email.
}

async function processEmails(emails: EmailLogEntry[], env: Env, ctx: ExecutionContext): Promise<Date | null> {
  const outEmails = [];
  const inEmails = [];
  let firstNonFullEmail = null;

  for (const email of emails) {
    const direction = email.direction;
    if (direction === "in") {
      inEmails.push(InEmail.fromEmail(email));
    } else if (direction === "out") {
      outEmails.push(OutEmail.fromEmail(email));
    } else {
      log(`Unknown email direction: ${direction}\n\`\`\`json\n${JSON.stringify(email, undefined, 2)}\n\`\`\``, env, ctx, true);
      continue;
    }
    if (
      (firstNonFullEmail === null && email.state !== EmailDeliveryState.DELIVERED && email.state !== EmailDeliveryState.UNKNOWN) ||
      email.to.some((rcpt) => rcpt.state !== EmailDeliveryState.DELIVERED && rcpt.state !== EmailDeliveryState.UNKNOWN)
    ) {
      log(`Found email that is not fully delivered\n\`\`\`json\n${JSON.stringify(email, undefined, 2)}\`\`\``, env, ctx, true);
      firstNonFullEmail = new Date(email.datetime);
    }
  }

  log(`processed ${inEmails.length} incoming emails and ${outEmails.length} outgoing emails. writing to DB`, env, ctx);

  // insert emails
  const dbClient = buildLibsqlClient(env);

  const dbResults = await dbClient
    .batch([...inEmails.map((email) => email.toStatement()), ...outEmails.map((email) => email.toStatement())], "write")
    .catch((e) => {
      log(`Error inserting emails into database: ${e}`, env, ctx, true);
      throw e;
    });

  log(`Inserted ${dbResults.length} emails into database`, env, ctx);

  return firstNonFullEmail;
}

/// process emails
// loop through emails, collecting into 2x arrays based on direction
// collect basic info from raw data, being null tolerant
// create 2 insert statements with all data

/// compact emails
// fetch all emails with multiple entries under the same remote_id
// if the raw data is the same, remove newer entries

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const requestURL = new URL(request.url);
    if (!requestURL.pathname.startsWith("/" + env.FETCH_MAGIC_PATH)) {
      return new Response("Not found", { status: 404 });
    }

    if (requestURL.pathname === "/" + env.FETCH_MAGIC_PATH) {
      const dbClient = buildLibsqlClient(env);
      const results = await dbClient.batch(
        [
          {
            sql: "SELECT COUNT(*) FROM incoming_emails",
            args: [],
          },
          {
            sql: "SELECT COUNT(*) FROM outgoing_emails",
            args: [],
          },
        ],
        "read"
      );

      const lastTimeString = await env.STATE_KV.get("last_fetched_email_time");
      const lastRunTime = await env.STATE_KV.get("last_run_time");

      return new Response(`Incoming: ${results[0].rows[0][0]}
Outgoing: ${results[1].rows[0][0]}
Last fetched email time: ${lastTimeString}
Last run time: ${lastRunTime}`);
    }
    return new Response("Not found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(onCronTrigger(event, env, ctx));
  },
} satisfies ExportedHandler<Env>;
