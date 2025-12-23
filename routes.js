const express = require('express');
const upload = require('./upload');
const { atnaujinti, atsisiusti, gauti, gautiViena, groti, ikelti, importuoti, naikinti, sukurti, parse, parseFilename, naikintiViska } = require('./controller.js');

const router = express.Router();
router.route('/create').post(sukurti)
router.route('/delete/:id').delete(naikinti)
router.route('/delete').delete(naikintiViska)
router.route('/download/:id').get(atsisiusti)
router.route('/get/:id').get(gautiViena)
router.route('/get').get(gauti)
router.route('/import').get(importuoti)
router.route('/parse/:id').get(parse)
router.route('/parseFilename').post(parseFilename)
router.route('/play/:id').get(groti)
router.route('/upload').post(upload.single("audio"), ikelti)
router.route('/update/:id').put(atnaujinti)

module.exports = router;