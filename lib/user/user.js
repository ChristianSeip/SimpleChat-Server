const db = require('../db/database');
const sanitize = require('mongo-sanitize');
const uuid = require('uuid');
const bcrypt = require('bcrypt');

module.exports = class User {

    #uuid = null;
    #sessionId = null;
    #username = null;
    #password = null;
    #mail = null;
    #age = null;

    /**
     * Get user uuid.
     *
     * @returns {string|null}
     */
    get getId() {
        return this.#uuid;
    }

    /**
     * Get user session id.
     *
     * @returns {string|null}
     */
    get getSessionId() {
        return this.#sessionId;
    }

    /**
     * Get username.
     *
     * @returns {string|null}
     */
    get getUsername() {
        return this.#username;
    }

    /**
     * Get user age.
     *
     * @returns {number|null}
     */
    get getAge() {
        return this.#age;
    }

    /**
     * Verify data of new user and add user to database.
     *
     * @param {{}} data
     * @returns {Promise<{data: {}, event: string}>}
     */
    static async newUser(data) {
        if(!('username' in data) || !('password' in data) || !('age' in data)) {
            return {event: 'Dialog', data: { success: false, msg: 'The form is incomplete.' }};
        }
        data.username = sanitize(data.username);
        if (!await this.isValidName(data.username)) {
            return {event: 'Dialog', data: { success: false, msg: 'The requested name is invalid or already taken.' }};
        }
        data.password = sanitize(data.password);
        if (!this.isValidPassword(data.password)) {
            return {event: 'Dialog', data: { success: false, msg: 'The requested password does not match the specifications.' }};
        }
        data.password = this.hashPassword(data.password);
        data.age = sanitize(data.age);
        if (!this.isValidAge(data.age)) {
            return {event: 'Dialog', data: { success: false, msg: 'The age specified is invalid.' }};
        }
        return await User.#addUser(uuid.v4(), data);
    }


    /**
     * Add user to database.
     *
     * @param {string} uuid
     * @param {{}} data
     * @returns {Promise<{data: {}, event: string}>}
     */
    static async #addUser(uuid, data) {
        try {
            let query = await db.getDB().collection('users').insertOne({
                uuid: uuid,
                username: data.username,
                password: data.password,
                mail: data.mail,
            });
            if(!query.acknowledged) {
                return {event: 'Dialog', data: { success: false, msg: 'An unexpected error has occurred. Please refresh the page and try again.' }}
            }
            return await User.#addUserProfile(uuid, data.age);
        }
        catch (e) {
            console.log(`addUser, error: ${e}`);
        }
        return {event: 'Dialog', data: { success: false, msg: 'An unexpected error has occurred. Please refresh the page and try again.' }}
    }

    /**
     * Add user profile to database.
     *
     * @param {string} uuid
     * @param {{}} data
     * @returns {Promise<{data: {}, event: string}>}
     */
    static async #addUserProfile(uuid, data) {
        try {
            let query = await db.getDB().collection('user_profiles').insertOne({
                uuid: uuid,
                age: data.age,
            });
            if(query.acknowledged) {
                return {event: 'NewUser', data: { success: true }};
            }
        }
        catch (e) {
            console.log(`addUserProfile, error: ${e}`);
        }
        return {event: 'Dialog', data: { success: false, msg: 'An unexpected error has occurred. Please refresh the page and try again.' }};
    }

    /**
     * Get user data by users uuid
     *
     * @param {string} uuid
     * @returns {Promise<boolean>}
     */
    async getUserById(uuid) {
        try {
            let result = await db.getDB().collection('users').findOne({uuid: uuid});
            if(result !== null) {
                this.#uuid = result.uuid;
                this.#username = result.username;
                this.#password = result.password;
                this.#sessionId = result.sid;
                this.#mail = result.mail;
                return await this.#getUserProfile();
            }
        }
        catch (e) {
            console.log(`getUserById, error: ${e}`);
        }
        return false;
    }

    /**
     * Get UUID by username
     *
     * @param {string} username
     * @returns {Promise<string>}
     */
    static async getUUIDByName(username) {
        try {
            let result = await db.getDB().collection('users').findOne({username: new RegExp('^' + username + '$', 'i')});
            if(result !== null && ('uuid' in result)) {
                return result.uuid;
            }
            return '';
        }
        catch (e) {
            console.log(`getUUIDByName, error: ${e}`);
        }
    }

    static async isNameAvailable(username) {
        return await this.getUUIDByName(username) === '';
    }

    /**
     * Get user profile data.
     *
     * @returns {Promise<boolean>}
     */
    async #getUserProfile() {
        try {
            let result = await db.getDB().collection('user_profiles').findOne({uuid: this.#uuid});
            if(result !== null) {
                this.#age = result.age;
                return true;
            }
        }
        catch (e) {
            console.log(`getUserProfile, error: ${e}`);
        }
        return false;
    }

    /**
     * Validate username.
     *
     * @param {string} username
     * @returns {Promise<boolean>}
     */
    static async isValidName(username) {
        if(username == null) {
            return false;
        }
        let regEx = new RegExp(`^[A-Za-z0-9]{3,15}$`);
        if (regEx.test(username)) {
            return await this.isNameAvailable(username);
        }
        return false;
    }

    /**
     * Validate age.
     *
     * @param age
     * @returns {boolean}
     */
    static isValidAge(age) {
        if(Number.isInteger(age)) {
            return Number.isInteger(age) && age >= 18 && age <= 120;
        }
        return false;
    }

    /**
     * Validate password.
     *
     * @param password
     * @returns {boolean}
     */
    static isValidPassword(password) {
        return password.length >= 4 && password.length <= 30;
    }

    /**
     * Validate email
     *
     * @param mail
     * @returns {boolean}
     */
    static isValidMail(mail) {
        if(mail === null) {
            return true;
        }
        if(mail.length >= 5 && mail.length <= 65) {
            if(mail.match(/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get encrypted password hash.
     *
     * @param password
     * @returns {string}
     */
    static hashPassword(password) {
        return bcrypt.hashSync(password, bcrypt.genSaltSync(10));
    }

    /**
     * Verify if password and hash compare.
     *
     * @param {string} password
     * @param {string} hash
     * @returns {boolean}
     */
    static verifyPassword(password, hash) {
        return bcrypt.compareSync(password, hash);
    }


    /**
     * Update users session id.
     *
     * @returns {Promise<boolean>}
     */
    async updateSessionId() {
        if(this.#uuid === null) {
            console.log(`Missing uuid to update session id.`);
            return false;
        }
        let sessionId = bcrypt.hashSync(uuid.v4(), bcrypt.genSaltSync(8));
        try {
            let query = await db.getDB().collection('users').updateOne(
                {uuid: this.#uuid},
                {$set: {sid: sessionId, lastActivity: Date.now()}}
            );
            if (query.acknowledged) {
                this.#sessionId = sessionId;
                return true;
            }
        }
        catch (e) {
            console.log(`${this.#uuid}: cannot set ${sessionId} as new session id, error: ${e}`);
        }
        return false;
    }

    /**
     * Get user data and try to get new login session.
     *
     * @param {{}} data
     * @returns {Promise<{data: {}, event: string}>}
     */
    async login(data) {
        if (!('keyType' in data) || !('key' in data)) {
            return {event: 'Dialog', data: {success: false, msg: 'Login failed. Please check your username and password.'}};
        }
        try {
            let user = false;
            if(data.keyType === 'password') {
                data.id = await User.getUUIDByName(data.id);
            }
            user = await this.getUserById(data.id);
            if(!user) return {event: 'Dialog', data: {success: false, msg: 'Login failed. Please check your username and password.'}};
            return this.#getLoginSession(data.key, data.keyType);
        }
        catch (e) {
            console.log(`Unexpected error on login: ${e}`);
            return {event: 'Dialog', data: { success: false, msg: 'An unexpected error has occurred. Please refresh the page and try again.' }};
        }
    }

    /**
     * Check login data and get new login session.
     *
     * @param {string} key
     * @param {string} keyType
     * @returns {Promise<{data: {}, event: string}>}
     */
    async #getLoginSession(key, keyType) {
        try {
            let expire = Date.now() + (15 * 60 * 1000);
            if ((keyType === 'session') && (key === this.#sessionId)) {
                if (await this.updateSessionId()) {
                    return {event: 'Login', data: {success: true, uuid: this.#uuid, sid: this.#sessionId, expire: expire}};
                }
            }
            if ((keyType === 'password') && (User.verifyPassword(key, this.#password))) {
                if (await this.updateSessionId()) {
                    return {event: 'Login', data: {success: true, uuid: this.#uuid, sid: this.#sessionId, expire: expire}};
                }
            }
            return {event: 'Dialog', data: {success: false, msg: 'Login failed. Please check your username and password.'}};
        }
        catch (e) {
            console.log(`Unexpected error on getLoginSession: ${e}`);
            return {event: 'Dialog', data: { success: false, msg: 'An unexpected error has occurred. Please refresh the page and try again.' }};
        }
    }
}