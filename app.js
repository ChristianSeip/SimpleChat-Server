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
                        user.getUserById(data.data.uuid).then(() => {
                            user.isValidSession(data.data.sid).then((valid) => {
                                console.log(valid)
                                if(valid) {
                                    user.setActivity();
                                    channel.users[user.getId] = {socket: ws, client: user}
                                    wss.sendAll(`${user.getUsername} has joined.`);
                                }
                                else {
                                    ws.terminate()
                                }
                            });
                        });
                    break;
                }
        }
        catch (e) {
            console.log(`Invalid incoming data: ${data}, Error: ${e}`);
        }
    });
});

wss.sendAll = function (msg) {
    Object.keys(channel.users).forEach((key) => {
        if(channel.users[key].socket.readyState === WebSocket.OPEN) {
            channel.users[key].socket.send(JSON.stringify({event: 'PublicSystemMessage', data: {msg: msg}}));
        }
    });
}
