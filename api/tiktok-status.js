export default async function handler(req, res) {
  try {
    const publishId = req.query?.publish_id;

    if (!publishId) {
      return res.status(400).json({
        success: false,
        message: "publish_id manquant"
      });
    }

    const supabaseResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/tiktok_tokens?select=*&order=updated_at.desc&limit=1`,
      {
        headers: {
          apikey: process.env.SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`
        }
      }
    );

    const tokens = await supabaseResponse.json();

    if (!supabaseResponse.ok || !tokens.length) {
      return res.status(500).json({
        success: false,
        message: "Token TikTok introuvable",
        details: tokens
      });
    }

    const token = tokens[0];

    const statusResponse = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json; charset=UTF-8"
        },
        body: JSON.stringify({
          publish_id: publishId
        })
      }
    );

    const data = await statusResponse.json();

    return res.status(statusResponse.status).json({
      success: statusResponse.ok,
      publish_id: publishId,
      tiktok: data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: error.message
    });
  }
}
