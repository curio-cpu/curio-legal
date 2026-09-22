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
      return res.status(500).send("Erreur lors de la récupération du token");
    }

    const tokens = await supabaseResponse.json();

    if (!tokens.length || !tokens[0].access_token) {
      return res.status(404).send("Aucun token TikTok trouvé");
    }

    const response = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens[0].access_token}`,
          "Content-Type": "application/json; charset=UTF-8"
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json({
      success: true,
      creator: {
        username: data.data?.creator_username,
        nickname: data.data?.creator_nickname,
        privacy_level_options: data.data?.privacy_level_options,
        max_video_post_duration_sec:
          data.data?.max_video_post_duration_sec
      }
    });

  } catch (error) {
    return res.status(500).send("Erreur serveur");
  }
}
