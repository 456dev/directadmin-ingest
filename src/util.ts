
export async function logToDiscord(message:string, env: Env): Promise<void> {

  const url = env.DISCORD_WEBHOOK_URL;
  const body = JSON.stringify({ content: message });
  const headers = {
    "Content-Type": "application/json",
  };
  const init = {
    method: "POST",
    headers,
    body,
  };
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Failed to send message to Discord: ${await response.text()}`);
  }

}
