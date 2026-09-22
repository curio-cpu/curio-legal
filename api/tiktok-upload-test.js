export default async function handler(req, res) {
  try {
    const supabaseResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/tiktok_tokens?select=access_token&order=updated_at.desc&limit=1`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    if (!supabaseResponse.ok) {
      return res.status(500).send("Erreur Supabase");
    }

    const tokens = await supabaseResponse.json();

    if (!tokens.length || !tokens[0].access_token) {
      return res.status(404).send("Aucun token TikTok trouvé");
    }

    const response = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens[0].access_token}`,
          "Content-Type": "application/json; charset=UTF-8"
        },
        body: JSON.stringify({
          source_info: {
            source: "PULL_FROM_URL",
            video_url:
              "https://curio-cpu.github.io/curio-legal/2026-09-22-173225235.mp4"
          }
        })
      }
    );

    const data = await response.json();

    return res.status(response.status).json({
      success: response.ok,
      tiktok: data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Erreur serveur"
    });
  }
}
