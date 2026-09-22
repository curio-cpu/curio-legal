export default function handler(req, res) {
  const clientKey = (process.env.TIKTOK_CLIENT_KEY || "").trim();

  return res.status(200).json({
    clientKeyPresent: !!clientKey,
    clientKeyLength: clientKey.length,
    clientKeyLast4: clientKey.slice(-4),
    clientSecretPresent: !!process.env.TIKTOK_CLIENT_SECRET,
    redirectUri: "https://curio-six-jet.vercel.app/api/callback"
  });
}
