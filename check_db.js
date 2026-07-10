const DB = require('./database');
async function check() {
    try {
        const users = await DB.query.all("SELECT username, password, role FROM users");
        console.log("Users in Database:");
        console.log(users);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
setTimeout(check, 500);
