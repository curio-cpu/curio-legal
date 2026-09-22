export default async function handler(req, res) {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send("Code ou state manquant");
  }

  const cookies = req.headers.cookie || "";

  const savedState = cookies
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("tt_state="))
    ?.split("=")[1];

  if (!savedState || savedState !== state) {
    return res.status(400).send("State OAuth invalide");
  }

  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: "https://curio-six-jet.vercel.app/api/callback"
  });

  try {
    const response = await fetch(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json(data);
    }

    // Enregistrement sécurisé du token dans Supabase
    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;

    const refreshExpiresAt = data.refresh_expires_in
      ? new Date(Date.now() + data.refresh_expires_in * 1000).toISOString()
      : null;

    const supabaseResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/tiktok_tokens?on_conflict=open_id`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          open_id: data.open_id,
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: expiresAt,
          refresh_expires_at: refreshExpiresAt,
          scope: data.scope
        })
      }
    );

    if (!supabaseResponse.ok) {
      const supabaseError = await supabaseResponse.text();
      return res.status(500).send(
        `Connexion TikTok réussie, mais erreur Supabase : ${supabaseError}`
      );
    }

    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Curio — TikTok connecté</title>
      </head>
      <body style="font-family:Arial;text-align:center;padding:50px">
        <h1>Curio est connecté à TikTok</h1>
        <p>Autorisation réussie.</p>
        <p>Le compte TikTok est maintenant enregistré de manière sécurisée.</p>
      </body>
      </html>
    `);

  } catch (error) {
    return res.status(500).send(
      "Erreur lors de la connexion TikTok"
    );
  }
}
