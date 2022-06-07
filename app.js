const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const server = http.createServer(express);
const wss = new WebSocket.Server({server})
const Database = require('./lib/db/database');
const User = require('./lib/user/user');
require('dotenv').config();
let channel = {
    name: 'Welcome',
    users: [],
};

process.on('uncaughtException', (error, origin) => {
    console.log('----- Uncaught exception -----')
    console.log(error)
    console.log('----- Exception origin -----')
    console.log(origin)
});

process.on('unhandledRejection', (reason, promise) => {
    console.log('----- Unhandled Rejection at -----')
    console.log(promise)
    console.log('----- Reason -----')
    console.log(reason)
});

// Initialize db connection and start server
Database.connectToServer(async function () {
    server.listen(process.env.APP_PORT);
    console.log(`Listening on port ${process.env.APP_PORT}`);
});

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(data) {

        try {
            data = JSON.parse(data.toString());
            if(!('event' in data)) {
                return;
            }

            let user = new User();

            switch (data.event) {
                case 'NewUser':
                    User.newUser(data.data).then((response) => {
                        ws.send(JSON.stringify(response));
                    });
                    break;
                case 'Login':
                    user.login(data.data).then((response) => {
                        ws.send(JSON.stringify(response));
                    });
                    break;
                case 'NameAvailabilityCheck':
                    User.isNameAvailable(data.data.username).then((response) => {
                        ws.send(JSON.stringify({event: 'NameAvailabilityCheck', data: {success: response}}));
                    });
                    break;
                case 'GetProfile':
                    break;
                case 'SendMessage':
                    break;
                case 'JoinChannel':
                    wss.auth(data.data).then((user) => {
                        if(user === null) { ws.terminate(); return; }
                        user.setActivity();
                        channel.users[user.getId] = {socket: ws, client: user};
                        wss.sendAll({uuid: '', username: ''}, `${user.getUsername} has joined.`, 'SystemMessage');
                    });
                    break;
                }
        }
        catch (e) {
            console.log(`Invalid incoming data: ${data}, Error: ${e}`);
        }
    });
});

/**
 * Send Message to all connected chat users.
 *
 * @param {{}} sender
 * @param {string} msg
 * @param {string} type
 * @returns {Promise<void>}
 */
wss.sendAll = async function (sender, msg, type) {
    let json = JSON.stringify({
        event: type,
        data: {
            sender: sender,
            msg: msg,
        }
    });
    Object.keys(channel.users).forEach((key) => {
        if(channel.users[key].socket.readyState === WebSocket.OPEN) {
            channel.users[key].socket.send(json);
        }
    });
}

/**
 * Authenticate the user. Returns null if authentification failed.
 *
 * @param {{}} data
 * @returns {Promise<null|User>}
 */
wss.auth = async function (data) {
    if ('uuid' in data && 'sid' in data) {
        let user = new User();
        if (await user.getUserById(data.uuid)) {
            if(await user.isValidSession(data.sid)) {
                return user;
            }
        }
    }
    return null;
}
