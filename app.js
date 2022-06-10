const fs = require("fs");
const https = require('https');
const server = https.createServer({
    key: fs.readFileSync(process.env.SSL_KEY),
    cert: fs.readFileSync(process.env.SSL_CERT)
});
const WebSocket = require('ws');
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
                case 'Logout':
                    wss.auth(data.data).then((auth) => {
                        if(auth === null) return;
                        channel.users[auth.getId].client.setActivity();
                        disconnectUser(auth.getId);
                    });
                    break;
                case 'NameAvailabilityCheck':
                    User.isNameAvailable(data.data.username).then((response) => {
                        ws.send(JSON.stringify({event: 'NameAvailabilityCheck', data: {success: response}}));
                    });
                    break;
                case 'SendMessage':
                    if(!('msg' in data.data)) return;
                    wss.auth(data.data).then((auth) => {
                        if(auth === null) return;
                        channel.users[auth.getId].client.setActivity();
                        wss.sendAll({uuid: auth.getId, username: auth.getUsername, msg: data.data.msg, type: 'PublicMessage', timestamp: Date.now()}, 'MessageReceived');
                    });
                    break;
                case 'JoinChannel':
                    wss.auth(data.data).then((user) => {
                        if(user === null) return;
                        channel.users[user.getId] = {socket: ws, client: user};
                        channel.users[user.getId].client.setActivity();
                        wss.sendAll({uuid: user.getId, username: user.getUsername, age: user.getAge, lastActivity: user.getLastActivity}, 'UserJoined');
                        wss.sendAll({uuid: '0', username: '***', msg: `${user.getUsername} has joined.`, type: 'SystemMessage'}, 'MessageReceived').then(() => {
                            ws.send(JSON.stringify({event: 'InitChat', data: {channelname: channel.name, users: getChannelUsers()}}));
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

/**
 * Send Message to all connected chat users.
 *
 * @param {{}} obj
 * @param {string} event
 * @returns {Promise<void>}
 */
wss.sendAll = async function (obj, event) {
    let json = JSON.stringify({
        event: event,
        data: obj,
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

/**
 * Get list of online users
 *
 * @returns {[]}
 */
getChannelUsers = function () {
    let list = [];
    Object.keys(channel.users).forEach((key) => {
        if(channel.users[key].socket.readyState === WebSocket.OPEN) {
            list.push({
                uuid: key,
                username: channel.users[key].client.getUsername,
                age: channel.users[key].client.getAge,
                lastActivity: channel.users[key].client.getLastActivity,
            });
        }
    });
    return list;
}

/**
 * Disconnect inactive users.
 */
checkUserConnections = function () {
    Object.keys(channel.users).forEach((key, index) => {
        let u = channel.users[key];
        if(u.client.isInactive() || u.socket.readyState !== WebSocket.OPEN) {
            disconnectUser(key);
        }
    });
}

/**
 * Disconnect user.
 *
 * @param uuid
 */
disconnectUser = function (uuid) {
    channel.users[uuid].client.destroySession();
    wss.sendAll({uuid: '0', username: '***', msg: `${channel.users[uuid].client.getUsername} left.`, type: 'SystemMessage'}, 'MessageReceived');
    wss.sendAll({uuid: channel.users[uuid].client.getId}, 'UserLeft');
    delete channel.users[uuid];
}

setInterval(checkUserConnections, 10000);