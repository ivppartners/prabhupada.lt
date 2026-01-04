require("dotenv").config();

const express = require('express'); 
var cors = require('cors')
const { errorHandler } = require('./errorMiddleware');

const port = 4001;
const app = express();

var corsOptions = {
  origin: ['http://localhost:3300', 'http://localhost:5173', 'http://192.168.4.156:3300', 'http://prabhupada.lt', 'https://prabhupada.lt', 'http://prabhupada-admin'],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

app.use(cors(corsOptions))

app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use('/api', require('./routes.js'));
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});