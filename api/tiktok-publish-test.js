export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Méthode non autorisée."
      });
    }

    // Vidéo de test hébergée dans notre dépôt GitHub public
    const videoUrl =
      "https://raw.githubusercontent.com/curio-cpu/curio-legal/main/2026-09-22-173225235.mp4";

    // 1. Télécharger la vidéo depuis GitHub
    const videoResponse = await fetch(videoUrl);

    if (!videoResponse.ok) {
      return res.status(500).json({
        success: false,
        message: "Impossible de récupérer la vidéo depuis GitHub.",
        status: videoResponse.status
      });
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    const videoData = new Uint8Array(videoBuffer);
    const videoSize = videoData.byteLength;

    // 2. Récupérer le dernier token TikTok
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
        message: "Aucun compte TikTok connecté."
      });
    }

    const token = tokens[0];

    // 3. Initialiser le Direct Post
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
            disable_comment: true,
            disable_duet: true,
            disable_stitch: true,
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

    if (!initResponse.ok || !initData.data?.upload_url) {
      return res.status(initResponse.status).json({
        success: false,
        stage: "direct_post_init",
        tiktok: initData
      });
    }

    const publishId = initData.data.publish_id;
    const uploadUrl = initData.data.upload_url;

    // 4. Envoyer réellement la vidéo à TikTok
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(videoSize),
        "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`
      },
      body: videoData
    });

    const uploadText = await uploadResponse.text();

    if (!uploadResponse.ok) {
      return res.status(uploadResponse.status).json({
        success: false,
        stage: "video_upload",
        publish_id: publishId,
        upload_status: uploadResponse.status,
        upload_response: uploadText
      });
    }

    // 5. Vérifier immédiatement le statut du Direct Post
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

    const statusData = await statusResponse.json();

    return res.status(200).json({
      success: true,
      message: "Vidéo envoyée à TikTok avec succès.",
      video_size: videoSize,
      publish_id: publishId,
      upload_http_status: uploadResponse.status,
      tiktok_status: statusData
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur serveur.",
      error: error.message
    });
  }
}
