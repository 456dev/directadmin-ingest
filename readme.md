# directadmin Log ingester

autonomous cloudflare worker
every 10 mins, try fetching unfetched data from direct admin api

if more emails requested than were possible to retrive, split into smaller batches

mx route max request period 7 days (between to and from)
max historical time ~ 1 month ago.


# frontend

search:
sending address
any recving address, if multiple

recieving account (pre forwarding i think)



# db format

OUTGOING
`id`: unique, auto increment int id.
`remote_id`: direct admin id, to enable dedupe when updating
`from`
`envelope_from`: what address it was sent from
`timestamp`: when sent
`update_timestamp`: when this was seen + added to the db
`recipients`: list of who recieved the email?
`message_id`
`subject`
`size`
`raw_data`: raw json data from api

`authenticator_client`: what user was authenticated

INCOMING
`id`
`remote_id`: direct admin id, to enable dedupe when updating
`from`
`envelope_from`
`timestamp`
`update_timestamp`: when this was seen + added to the db
`recipients`
`message_id`
`subject`
`size`
`raw_data`: raw json data from api

`dkim_verified`
`smtp_host`

