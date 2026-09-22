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
    // 1. Échange du code contre les tokens
    const tokenResponse = await fetch(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return res.status(400).json({
        success: false,
        error: tokenData
      });
    }

    const accessToken = tokenData.access_token;

    // 2. Vérification du compte TikTok connecté
    const creatorResponse = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const creatorData = await creatorResponse.json();

    if (!creatorResponse.ok || creatorData.error?.code !== "ok") {
      return res.status(400).json({
        success: false,
        error: creatorData
      });
    }

    // 3. Confirmation sans jamais afficher le token
    const creator = creatorData.data;

    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Curio — TikTok connecté</title>
      </head>

      <body style="font-family:Arial;text-align:center;padding:40px">

        <h1>Curio est connecté à TikTok</h1>

        <p>Autorisation réussie.</p>

        <h2>@${creator.creator_username || "compte TikTok"}</h2>

        <p>
          Le compte est autorisé à utiliser Content Posting API.
        </p>

        <p>
          Options de confidentialité disponibles :
          ${creator.privacy_level_options?.join(", ") || "non disponibles"}
        </p>

      </body>
      </html>
    `);

  } catch (error) {
    console.error(error);

    return res.status(500).send(
      "Erreur lors de la connexion à TikTok"
    );
  }
}
