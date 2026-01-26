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
    "SELECT id, pavadinimas, failo_pavadinimas, to_char(failo_data, 'YYYY-MM-DD') as failo_data, to_char(data, 'YYYY-MM-DD') as data, metai, vieta, knyga, giesme, skyrius, tekstas, aprasymas, dydis FROM records order by failo_data desc;"
  );
  return rows;
}

async function gautiPublikuotusIrasus() {
  const { rows } = await pool.query(
    "SELECT id, pavadinimas, failo_pavadinimas, to_char(failo_data, 'YYYY-MM-DD') as failo_data, to_char(data, 'YYYY-MM-DD') as data, metai, vieta, knyga, giesme, skyrius, tekstas, aprasymas, dydis FROM records where data is not null and published = true order by failo_data desc;"
  );
  return rows;
}

async function getKrishnaBookAllChapters() {
  const { rows } = await pool.query(
    "SELECT id, pavadinimas, failo_pavadinimas, to_char(failo_data, 'YYYY-MM-DD') as failo_data, to_char(data, 'YYYY-MM-DD') as data, metai, vieta, knyga, giesme, skyrius, tekstas, aprasymas, dydis FROM records where knyga = 'Krishna' and data is null order by pavadinimas;"
  );
  return rows;
}

async function getPrabhupadaBookAllChapters() {
  const { rows } = await pool.query(
    "SELECT id, pavadinimas, failo_pavadinimas, to_char(failo_data, 'YYYY-MM-DD') as failo_data, to_char(data, 'YYYY-MM-DD') as data, metai, vieta, knyga, giesme, skyrius, tekstas, aprasymas, dydis FROM records where knyga = 'Prabhupada' and data is null order by pavadinimas;"
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

async function irasytiLogoIrasa(recordId, ip) {
  return pool.query(
    "INSERT INTO logs (record_id, timestamp, ip) VALUES ($1, NOW(), $2);",
    [recordId, ip]
  );
}

async function iterptiIrasa(record) {
  return pool.query(
    "INSERT INTO records (id, pavadinimas, failo_pavadinimas, failo_data, data, metai, vieta, knyga, giesme, skyrius, tekstas, aprasymas, dydis, published) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);",
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
      record.published || false,
    ]
  );
}

async function atnaujintiIrasa(id, item) {
  return pool.query(
    "UPDATE records SET aprasymas = $1, data = $2, giesme = $3, knyga = $4, metai = $5, pavadinimas = $6, skyrius = $7, tekstas = $8, vieta = $9, published = $10 WHERE id = $11;",
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
      item.published,
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

async function gautiVisusFailoPavadinimus() {
  const { rows } = await pool.query("SELECT failo_pavadinimas FROM records");
  return rows.map((row) => row.failo_pavadinimas);
}

module.exports = {
  gautiVisusIrasus,
  gautiPublikuotusIrasus,
  gautiIrasaPagalId,
  gautiIrasaPagalFailoPavadinima,
  getKrishnaBookAllChapters,
  getPrabhupadaBookAllChapters,
  irasytiLogoIrasa,
  iterptiIrasa,
  atnaujintiIrasa,
  istrintiIrasa,
  istrintiVisusIrasus,
  gautiVisusFailoPavadinimus,
};
