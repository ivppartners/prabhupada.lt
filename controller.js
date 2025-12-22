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

const Pool = require("pg").Pool;
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
});

const atnaujinti = asyncHandler(async (req, res) => {
  var item = transformInput(req.body);
  pool.query(
    "UPDATE records SET aprasymas = $1, data = $2, giesme = $3, knyga = $4, metai = $5, pavadinimas = $6, skyrius = $7, tekstas = $8, vieta = $9 WHERE id = $10;",
    [
      item.aprasymas,
      item.data,
      item.giesme,
      item.knyga,
      item.metai,
      item.pavadinimas,
      item.skyrius,
      item.tekstas,
      item.vieta,
      req.params.id,
    ],
    (error, results) => {
      if (error) {
        logger.error(error);
        return res.status(400).send(error);
      }
      logger.info(`Įrašas atnaujintas: ${req.params.id}`);
      res.status(200).send({ message: "Įrašas atnaujintas" });
    }
  );
});

const transformInput = (body) => {
  if (!body.pavadinimas) {
    throw new Error("Įrašykite pavadinimą");
  }
  var item = {};
  item.aprasymas = body.aprasymas;
  item.data = body.data ? new Date(body.data) : null;
  item.giesme = body.giesme ? parseInt(body.giesme) : null;
  item.knyga = body.knyga;
  item.metai = body.metai ? parseInt(body.metai) : null;
  item.pavadinimas = body.pavadinimas;
  item.skyrius = body.skyrius ? parseInt(body.skyrius) : null;
  item.tekstas = body.tekstas ? parseInt(body.tekstas) : null;
  item.vieta = body.vieta;
  return item;
};

const atsisiusti = asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM records WHERE id = $1;", [
    req.params.id,
  ]);
  var record = rows[0];
  if (!record) {
    logger.error(`Nerado tokio įrašo: ${req.params.id}`);
    return res.status(400).send("Nerado tokio įrašo");
  }
  logger.info(`Atsiunčiamas failas: ${record.failo_pavadinimas}`);
  const file = `${process.env.AUDIO_PATH}/${record.failo_pavadinimas}`;
  res.download(file);
});

const gauti = asyncHandler(async (req, res) => {
  pool.query(
    "SELECT * FROM records order by failo_data desc;",
    (error, results) => {
      if (error) {
        logger.error(error);
        return res.status(400).send(error);
      }
      logger.info("Gauti visi įrašai");
      res.status(200).json(results.rows);
    }
  );
});

const gautiViena = asyncHandler(async (req, res) => {
  pool.query(
    "SELECT * FROM records WHERE id = $1;",
    [req.params.id],
    (error, results) => {
      if (error) {
        logger.error(error);
        return res.status(400).send(error);
      }

      if (!results.rows.length) {
        logger.error(`Nerado tokio įrašo: ${req.params.id}`);
        res.status(400).send({ message: "Nerado tokio įrašo" });
      }

      logger.info(`Gautas įrašas: ${req.params.id}`);
      var record = results.rows[0];
      var dataString = record.data ? record.data.toLocaleDateString() : null;
      res.status(200).json({ ...record, dataString: dataString });
    }
  );
});

const groti = asyncHandler(async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM records WHERE id = $1;", [
      req.params.id,
    ]);
    var record = rows[0];
    if (!record) {
      logger.error(`Nerado tokio įrašo: ${req.params.id}`);
      return res.status(400).send({ message: "Nerado tokio įrašo" });
    }
    var filePath = `./audio/${record.failo_pavadinimas}`;

    if (path.extname(filePath)?.toLocaleLowerCase() != ".mp3") {
      logger.error("Neteisingas failo formatas!");
      return res.status(400).send({ message: "Neteisingas failo formatas!" });
    }

    var range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : record.dydis - 1;
      const chunksize = end - start + 1;
      const audioStrem = createReadStream(filePath, { start, end });
      const head = {
        "Content-Range": `bytes ${start}-${end}/${record.dydis}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "video/mp4",
      };
      res.writeHead(206, head);
      audioStrem.pipe(res);
    } else {
      const head = {
        "Content-Length": record.dydis,
        "Content-Type": "video/mp4",
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
  const directoryPath = path.join(__dirname, "audio/");
  try {
    const files = await fs.readdir(directoryPath);
    var records = [];
    for (const file of files) {
      // patikrinam, ar nėra tokio įrašo db.
      var { rows } = await pool.query(
        "SELECT * FROM records WHERE failo_pavadinimas = $1;",
        [file]
      );
      if (rows.length > 0) continue;

      var record = Parser({ originalname: file });
      record.id = randomUUID();

      var stats = await fs.stat(directoryPath + file);
      record.dydis = stats.size;
      record.failo_data = stats.mtime;

      await pool.query(
        "INSERT INTO records (id, pavadinimas, failo_pavadinimas, failo_data, data, metai, vieta, knyga, giesme, skyrius, tekstas, aprasymas, dydis) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);",
        [
          record.id,
          record.pavadinimas,
          record.failo_pavadinimas,
          record.failo_data,
          record.data,
          record.metai,
          record.vieta,
          record.knyga,
          record.giesme,
          record.skyrius,
          record.tekstas,
          record.aprasymas,
          record.dydis,
        ]
      );
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
  pool.query(
    "DELETE FROM records WHERE id = $1",
    [req.params.id],
    (error, results) => {
      if (error) {
        logger.error(error);
        return res.status(400).send(error);
      }
      logger.info(`Įrašas ištrintas: ${req.params.id}`);
      res.status(200).send({ message: "Įrašas ištrintas" });
    }
  );
});

const naikintiViska = asyncHandler(async (req, res) => {
  pool.query("DELETE FROM records", (error, results) => {
    if (error) {
      logger.error(error);
      return res.status(400).send(error);
    }
    logger.info("Visi įrašai ištrinti");
    res.status(200).send({ message: "Visi įrašai ištrinti" });
  });
});

const parse = asyncHandler(async (req, res) => {
  // nuskaitome failo informaciją
  const { rows } = await pool.query("SELECT * FROM records WHERE id = $1;", [
    req.params.id,
  ]);
  var record = rows[0];

  if (!record) {
    res.status(400).send({ message: "Nerado tokio įrašo" });
  }

  const rec = Parser({
    originalname: record.failo_pavadinimas,
  });

  var dataString = rec.data ? rec.data.toLocaleDateString() : null;

  res.status(200).json({ ...record, ...rec, dataString });
});

const parseFilename = asyncHandler(async (req, res) => {
  if (!req.body.failo_pavadinimas) {
    res.status(400).send({ message: "Nėra failo pavadinimo." });
  }

  const rec = Parser({
    originalname: req.body,
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

  pool.query(
    "INSERT INTO records (id, pavadinimas, failo_pavadinimas, failo_data, data, metai, vieta, knyga, giesme, skyrius, tekstas, aprasymas, dydis) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);",
    [
      (id = randomUUID()),
      req.body.pavadinimas,
      req.body.failo_pavadinimas,
      req.body.failo_data,
      req.body.data,
      req.body.metai,
      req.body.vieta,
      req.body.knyga,
      req.body.giesme,
      req.body.skyrius,
      req.body.tekstas,
      req.body.aprasymas,
      req.body.dydis,
    ],
    (error, results) => {
      if (error) {
        logger.error(error);
        return res.status(400).send(error);
      }
      logger.info(`Įrašas sukurtas: ${id}`);
      res.status(200).send({ message: "Įrašas sukurtas" });
    }
  );
});

module.exports = {
  atnaujinti,
  atsisiusti,
  gauti,
  gautiViena,
  groti,
  ikelti,
  importuoti,
  naikinti,
  naikintiViska,
  parse,
  parseFilename,
  sukurti,
};
