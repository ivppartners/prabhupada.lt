require("dotenv").config();
const asyncHandler = require("express-async-handler");
const path = require("path");
const fs = require("fs").promises;
const createReadStream = require("fs").createReadStream;
//const Record = require("./record");
const Parser = require("./parser");
const { randomUUID } = require("crypto");
require("dotenv").config();
const logger = require("./logger");

const queries = require("./queries");

const audioBasePath = path.resolve(process.env.AUDIO_PATH || "audio");

const atnaujinti = asyncHandler(async (req, res) => {
  var item = transformInput(req.body);
  try {
    if (item.data == null) {
      // reikia gauti datą iš failo modifikavimo datos
      const record = await queries.gautiIrasaPagalId(req.params.id);
      if (record) {
        const filePath = path.join(audioBasePath, record.failo_pavadinimas);
        try {
          const stats = await fs.stat(filePath);
          item.data = stats.mtime;
        } catch (error) {
          logger.error(error);
          item.data = null;
        }
      } else {
        item.data = null;
      }
    }
    await queries.atnaujintiIrasa(req.params.id, item);
    logger.info(`Įrašas atnaujintas: ${req.params.id}`);
    res.status(200).send({ message: "Įrašas atnaujintas" });
  } catch (error) {
    logger.error(error);
    return res.status(400).send(error);
  }
});

const transformInput = (body) => {
  if (!body.pavadinimas) {
    throw new Error("Įrašykite pavadinimą");
  }
  var item = {};
  item.aprasymas = body.aprasymas;
  item.data = body.data ? new Date(body.data) : null;
  item.failo_data = body.failo_data ? new Date(body.failo_data) : null;
  item.giesme = body.giesme ? parseInt(body.giesme) : null;
  item.knyga = body.knyga;
  item.metai = body.metai ? parseInt(body.metai) : null;
  item.pavadinimas = body.pavadinimas;
  item.published = body.published;
  item.skyrius = body.skyrius ? parseInt(body.skyrius) : null;
  item.tekstas = body.tekstas ? parseInt(body.tekstas) : null;
  item.vieta = body.vieta;
  return item;
};

const atsisiusti = asyncHandler(async (req, res) => {
  var record = await queries.gautiIrasaPagalId(req.params.id);
  if (!record) {
    logger.error(`Nerado tokio įrašo: ${req.params.id}`);
    return res.status(400).send("Nerado tokio įrašo");
  }
  logger.info(`Atsiunčiamas failas: ${record.failo_pavadinimas}`);
  const file = path.join(audioBasePath, record.failo_pavadinimas);
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
    return res.status(400).send(error);
  }
});

const gautiPublikuotus = asyncHandler(async (req, res) => {
  try {
    const rows = await queries.gautiPublikuotusIrasus();
    logger.info("Gauti visi įrašai");
    res.status(200).json(rows);
  } catch (error) {
    logger.error(error);
    return res.status(400).send(error);
  }
});

const getKrishnaBookAllChapters = asyncHandler(async (req, res) => {
  try {
    const rows = await queries.getKrishnaBookAllChapters();
    logger.info("Gauti visi įrašai");
    res.status(200).json(rows);
  } catch (error) {
    logger.error(error);
    return res.status(400).send(error);
  }
});

const getPrabhupadaBookAllChapters = asyncHandler(async (req, res) => {
  try {
    const rows = await queries.getPrabhupadaBookAllChapters();
    logger.info("Gauti visi įrašai");
    res.status(200).json(rows);
  } catch (error) {
    logger.error(error);
    return res.status(400).send(error);
  }
});

const gautiViena = asyncHandler(async (req, res) => {
  try {
    const record = await queries.gautiIrasaPagalId(req.params.id);
    if (!record) {
      logger.error(`Nerado tokio įrašo: ${req.params.id}`);
      return res.status(400).send({ message: "Nerado tokio įrašo" });
    }

    logger.info(`Gautas įrašas: ${req.params.id}`);
    var dataString = record.data ? toLocalIsoString(record.data).slice(0, 10) : null;
    var failo_dataString = record.failo_data ? toLocalIsoString(record.failo_data).slice(0, 10) : null;
    res.status(200).json({ ...record, data: dataString, failo_data: failo_dataString });
  } catch (error) {
    logger.error(error);
    return res.status(400).send(error);
  }
});

const groti = asyncHandler(async (req, res) => {
  try {
    var record = await queries.gautiIrasaPagalId(req.params.id);
    if (!record) {
      logger.error(`Nerado tokio įrašo: ${req.params.id}`);
      return res.status(400).send({ message: "Nerado tokio įrašo" });
    }
    var filePath = path.join(audioBasePath, record.failo_pavadinimas);

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

    // reikia išsaugoti logo lentelėje įrašą apie atidarytą grojimui failą.

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await queries.irasytiLogoIrasa(record.id, ip);

    var range = req.headers.range;

    if (range) {
      const parts = String(range).replace(/bytes=/, "").split("-");
      const start = Number.parseInt(parts[0], 10);
      const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;

      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
        return res.status(416).send({ message: "Neteisingas Range" });
      }
      if (start >= fileSize) {
        res.setHeader("Content-Range", `bytes */${fileSize}`);
        return res.status(416).send({ message: "Range už ribų" });
      }

      const safeEnd = Math.min(end, fileSize - 1);
      const chunksize = safeEnd - start + 1;
      const audioStrem = createReadStream(filePath, { start, end: safeEnd });
      const head = {
        "Content-Range": `bytes ${start}-${safeEnd}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "audio/mpeg",
      };
      res.writeHead(206, head);
      audioStrem.pipe(res);
    } else {
      const head = {
        "Content-Length": fileSize,
        "Content-Type": "audio/mpeg",
      };
      res.writeHead(200, head);
      createReadStream(filePath).pipe(res);
    }
    logger.info(`Grojamas failas: ${record.failo_pavadinimas}`);
  } catch (error) {
    logger.error(error);
    res.status(400).send({ message: "Klaida grojant failą" });
  }
});

const ikelti = (req, res) => {
  // nuskaitome failo informaciją
  if (!req.file) {
    logger.error("Nėra failo, kurį reikėtų išsaugoti.");
    return res
      .status(400)
      .send({ message: "Nėra failo, kurį reikėtų išsaugoti." });
  }

  const record = Parser({ originalname: req.file.originalname });
  if (!record) {
    logger.error("Nepavyko nuskaityti failo informacijos");
    return res
      .status(400)
      .send({ message: "Nepavyko nuskaityti failo informacijos" });
  }

  var dataString = record.data ? record.data.toLocaleDateString() : null;
  var dydis = req.file.size;
  var failo_data = new Date().toLocaleDateString();
  if (record.data) {
    dataString = record.data.toLocaleDateString();
  }
  logger.info(`Įkeltas failas: ${record.failo_pavadinimas}`);
  res.status(200).json({ ...record, dataString, failo_data, dydis });
};

const importuoti = asyncHandler(async (req, res) => {
  const directoryPath = audioBasePath;
  try {
    const files = await fs.readdir(directoryPath);
    var records = [];
    for (const file of files) {
      if (path.extname(file).toLowerCase() !== ".mp3") continue;

      // patikrinam, ar nėra tokio įrašo db.
      const existing = await queries.gautiIrasaPagalFailoPavadinima(file);
      if (existing) continue;

      var record = Parser({ originalname: file });
      record.id = randomUUID();

      var stats = await fs.stat(path.join(directoryPath, file));
      record.dydis = stats.size;
      record.failo_data = stats.mtime;

      await queries.iterptiIrasa(record);
      records.push(record);
      logger.info(`Importuotas failas: ${record.failo_pavadinimas}`);
    }
    res.status(200).json(records);
  } catch (error) {
    logger.error(error);
    return res.status(400).send(error);
  }
});

const naikinti = asyncHandler(async (req, res) => {
  try {
    await queries.istrintiIrasa(req.params.id);
    logger.info(`Įrašas ištrintas: ${req.params.id}`);
    res.status(200).send({ message: "Įrašas ištrintas" });
  } catch (error) {
    logger.error(error);
    return res.status(400).send(error);
  }
});

const naikintiViska = asyncHandler(async (req, res) => {
  try {
    await queries.istrintiVisusIrasus();
    logger.info("Visi įrašai ištrinti");
    res.status(200).send({ message: "Visi įrašai ištrinti" });
  } catch (error) {
    logger.error(error);
    return res.status(400).send(error);
  }
});

const parse = asyncHandler(async (req, res) => {
  // nuskaitome failo informaciją
  var record = await queries.gautiIrasaPagalId(req.params.id);

  if (!record) {
    return res.status(400).send({ message: "Nerado tokio įrašo" });
  }

  const rec = Parser({
    originalname: record.failo_pavadinimas,
  });

  var dataString = rec.data ? rec.data.toLocaleDateString() : null;

  res.status(200).json({ ...record, ...rec, dataString });
});

const parseFilename = asyncHandler(async (req, res) => {
  if (!req.body.failo_pavadinimas) {
    return res.status(400).send({ message: "Nėra failo pavadinimo." });
  }

  const rec = Parser({
    originalname: req.body.failo_pavadinimas,
  });

  var dataString = rec.data ? rec.data.toLocaleDateString() : null;

  res.status(200).json({ ...rec, dataString });
});

const sukurti = asyncHandler(async (req, res) => {
  if (!req.body.pavadinimas) {
    logger.error("Neįrašytas pavadinimas");
    return res.status(400).send({ message: "Įrašykite pavadinimą" });
  }
  if (!req.body.failo_pavadinimas) {
    logger.error("Neįkeltas failas");
    return res.status(400).send({ message: "Įkelkite failą" });
  }


  try {
    const id = randomUUID();
    await queries.iterptiIrasa({
      id,
      pavadinimas: req.body.pavadinimas,
      failo_pavadinimas: req.body.failo_pavadinimas,
      failo_data: req.body.failo_data ? new Date(req.body.failo_data) : new Date(),
      data: req.body.data ? new Date(req.body.data) : null,
      metai: req.body.metai,
      vieta: req.body.vieta,
      knyga: req.body.knyga,
      giesme: req.body.giesme,
      skyrius: req.body.skyrius,
      tekstas: req.body.tekstas,
      aprasymas: req.body.aprasymas,
      dydis: req.body.dydis,
      published: req.body.published || false,
    });

    logger.info(`Įrašas sukurtas: ${id}`);
    res.status(200).send({ message: "Įrašas sukurtas" });
  } catch (error) {
    logger.error(error);
    return res.status(400).send(error);
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
  naikintiViska,
  parse,
  parseFilename,
  sukurti,
};
