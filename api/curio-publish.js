export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Utilise POST pour publier."
      });
    }

    const videoUrl =
      "https://raw.githubusercontent.com/curio-cpu/curio-legal/main/2026-09-22-173225235.mp4";

    // Récupérer le token TikTok
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
        message: "Token TikTok introuvable."
      });
    }

    const token = tokens[0];

    // Télécharger la vidéo
    const videoResponse = await fetch(videoUrl);

    if (!videoResponse.ok) {
      return res.status(500).json({
        success: false,
        message: "Impossible de récupérer la vidéo."
      });
    }

    const videoBuffer = Buffer.from(
      await videoResponse.arrayBuffer()
    );

    const videoSize = videoBuffer.length;

    // Initialiser Direct Post
    const initResponse = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json; charset=UTF-8"
        },
        body: JSON.stringify({
          post_info: {
            title: "Curio — Les premières balles de golf sur la Lune",
            privacy_level: "SELF_ONLY",
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
            is_aigc: true
          },
          source_info: {
            source: "FILE_UPLOAD",
            video_size: videoSize,
            chunk_size: videoSize,
            total_chunk_count: 1
          }
        })
      }
    );

    const initData = await initResponse.json();

    if (!initResponse.ok || !initData.data?.publish_id) {
      return res.status(initResponse.status || 500).json({
        success: false,
        step: "INIT",
        tiktok: initData
      });
    }

    const publishId = initData.data.publish_id;
    const uploadUrl = initData.data.upload_url;

    // Envoyer la vidéo
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(videoSize),
        "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`
      },
      body: videoBuffer
    });

    if (!uploadResponse.ok) {
      return res.status(500).json({
        success: false,
        step: "UPLOAD",
        publish_id: publishId,
        upload_status: uploadResponse.status
      });
    }

    return res.status(200).json({
      success: true,
      message: "Publication TikTok lancée.",
      publish_id: publishId,
      upload_status: uploadResponse.status,
      privacy_level: "SELF_ONLY"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur serveur.",
      error: error.message
    });
  }
}
