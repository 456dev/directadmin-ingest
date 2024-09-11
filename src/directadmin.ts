async function callDirectAdminAPI(env: Env, path: string, data: RequestInit<RequestInitCfProperties> = {}) {
  data.headers = {
    ...data.headers,
    Authorization: `Basic ${btoa(env.DIRECTADMIN_LOGIN_USERNAME + ":" + env.DIRECTADMIN_LOGIN_TOKEN)}`,
    "User-Agent": "DirectAdminEmailLogsIngester - github.com/0456456/directadmin-ingest " + env.DEPLOYMENT_USERAGENT_CONTACT,
  };
  return fetch(env.DIRECTADMIN_BASE_URL + path, data);
}

export enum EmailDeliveryState {
  DELIVERED = "delivered",
  DEFERRED = "deferred",
  FAILED = "failed",
  UNKNOWN = "unknown",
}

interface EmailLogRecipient {
  address: string;
  state: string; // not enum, as i want to be as permisive as possible
  message?: string;
  return_path?: string;
}
export interface EmailLogEntry {
  id: string;
  datetime: string;
  state: string;
  from: string;
  to: EmailLogRecipient[];
  authenticator_client?: string; // Out only
  authenticator_name?: string; // Out only
  authenticator_type?: string; // Out only
  certificate_verified?: boolean; // ?
  chunking?: boolean; // ?
  ciphers?: string; // both
  direction?: string; // both
  dkim_verified?: string; // in only
  envelope_from?: string; // both
  host?: string; // both
  local_bounce?: string; // ?
  local_user?: string; // ?
  message_id?: string; // both
  protocol?: string; // both
  router?: string; // both
  size?: number; // both
  smtp_confirmation?: string; // both
  subject?: string; // both
  transport?: string; // both
}

interface EmailLogResponse {
  more: boolean;
  emails: EmailLogEntry[];
}

export async function getEmailLogs(
  env: Env,
  from: Date,
  to: Date | undefined = undefined,
  address: string | undefined = undefined,
  domain: string | undefined = undefined,
  state: EmailDeliveryState | undefined = undefined,
  type: "in" | "out" | undefined = undefined
): Promise<EmailLogResponse> {
  const params = new URLSearchParams();
  params.set("from", from.toISOString());
  if (to) {
    params.set("to", to.toISOString());
  }
  if (address) {
    params.set("address", address);
  }
  if (domain) {
    params.set("domain", domain);
  }
  if (state) {
    params.set("state", state);
  }
  if (type) {
    params.set("type", type);
  }

  const response = await callDirectAdminAPI(env, "/api/email-logs" + "?" + params.toString());

  return response.json().catch((err) => {
    console.error("worker catch in json parsing", err);
  }) as Promise<EmailLogResponse>;
}
