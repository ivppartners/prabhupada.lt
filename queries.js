const e = require("express");

const Pool = require("pg").Pool;
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
});

async function insertRecord(record) {
  let result;
    result = await pool.query(
      "INSERT INTO records (id, pavadinimas, failo_pavadinimas, failo_data, data, metai, vieta, knyga, giesme, skyrius, tekstas, aprasymas, dydis) VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), $5, $6, $7, $8, $9, $10, $11, $12, $13);",
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
    return result;
}

exports.insertRecord = insertRecord;
