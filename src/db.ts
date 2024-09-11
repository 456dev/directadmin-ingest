import { InStatement, Client as LibsqlClient, createClient } from "@libsql/client/web";
import { EmailLogEntry } from "./directadmin";

export function buildLibsqlClient(env: Env): LibsqlClient {
  const url = env.TURSO_URL?.trim();
  if (url === undefined) {
    throw new Error("TURSO_URL env var is not defined");
  }

  const authToken = env.TURSO_AUTH_TOKEN?.trim();
  if (authToken == undefined) {
    throw new Error("TURSO_AUTH_TOKEN env var is not defined");
  }

  return createClient({ url, authToken });
}





export class InEmail {
  remote_id: string;
  mail_from: string;
  envelope_from: string | null;
  timestamp: Date;
  update_timestamp: Date;
  recipients: string[];
  message_id: string | null;
  subject: string | null;
  size: number | null;
  raw_data: EmailLogEntry
  dkim_verified: string | null;
  smtp_host: string | null;

  static fromEmail(email: EmailLogEntry) {
    return new InEmail(email.id, email.from, email.envelope_from ?? null, new Date(email.datetime), new Date(), email.to.map(r => r.address), email.message_id ?? null, email.subject ?? null, email.size ?? null, email, email.dkim_verified ?? null, email.host ?? null);
  }

  constructor(remote_id: string, mail_from: string, envelope_from: string | null, timestamp: Date, update_timestamp: Date, recipients: string[], message_id: string | null, subject: string | null, size: number | null, raw_data: EmailLogEntry, dkim_verified: string | null, smtp_host: string | null) {
    this.remote_id = remote_id;
    this.mail_from = mail_from;
    this.envelope_from = envelope_from;
    this.timestamp = timestamp;
    this.update_timestamp = update_timestamp;
    this.recipients = recipients;
    this.message_id = message_id;
    this.subject = subject;
    this.size = size;
    this.raw_data = raw_data;
    this.dkim_verified = dkim_verified;
    this.smtp_host = smtp_host;
  }

  public toStatement() : InStatement {
    return {
      sql: "INSERT INTO incoming_emails (remote_id, mail_from, envelope_from, timestamp, update_timestamp, recipients, message_id, subject, size, raw_data, dkim_verified, smtp_host) VALUES (?, ?, ?, ?, ?, ?, ?, ? ,?, ?, ?, ?)",
      args: [
        this.remote_id,
        this.mail_from,
        this.envelope_from,
        this.timestamp.toISOString(),
        this.update_timestamp.toISOString(),
        this.recipients.join("\n"),
        this.message_id,
        this.subject,
        this.size,
        JSON.stringify(this.raw_data),
        this.dkim_verified,
        this.smtp_host
      ]
    }

  }
}


export class OutEmail {
  remote_id: string;
  mail_from: string;
  envelope_from: string | null;
  timestamp: Date;
  update_timestamp: Date;
  recipients: string[];
  message_id: string | null;
  subject: string | null;
  size: number | null;
  raw_data: EmailLogEntry
  authenticator_client: string | null;

  static fromEmail(email: EmailLogEntry) {
    return new OutEmail(email.id, email.from, email.envelope_from ?? null, new Date(email.datetime), new Date(), email.to.map(r => r.address), email.message_id ?? null, email.subject ?? null, email.size ?? null, email, email.authenticator_client ?? null);
  }

  constructor(remote_id: string, mail_from: string, envelope_from: string | null, timestamp: Date, update_timestamp: Date, recipients: string[], message_id: string | null, subject: string | null, size: number | null, raw_data: EmailLogEntry, authenticator_client: string | null) {
    this.remote_id = remote_id;
    this.mail_from = mail_from;
    this.envelope_from = envelope_from;
    this.timestamp = timestamp;
    this.update_timestamp = update_timestamp;
    this.recipients = recipients;
    this.message_id = message_id;
    this.subject = subject;
    this.size = size;
    this.raw_data = raw_data;
    this.authenticator_client = authenticator_client;
  }

  public toStatement() : InStatement {
    return {
      sql: "INSERT INTO outgoing_emails (remote_id, mail_from, envelope_from, timestamp, update_timestamp, recipients, message_id, subject, size, raw_data, authenticator_client) VALUES (?, ?, ?, ?, ?, ?, ?, ? ,?, ?, ?)",
      args: [
        this.remote_id,
        this.mail_from,
        this.envelope_from,
        this.timestamp.toISOString(),
        this.update_timestamp.toISOString(),
        this.recipients.join("\n"),
        this.message_id,
        this.subject,
        this.size,
        JSON.stringify(this.raw_data),
        this.authenticator_client
      ]
    }

  }


}
