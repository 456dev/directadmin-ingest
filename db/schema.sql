CREATE TABLE incoming_emails (
  id integer PRIMARY KEY,
  remote_id text,
  mail_from text,
  envelope_from text,
  timestamp text,
  update_timestamp text,
  recipients text,
  message_id text,
  subject text,
  size integer,
  raw_data text,
  dkim_verified text,
  smtp_host text
);

CREATE TABLE outgoing_emails (
  id integer PRIMARY KEY,
  remote_id text,
  mail_from text,
  envelope_from text,
  timestamp text,
  update_timestamp text,
  recipients text,
  message_id text,
  subject text,
  size integer,
  raw_data text,
  authenticator_client text
);
