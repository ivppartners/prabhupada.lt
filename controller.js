require("dotenv").config();
const asyncHandler = require("express-async-handler");
const path = require("path");
const fs = require("fs").promises;
const createReadStream = require("fs").createReadStream;
const Parser = require("./parser");
const { randomUUID } = require("crypto");
const logger = require("./logger");
const queries = require("./queries");
const { isPrivateOrLocalIp } = require("./securityMiddleware");

const audioBasePath = path.resolve(process.env.AUDIO_PATH || "audio");
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidUuid = (id) => typeof id === "string" && UUID_REGEX.test(id);

const sanitizeLog = (val) => String(val ?? "").replace(/[\r\n]/g, " ").slice(0, 300);

const resolveSafePath = (filename) => {
  if (!filename || typeof filename !== "string") return null;
  const safeFilename = path.basename(filename);
  const resolvedPath = path.resolve(audioBasePath, safeFilename);
  if (!resolvedPath.startsWith(audioBasePath + path.sep)) {
    return null;
  }
  return resolvedPath;
};

/**
 * Patikrina pirmuosius failo baitus (MP3 magic bytes: "ID3" žyma arba MPEG audio frame sync 0xFF 0xE0).
 */
const isValidMp3File = async (filePath) => {
  let fileHandle;
  try {
    fileHandle = await fs.open(filePath, "r");
    const buffer = Buffer.alloc(4);
    const { bytesRead } = await fileHandle.read(buffer, 0, 4, 0);
    if (bytesRead < 3) return false;

    // "ID3" žyma (0x49 0x44 0x33)
    if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
      return true;
    }
    // MPEG Audio Frame Sync (11 vienetų: 0xFF ir (byte1 & 0xE0) === 0xE0)
    if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
};

const toIntOrNull = (val) => {
  if (val === undefined || val === null || val === "") return null;
  const parsed = Number.parseInt(val, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const toDateOrNull = (val) => {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
};

const transformInput = (body) => {
  if (!body || typeof body.pavadinimas !== "string" || !body.pavadinimas.trim()) {
    throw new Error("Įrašykite pavadinimą");
  }
  return {
    aprasymas: body.aprasymas ? String(body.aprasymas).slice(0, 5000) : null,
    data: toDateOrNull(body.data),
    failo_data: toDateOrNull(body.failo_data),
    giesme: toIntOrNull(body.giesme),
    knyga: body.knyga ? String(body.knyga).slice(0, 200) : null,
    metai: toIntOrNull(body.metai),
    pavadinimas: String(body.pavadinimas).trim().slice(0, 300),
    published: Boolean(body.published),
    skyrius: toIntOrNull(body.skyrius),
    tekstas: toIntOrNull(body.tekstas),
    vieta: body.vieta ? String(body.vieta).slice(0, 200) : null,
  };
};

const atnaujinti = asyncHandler(async (req, res) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).send({ message: "Neteisingas įrašo ID formatas" });
  }
  const item = transformInput(req.body);
  try {
    await queries.atnaujintiIrasa(req.params.id, item);
    logger.info(`Įrašas atnaujintas: ${sanitizeLog(req.params.id)} (IP: ${sanitizeLog(req.ip)})`);
    res.status(200).send({ message: "Įrašas atnaujintas" });
  } catch (error) {
    logger.error(error);
    return res.status(400).send({ message: "Nepavyko atnaujinti įrašo" });
  }
});

const atsisiusti = asyncHandler(async (req, res) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).send({ message: "Neteisingas įrašo ID formatas" });
  }
  const record = await queries.gautiIrasaPagalId(req.params.id);
  if (!record) {
    logger.error(`Nerado tokio įrašo: ${sanitizeLog(req.params.id)}`);
    return res.status(404).send({ message: "Nerado tokio įrašo" });
  }

  // Nepublikuoti paskaitų įrašai pasiekiami tik iš vietinio administravimo tinklo
  if (!record.published && record.data !== null && !isPrivateOrLocalIp(req.ip)) {
    return res.status(403).send({ message: "Įrašas nėra publikuotas" });
  }

  const file = resolveSafePath(record.failo_pavadinimas);
  if (!file) {
    logger.error(`Neteisingas failo kelias: ${sanitizeLog(record.failo_pavadinimas)}`);
    return res.status(400).send({ message: "Neteisingas failo kelias" });
  }

  logger.info(`Atsiunčiamas failas: ${sanitizeLog(record.failo_pavadinimas)}`);
  try {
    await fs.access(file);
  } catch (error) {
    logger.error(error);
    return res.status(404).send({ message: "Failas nerastas" });
  }
  res.download(file);
});

const gauti = asyncHandler(async (req, res) => {
  try {
    const rows = await queries.gautiVisusIrasus();
    logger.info("Gauti visi įrašai");
    res.status(200).json(rows);
  } catch (error) {
    logger.error(error);
    return res.status(500).send({ message: "Nepavyko gauti įrašų" });
  }
});

const gautiPublikuotus = asyncHandler(async (req, res) => {
  try {
    const rows = await queries.gautiPublikuotusIrasus();
    logger.info("Gauti publikuoti įrašai");
    res.status(200).json(rows);
  } catch (error) {
    logger.error(error);
    return res.status(500).send({ message: "Nepavyko gauti įrašų" });
  }
});

const getKrishnaBookAllChapters = asyncHandler(async (req, res) => {
  try {
    const rows = await queries.getKrishnaBookAllChapters();
    logger.info("Gauti Krišnos knygos įrašai");
    res.status(200).json(rows);
  } catch (error) {
    logger.error(error);
    return res.status(500).send({ message: "Nepavyko gauti įrašų" });
  }
});

const getPrabhupadaBookAllChapters = asyncHandler(async (req, res) => {
  try {
    const rows = await queries.getPrabhupadaBookAllChapters();
    logger.info("Gauti Prabhupados knygos įrašai");
    res.status(200).json(rows);
  } catch (error) {
    logger.error(error);
    return res.status(500).send({ message: "Nepavyko gauti įrašų" });
  }
});

const gautiViena = asyncHandler(async (req, res) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).send({ message: "Neteisingas įrašo ID formatas" });
  }
  try {
    const record = await queries.gautiIrasaPagalId(req.params.id);
    if (!record) {
      logger.error(`Nerado tokio įrašo: ${sanitizeLog(req.params.id)}`);
      return res.status(404).send({ message: "Nerado tokio įrašo" });
    }

    logger.info(`Gautas įrašas: ${sanitizeLog(req.params.id)}`);
    var dataString = record.data ? toLocalIsoString(record.data).slice(0, 10) : null;
    var failo_dataString = record.failo_data ? toLocalIsoString(record.failo_data).slice(0, 10) : null;
    res.status(200).json({ ...record, data: dataString, failo_data: failo_dataString });
  } catch (error) {
    logger.error(error);
    return res.status(500).send({ message: "Nepavyko gauti įrašo" });
  }
});

const groti = asyncHandler(async (req, res) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).send({ message: "Neteisingas įrašo ID formatas" });
  }
  try {
    var record = await queries.gautiIrasaPagalId(req.params.id);
    if (!record) {
      logger.error(`Nerado tokio įrašo: ${sanitizeLog(req.params.id)}`);
      return res.status(404).send({ message: "Nerado tokio įrašo" });
    }

    // Nepublikuoti paskaitų įrašai pasiekiami tik iš vietinio administravimo tinklo
    if (!record.published && record.data !== null && !isPrivateOrLocalIp(req.ip)) {
      return res.status(403).send({ message: "Įrašas nėra publikuotas" });
    }

    var filePath = resolveSafePath(record.failo_pavadinimas);
    if (!filePath) {
      logger.error(`Neteisingas failo kelias: ${sanitizeLog(record.failo_pavadinimas)}`);
      return res.status(400).send({ message: "Neteisingas failo kelias" });
    }

    let fileSize;
    try {
      const stats = await fs.stat(filePath);
      fileSize = stats.size;
    } catch (error) {
      logger.error(error);
      return res.status(404).send({ message: "Failas nerastas" });
    }

    if (path.extname(filePath)?.toLocaleLowerCase() != ".mp3") {
      logger.error("Neteisingas failo formatas!");
      return res.status(400).send({ message: "Neteisingas failo formatas!" });
    }

    var range = req.headers.range;
    const ip = sanitizeLog(req.ip || req.socket?.remoteAddress || "");

    if (range) {
      const parts = String(range).replace(/bytes=/, "").split("-");
      let start = parts[0] ? Number.parseInt(parts[0], 10) : 0;
      let end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;

      if (parts[0] === "" && parts[1]) {
        const suffixLength = Number.parseInt(parts[1], 10);
        if (Number.isFinite(suffixLength)) {
          start = Math.max(0, fileSize - suffixLength);
          end = fileSize - 1;
        }
      }

      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
        return res.status(416).send({ message: "Neteisingas Range" });
      }
      if (start >= fileSize) {
        res.setHeader("Content-Range", `bytes */${fileSize}`);
        return res.status(416).send({ message: "Range už ribų" });
      }

      // Įrašome į logs lentelę tik kai pradedama groti nuo pradžios (start === 0)
      if (start === 0) {
        queries.irasytiLogoIrasa(record.id, ip).catch((err) => logger.error(`Log error: ${err}`));
      }

      const safeEnd = Math.min(end, fileSize - 1);
      const chunksize = safeEnd - start + 1;
      const audioStream = createReadStream(filePath, { start, end: safeEnd });
      const head = {
        "Content-Range": `bytes ${start}-${safeEnd}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "audio/mpeg",
      };
      res.writeHead(206, head);
      audioStream.pipe(res);
      res.on("close", () => {
        audioStream.destroy();
      });
    } else {
      queries.irasytiLogoIrasa(record.id, ip).catch((err) => logger.error(`Log error: ${err}`));
      const head = {
        "Accept-Ranges": "bytes",
        "Content-Length": fileSize,
        "Content-Type": "audio/mpeg",
      };
      res.writeHead(200, head);
      const audioStream = createReadStream(filePath);
      audioStream.pipe(res);
      res.on("close", () => {
        audioStream.destroy();
      });
    }
    logger.info(`Grojamas failas: ${sanitizeLog(record.failo_pavadinimas)}`);
  } catch (error) {
    logger.error(error);
    res.status(400).send({ message: "Klaida grojant failą" });
  }
});

const ikelti = asyncHandler(async (req, res) => {
  if (!req.file) {
    logger.error("Nėra failo, kurį reikėtų išsaugoti.");
    return res
      .status(400)
      .send({ message: "Nėra failo, kurį reikėtų išsaugoti." });
  }

  // Patikriname tikruosius MP3 failo antraštės baitus (magic bytes)
  const isMp3 = await isValidMp3File(req.file.path);
  if (!isMp3) {
    await fs.unlink(req.file.path).catch(() => {});
    logger.error(`Atmestas netikras MP3 failas: ${sanitizeLog(req.file.filename)} (IP: ${sanitizeLog(req.ip)})`);
    return res.status(400).send({ message: "Įkeltas failas nėra galiojantis MP3 garso įrašas." });
  }

  const record = Parser({ originalname: req.file.filename });
  if (!record) {
    logger.error("Nepavyko nuskaityti failo informacijos");
    return res
      .status(400)
      .send({ message: "Nepavyko nuskaityti failo informacijos" });
  }

  var dataString = record.data ? record.data.toLocaleDateString() : null;
  var dydis = req.file.size;
  var failo_data = new Date().toLocaleDateString();
  logger.info(`Įkeltas failas: ${sanitizeLog(record.failo_pavadinimas)} (IP: ${sanitizeLog(req.ip)})`);
  res.status(200).json({ ...record, dataString, failo_data, dydis });
});

const importuoti = asyncHandler(async (req, res) => {
  const directoryPath = audioBasePath;
  try {
    const files = await fs.readdir(directoryPath);
    const existingFilenames = new Set(await queries.gautiVisusFailoPavadinimus());

    const newFiles = files.filter(
      (file) => path.extname(file).toLowerCase() === ".mp3" && !existingFilenames.has(file)
    );

    const records = await Promise.all(
      newFiles.map(async (file) => {
        const record = Parser({ originalname: file });
        record.id = randomUUID();

        const stats = await fs.stat(path.join(directoryPath, file));
        record.dydis = stats.size;
        record.failo_data = stats.mtime;

        await queries.iterptiIrasa(record);
        logger.info(`Importuotas failas: ${sanitizeLog(record.failo_pavadinimas)}`);
        return record;
      })
    );

    res.status(200).json(records);
  } catch (error) {
    logger.error(error);
    return res.status(400).send({ message: "Klaida importuojant failus" });
  }
});

const naikinti = asyncHandler(async (req, res) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).send({ message: "Neteisingas įrašo ID formatas" });
  }
  try {
    await queries.istrintiIrasa(req.params.id);
    logger.info(`Įrašas ištrintas: ${sanitizeLog(req.params.id)} (IP: ${sanitizeLog(req.ip)})`);
    res.status(200).send({ message: "Įrašas ištrintas" });
  } catch (error) {
    logger.error(error);
    return res.status(400).send({ message: "Nepavyko ištrinti įrašo" });
  }
});

const parse = asyncHandler(async (req, res) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).send({ message: "Neteisingas įrašo ID formatas" });
  }
  var record = await queries.gautiIrasaPagalId(req.params.id);

  if (!record) {
    return res.status(404).send({ message: "Nerado tokio įrašo" });
  }

  const rec = Parser({
    originalname: record.failo_pavadinimas,
  });

  var dataString = rec.data ? rec.data.toLocaleDateString() : null;

  res.status(200).json({ ...record, ...rec, dataString });
});

const parseFilename = asyncHandler(async (req, res) => {
  if (!req.body.failo_pavadinimas || typeof req.body.failo_pavadinimas !== "string") {
    return res.status(400).send({ message: "Nėra failo pavadinimo." });
  }

  const rec = Parser({
    originalname: path.basename(req.body.failo_pavadinimas),
  });

  var dataString = rec.data ? rec.data.toLocaleDateString() : null;

  res.status(200).json({ ...rec, dataString });
});

const sukurti = asyncHandler(async (req, res) => {
  if (!req.body.pavadinimas) {
    logger.error("Neįrašytas pavadinimas");
    return res.status(400).send({ message: "Įrašykite pavadinimą" });
  }
  if (!req.body.failo_pavadinimas || typeof req.body.failo_pavadinimas !== "string") {
    logger.error("Neįkeltas failas");
    return res.status(400).send({ message: "Įkelkite failą" });
  }

  const safePath = resolveSafePath(req.body.failo_pavadinimas);
  if (!safePath) {
    return res.status(400).send({ message: "Neteisingas failo pavadinimas" });
  }

  const item = transformInput(req.body);

  try {
    const id = randomUUID();
    await queries.iterptiIrasa({
      id,
      pavadinimas: item.pavadinimas,
      failo_pavadinimas: path.basename(req.body.failo_pavadinimas),
      failo_data: item.failo_data || new Date(),
      data: item.data,
      metai: item.metai,
      vieta: item.vieta,
      knyga: item.knyga,
      giesme: item.giesme,
      skyrius: item.skyrius,
      tekstas: item.tekstas,
      aprasymas: item.aprasymas,
      dydis: toIntOrNull(req.body.dydis),
      published: item.published,
    });

    logger.info(`Įrašas sukurtas: ${id} (IP: ${sanitizeLog(req.ip)})`);
    res.status(200).send({ message: "Įrašas sukurtas" });
  } catch (error) {
    logger.error(error);
    return res.status(400).send({ message: "Nepavyko sukurti įrašo" });
  }
});

const toLocalIsoString = (date) => {
  const tzo = -date.getTimezoneOffset(),
    dif = tzo >= 0 ? "+" : "-",
    pad = function (num) {
      return (num < 10 ? "0" : "") + num;
    };

  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes()) +
    ":" +
    pad(date.getSeconds()) +
    dif +
    pad(Math.floor(Math.abs(tzo) / 60)) +
    ":" +
    pad(Math.abs(tzo) % 60)
  );
};

module.exports = {
  atnaujinti,
  atsisiusti,
  gauti,
  gautiPublikuotus,
  gautiViena,
  getKrishnaBookAllChapters,
  getPrabhupadaBookAllChapters,
  groti,
  ikelti,
  importuoti,
  naikinti,
  parse,
  parseFilename,
  sukurti,
};
