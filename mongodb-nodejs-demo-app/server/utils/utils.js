
const mongodb = require('mongodb');

// Application settings
const appSettings = require('../config/app-settings');

/**
 * Write the response from the server.
 * 
 * @param {IncomingMessage} response - the response object from the HTTP request callback
 * @param {ServerResponse} responseMessage - the message to write as a simple string
 * @param {number} statusCode - the HTTP status code for the response
 */
const writeServerResponse = (response, message, statusCode) => {
    //console.log(`${message} | writeServerResponse(${statusCode})`);
    response.statusCode = statusCode;
    response.write(message);
    response.end();
}

/**
 * Write the response from the server.
 * 
 * @param {IncomingMessage} response - the response object from the HTTP request callback
 * @param {ServerResponse} responseJson - the message to write as a simple string
 * @param {number} statusCode - the HTTP status code for the response
 */
const writeServerJsonResponse = (response, responseJson, statusCode) => {
    //console.log(`${JSON.stringify(responseJson)} | writeServerJsonResponse(${statusCode})`);
    response.setHeader('Content-Type', 'application/json');
    response.status(statusCode).send(responseJson);
}

/**
 * The DB connection variables
 */
let mongoClient;
const dbOptions = {
    useNewUrlParser: true, 
    useUnifiedTopology: true
}

/**
 * Initializes the MongoDB.
 */
const dbConnect = () => {
    return new Promise((resolve, reject) => {
        console.log('Connecting to the database.');

        if (mongoClient) {
            console.log('Database already connected, returning to the open connection.');
            resolve(mongoClient);
        } else {
            console.log('Database not connected. Creating new connection.');
            mongodb.MongoClient.connect(appSettings.MONGODB_URL, dbOptions, (err, client) => {
                if (err) {
                    console.log('Error connecting the database');
                    reject(err);
                }
                console.log("Connected successfully to MongoDB server");
                mongoClient = client;

                // Make sure connection closes when Node exits
                process.on('exit', (code) => {
                    console.log(`Closing MongoDB connection (node exit code ${code})...`);
                    dbClose();
                    console.log('Database connection closed succesfully.');
                }).on('SIGINT', () => {
                    console.log(`Closing MongoDB connection (node exit code ${code})...`);
                    dbClose();
                    console.log('Database connection closed succesfully.');
                    process.exit(1);
                });

                resolve(mongoClient);
            });
        }
    });
}

/**
 * Closes the database connection
 */
const dbClose = () => {
    if (mongoClient && mongoClient.isConnected()) {
        console.log('Closing the database connection...');
        mongoClient.close();
        console.log('Database connection closed!');
    }
}

module.exports = {
    writeServerResponse: writeServerResponse,
    writeServerJsonResponse: writeServerJsonResponse,
    dbConnect: dbConnect,
    dbClose: dbClose
}