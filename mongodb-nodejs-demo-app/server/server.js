// import dependencies and initialize express
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const MoviesDAO = require('./models/moviesDAO');

const utils = require('./utils/utils');
const movieRoutes = require('./routes/movie-route');
const swaggerRoutes = require('./routes/swagger-route');

const app = express();

// enable parsing of http request body
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// routes and api calls
app.use('/api/v1/movies', movieRoutes);
app.use('/swagger', swaggerRoutes);

// default path to serve up index.html (single page application)
app.all('', (req, res) => {
    res.status(200).sendFile(path.join(__dirname, '../public', 'index.html'));
});

// start node server
const port = process.env.PORT || 8000;
utils.dbConnect().then(async client => {
    await MoviesDAO.injectDB(client);

    app.listen(port, () => {
        console.log(`App UI available http://localhost:${port}`);
        console.log(`Swagger UI available http://localhost:${port}/swagger/api-docs`);
    });
}).catch(err => {
    console.error('Connection Error: ', err.stack);
    process.exit(1);
});

// error handler for unmatched routes or api calls
app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, '../public', '404.html'));
});

module.exports = app;