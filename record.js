const mongoose = require('mongoose');

const recordSchema = mongoose.Schema(
  {
    pavadinimas: {
        type: String,
    },
    failo_pavadinimas: {
        type: String,
    },
    failo_data: {
        type: Date,
    },    
    data: {
        type: Date,
    },
    dydis: {
        type: Number,
    },
    metai: { 
        type: Number,
    },
    vieta: {
        type: String,
    },
    knyga: {
        type: String,
    },
    giesme: {
        type: Number,
    },
    skyrius: {
        type: Number,
    },
    tekstas: {
        type: Number
    },
    aprasymas: {
        type: String        
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Prabhupada-records', recordSchema);