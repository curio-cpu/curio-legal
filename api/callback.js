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
      </body>
      </html>
    `);
  } catch (error) {
    return res.status(500).send("Erreur lors de la connexion TikTok");
  }
}
