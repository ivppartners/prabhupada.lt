require("dotenv").config();

const fs = require("fs");
const multer = require("multer");
const path = require("path");

const DEFAULT_AUDIO_PATH = "audio";
const audioPath = path.resolve(process.env.AUDIO_PATH || DEFAULT_AUDIO_PATH);

const DEFAULT_MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500MB
const maxUploadBytes = Number.parseInt(
  process.env.MAX_UPLOAD_BYTES || String(DEFAULT_MAX_UPLOAD_BYTES),
  10
);

function sanitizeFilename(originalname) {
  const base = path.basename(String(originalname || "")).normalize("NFC");
  const stripped = base.replace(/\0/g, "");
  const safe = stripped.replace(/[^0-9A-Za-zÀ-ž._ -]/g, "_");
  const trimmed = safe.trim().slice(0, 200);
  return trimmed || `upload-${Date.now()}.mp3`;
}

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(audioPath, { recursive: true });
      cb(null, audioPath);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    cb(null, sanitizeFilename(file.originalname));
  },
});

// Create the multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: Number.isFinite(maxUploadBytes)
      ? maxUploadBytes
      : DEFAULT_MAX_UPLOAD_BYTES,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mime = (file.mimetype || "").toLowerCase();
    const isMp3Ext = ext === ".mp3";
    const isMp3Mime = mime === "audio/mpeg" || mime === "audio/mp3";
    if (!isMp3Ext || !isMp3Mime) {
      return cb(new Error("Leidžiami tik MP3 failai."));
    }
    cb(null, true);
  },
});

module.exports = upload;
