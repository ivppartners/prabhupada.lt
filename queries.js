require("dotenv").config();

const Pool = require("pg").Pool;

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
});

async function gautiVisusIrasus() {
  const { rows } = await pool.query(
    "SELECT * FROM records order by failo_data desc;"
  );
  return rows;
}

async function gautiIrasaPagalId(id) {
  const { rows } = await pool.query("SELECT * FROM records WHERE id = $1;", [
    id,
  ]);
  return rows[0] || null;
}

async function gautiIrasaPagalFailoPavadinima(failoPavadinimas) {
  const { rows } = await pool.query(
    "SELECT * FROM records WHERE failo_pavadinimas = $1;",
    [failoPavadinimas]
  );
  return rows[0] || null;
}

async function iterptiIrasa(record) {
  return pool.query(
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
}

async function atnaujintiIrasa(id, item) {
  return pool.query(
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
      id,
    ]
  );
}

async function istrintiIrasa(id) {
  return pool.query("DELETE FROM records WHERE id = $1", [id]);
}

async function istrintiVisusIrasus() {
  return pool.query("DELETE FROM records");
}

module.exports = {
  gautiVisusIrasus,
  gautiIrasaPagalId,
  gautiIrasaPagalFailoPavadinima,
  iterptiIrasa,
  atnaujintiIrasa,
  istrintiIrasa,
  istrintiVisusIrasus,
};
