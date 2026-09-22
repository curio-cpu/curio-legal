import crypto from "node:crypto";

export default function handler(req, res) {
  const clientKey = (process.env.TIKTOK_CLIENT_KEY || "").trim();
  const redirectUri = "https://curio-six-jet.vercel.app/api/callback";

  if (!clientKey) {
    return res.status(500).send("TIKTOK_CLIENT_KEY manquant");
  }

  const state = crypto.randomUUID();

  res.setHeader(
    "Set-Cookie",
    `tt_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );

  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: "code",
    scope: "user.info.basic,video.publish",
    redirect_uri: redirectUri,
    state
  });

  res.redirect(
    `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
  );
}
