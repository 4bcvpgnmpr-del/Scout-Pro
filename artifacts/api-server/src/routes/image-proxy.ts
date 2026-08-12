import { Router } from "express";

/**
 * GET /api/image-proxy?url=<encoded-url>
 *
 * Server-side proxy for external images (e.g. imagenes.feb.es).
 * The browser can't fetch them directly due to CORS, but the server can.
 */
const router = Router();

router.get("/image-proxy", async (req, res) => {
  const { url } = req.query as { url?: string };
  if (!url) { res.status(400).json({ error: "url is required" }); return; }

  let decoded: string;
  try {
    decoded = decodeURIComponent(url);
    if (!/^https?:\/\//i.test(decoded)) {
      res.status(400).json({ error: "invalid url" }); return;
    }
  } catch {
    res.status(400).json({ error: "invalid url encoding" }); return;
  }

  try {
    const upstream = await fetch(decoded, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ScoutPro/1.0)",
        "Accept": "image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: "upstream error" }); return;
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch (err) {
    console.warn("image-proxy fetch failed", { err, url: decoded });
    res.status(502).json({ error: "failed to fetch upstream image" });
  }
});

export default router;
