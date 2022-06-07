const { MongoClient } = require("mongodb");
require('dotenv').config();
const connectionString = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}`;
const client = new MongoClient(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

let connection;

module.exports = {
    connectToServer: function (callback) {
        client.connect(function (err, db) {
            if (err) {
                throw err;
            }
            connection = db.db(process.env.DB_NAME);
            console.log('Successfully connected to MongoDB.');
            return callback();
        });
    },

    getDB: function () {
        return connection;
    },
};