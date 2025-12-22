const express = require('express');
const upload = require('./upload');
const { atnaujinti, atsisiusti, gauti, gautiViena, groti, ikelti, importuoti, naikinti, sukurti, parse, parseFilename, naikintiViska } = require('./controller.js');

const router = express.Router();
router.route('/').get(gauti).post(sukurti)
router.route('/download/:id').get(atsisiusti)
router.route('/import').get(importuoti)
router.route('/naikintiViska').delete(naikintiViska)
router.route('/parse/:id').get(parse)
router.route('/parseFilename').post(parseFilename)
router.route('/play/:id').get(groti)
router.route('/upload').post(upload.single("audio"), ikelti)
router.route('/:id').get(gautiViena).put(atnaujinti).delete(naikinti)

module.exports = router;