# Copilot instrukcijos (prabhupada.lt)

## Kas tai
- Minimalus Node.js/Express (CommonJS) API MP3 paskaitų metaduomenims (PostgreSQL `records`) ir failų pateikimui.

## Darbas lokaliai
- `npm install`
- Dev: `npm run server` (nodemon)
- Prod: `npm start`
- Portas hardcoded: `4001` faile [server.js](../server.js)
- Testų nėra (scriptas `test` tik grąžina klaidą)

## Architektūra (srautas)
- [server.js](../server.js) montuoja `/api` → [routes.js](../routes.js) → handler’iai [controller.js](../controller.js)
- Klaidos: globalus JSON handler’is [errorMiddleware.js](../errorMiddleware.js) (grąžina `{ message, stack }`)
- DB sluoksnis: VISAS SQL ir `pg` `Pool` yra [queries.js](../queries.js). Kontroleriuose SQL nerašyti.
- Failo pavadinimo metainfo: [parser.js](../parser.js) (tikisi datos `YYYYMMDD` ir ištraukia `knyga/giesme/skyrius/tekstas/vieta`)
- Upload: [upload.js](../upload.js) (multer) saugo į `${AUDIO_PATH}`; failo vardas sanitizuojamas ir leidžiami tik MP3
- Log’ai: [logger.js](../logger.js) (winston + daily rotate į `./logs/`)

## Konfigūracija (ENV)
- Reikalinga: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST`, `AUDIO_PATH`
- `AUDIO_PATH` gali būti mountintas katalogas (volume) — tikrink egzistavimą ir R/W teises.
- Pavyzdys: [.env.example](../.env.example) (nekomituoti realių `.env` sekretų)

## API (bazė: `/api`)
- CRUD: `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `DELETE /naikintiViska`
- Failai: `POST /upload` (field: `audio`), `GET /download/:id`, `GET /play/:id` (Range stream)
- Parser: `GET /parse/:id`, `POST /parseFilename`

## Projekto konvencijos
- Domeno kalba: lietuviški handler’iai (`gauti`, `ikelti`, `naikintiViska` ir pan.) — laikykis šios nomenklatūros.
- Validacijos klaidos dažniausiai `400` su `{ message: ... }`.
