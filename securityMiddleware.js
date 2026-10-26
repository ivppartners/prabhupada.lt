const net = require("net");
const logger = require("./logger");

/**
 * Patikrina, ar IP adresas priklauso vietiniam (loopback arba privačiam LAN) tinklui.
 */
function isPrivateOrLocalIp(ipString) {
  if (!ipString || typeof ipString !== "string") return false;

  let ip = ipString.trim();
  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }

  if (ip === "127.0.0.1" || ip === "::1") {
    return true;
  }

  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 127.0.0.0/8
    if (parts[0] === 127) return true;
  }

  // IPv6 Unique Local Addresses (fc00::/7) ir Link-Local (fe80::/10)
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:")) {
      return true;
    }
  }

  return false;
}

/**
 * API specifinės antraštės (bendrąsias saugumo antraštes X-Frame-Options,
 * X-Content-Type-Options ir Referrer-Policy prideda Nginx reverse proxy).
 */
function securityHeaders(req, res, next) {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}

/**
 * Prieigos kontrolės middleware administraciniams maršrutams (Variantas B: tik iš vietinio tinklo / VPN).
 */
function requireLocalNetwork(req, res, next) {
  const clientIp = req.ip || req.socket?.remoteAddress || "";
  if (!isPrivateOrLocalIp(clientIp)) {
    logger.error(
      `Užblokuota neautorizuota administracinė užklausa: ${req.method} ${req.originalUrl} iš IP ${clientIp}`
    );
    return res.status(403).json({
      message: "Prieiga draudžiama. Administraciniai veiksmai leidžiami tik iš vietinio tinklo.",
    });
  }
  next();
}

/**
 * Paprastas atmintyje veikiantis užklausų dažnio ribotuvas (Rate Limiter).
 */
function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 300 } = {}) {
  const hits = new Map();

  // Periodiškas pasenusių įrašų išvalymas
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (now > entry.resetTime) {
        hits.delete(key);
      }
    }
  }, Math.min(windowMs, 60 * 1000));

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - entry.count)));

    if (entry.count > max) {
      logger.error(`Viršytas užklausų limitas (Rate Limit) iš IP: ${key}`);
      return res.status(429).json({
        message: "Per daug užklausų. Bandykite vėliau.",
      });
    }

    next();
  };
}

module.exports = {
  isPrivateOrLocalIp,
  securityHeaders,
  requireLocalNetwork,
  createRateLimiter,
};
