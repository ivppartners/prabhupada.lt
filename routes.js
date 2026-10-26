const express = require('express');
const upload = require('./upload');
const { requireLocalNetwork } = require('./securityMiddleware');
const { atnaujinti, atsisiusti, gauti, gautiPublikuotus, gautiViena, getKrishnaBookAllChapters, getPrabhupadaBookAllChapters, groti, ikelti, importuoti, naikinti, sukurti, parse, parseFilename } = require('./controller.js');

const router = express.Router();

// Vieši maršrutai
router.route('/download/:id').get(atsisiusti);
router.route('/published').get(gautiPublikuotus);
router.route('/krishna').get(getKrishnaBookAllChapters);
router.route('/prabhupada').post(getPrabhupadaBookAllChapters);
router.route('/play/:id').get(groti);

// Administraciniai maršrutai (pasiekiami tik iš vietinio tinklo / VPN)
router.route('/create').post(requireLocalNetwork, sukurti);
router.route('/delete/:id').delete(requireLocalNetwork, naikinti);
router.route('/get/:id').get(requireLocalNetwork, gautiViena);
router.route('/get').get(requireLocalNetwork, gauti);
router.route('/import').post(requireLocalNetwork, importuoti);
router.route('/parse/:id').get(requireLocalNetwork, parse);
router.route('/parseFilename').post(requireLocalNetwork, parseFilename);
router.route('/upload').post(requireLocalNetwork, upload.single("audio"), ikelti);
router.route('/update/:id').put(requireLocalNetwork, atnaujinti);

module.exports = router;
