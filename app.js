const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const server = http.createServer(express);
const wss = new WebSocket.Server({server})
const Database = require('./lib/db/database');
const User = require('./lib/user/user');
require('dotenv').config();
let clients = [];

// Initialize db connection and start server
Database.connectToServer(async function () {
    server.listen(process.env.APP_PORT);
    console.log(`Listening on port ${process.env.APP_PORT}`);

});

wss.on('connection', function connection(ws) {
    //clients.push(ws); // TODO: push client on login {uuid: {User(), ws, channel_id}}
    ws.on('message', function incoming(data) {
        try {
            data = JSON.parse(data.toString());
            if(!('event' in data)) {
                return;
            }

            switch (data.event) {
                case 'NewUser':
                    User.newUser(data.data).then((response) => {
                        ws.send(JSON.stringify(response));
                    });
                    break;
                case 'Login':
                    let user = new User();
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
                case 'UpdateProfile':
                    break;
                case 'SendMessage':
                    // Unterscheidung: Private, Public, Broadcaste > Modul entscheiden
                    break;
                case 'GetChannelList':
                    break;
                case 'JoinChannel':
                    break;
            }
        }
        catch (e) {
            console.log(`Invalid incoming data: ${data}, Error: ${e}`);
        }

        /*
        //Send data to all Clients
        wss.clients.forEach(function each(client) {
           if (client.readyState === WebSocket.OPEN) {
               client.send(data.toString());
           }
        });
         */
    });
});