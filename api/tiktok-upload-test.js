export default async function handler(req, res) {
  try {
    // --------------------------------------------------
    // 1. Récupérer le token TikTok depuis Supabase
    // --------------------------------------------------

    const supabaseResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/tiktok_tokens?select=*`,
      {
        headers: {
          apikey: process.env.SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`
        }
      }
    );

    if (!supabaseResponse.ok) {
      return res.status(500).json({
        success: false,
        step: "supabase",
        message: "Impossible de lire le token TikTok"
      });
    }

    const tokens = await supabaseResponse.json();

    if (!tokens.length || !tokens[0].access_token) {
      return res.status(404).json({
        success: false,
        step: "token",
        message: "Aucun token TikTok disponible. Reconnecte TikTok."
      });
    }

    const accessToken = tokens[0].access_token;

    // --------------------------------------------------
    // 2. Télécharger la vidéo depuis GitHub
    //    (TikTok ne voit PAS cette URL)
    // --------------------------------------------------

    const videoUrl =
      "https://raw.githubusercontent.com/curio-cpu/curio-legal/main/2026-09-22-173225235.mp4";

    const videoResponse = await fetch(videoUrl);

    if (!videoResponse.ok) {
      return res.status(500).json({
        success: false,
        step: "video_download",
        message: "Impossible de télécharger la vidéo depuis GitHub",
        status: videoResponse.status
      });
    }

    const videoBuffer = Buffer.from(
      await videoResponse.arrayBuffer()
    );

    const videoSize = videoBuffer.length;

    // --------------------------------------------------
    // 3. Configuration des morceaux
    // --------------------------------------------------

    const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB
    const totalChunkCount = Math.ceil(videoSize / CHUNK_SIZE);

    // --------------------------------------------------
    // 4. Initialiser le Direct Post TikTok
    // --------------------------------------------------

    const initResponse = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8"
        },
        body: JSON.stringify({
          post_info: {
            title: "Les premières balles de golf sur la Lune #Curio",
            privacy_level: "SELF_ONLY",
            disable_duet: true,
            disable_comment: false,
            disable_stitch: true,
            is_aigc: true
          },
          source_info: {
            source: "FILE_UPLOAD",
            video_size: videoSize,
            chunk_size: CHUNK_SIZE,
            total_chunk_count: totalChunkCount
          }
        })
      }
    );

    const initData = await initResponse.json();

    if (!initResponse.ok || initData.error?.code !== "ok") {
      return res.status(initResponse.status || 400).json({
        success: false,
        step: "tiktok_init",
        tiktok: initData
      });
    }

    const publishId = initData.data.publish_id;
    const uploadUrl = initData.data.upload_url;

    // --------------------------------------------------
    // 5. Envoyer chaque morceau à TikTok
    // --------------------------------------------------

    for (let i = 0; i < totalChunkCount; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, videoSize);
      const chunk = videoBuffer.subarray(start, end);

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(chunk.length),
          "Content-Range": `bytes ${start}-${end - 1}/${videoSize}`
        },
        body: chunk
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();

        return res.status(uploadResponse.status).json({
          success: false,
          step: "tiktok_upload",
          chunk: i + 1,
          total_chunks: totalChunkCount,
          error: errorText
        });
      }
    }

    // --------------------------------------------------
    // 6. Succès
    // --------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Vidéo envoyée à TikTok avec succès",
      publish_id: publishId,
      video_size: videoSize,
      total_chunks: totalChunkCount,
      privacy: "SELF_ONLY"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      step: "server",
      message: error.message
    });
  }
}
