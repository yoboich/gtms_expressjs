const mysql = require('mysql')
const config = require('../config')
const md5 = require('md5')

function mysql_real_escape_string (str) {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
                return "\\"+char; // prepends a backslash to backslash, percent,
                                  // and double/single quotes
            default:
                return char;
        }
    });
}

class DB {

    constructor() {
        this.con = mysql.createPool({
            connectionLimit: 50,
            host: config.db_host,
            user: config.db_user,
            password: config.db_password,
            database: config.db_name,
	    
        })

        this.con.query('CREATE TABLE IF NOT EXISTS users (tgid BIGINT, name TEXT, band VARCHAR(16), score BIGINT, level INT, clan TEXT, refferal BIGINT, ref_earned INT, multitap INT, f_clan BOOL, last_come BIGINT, score_level INT, day INT, wallet TEXT)', (err, rows) => {
            if (err) throw err;
        })
        
        this.con.query('CREATE TABLE IF NOT EXISTS clans (id INT AUTO_INCREMENT PRIMARY KEY, title TEXT, url TEXT)', (err, rows) => {
            if (err) throw err;
        })

        this.con.query('CREATE TABLE IF NOT EXISTS tasks (id INT AUTO_INCREMENT PRIMARY KEY, type TEXT, title TEXT, link TEXT,  bonus INT)', (err, rows) => {
            if (err) throw err;
        })

        this.con.query('CREATE TABLE IF NOT EXISTS task_check (tgid BIGINT, task_id INT)', (err, rows) => {
            if (err) throw err;
        })

        this.con.query('CREATE TABLE IF NOT EXISTS mr_users (tgid BIGINT, url TEXT)', (err, rows) => {
            if (err) throw err;
        })

        this.con.query('CREATE TABLE IF NOT EXISTS messages (tgid BIGINT, text TEXT, name TEXT, band VARCHAR(16), sent BIGINT)', (err, rows) => {
            if (err) throw err;
        })
    }

    async getUsers() {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT * FROM users`, (err, rows) => {
                if (err) reject(err)
                resolve(rows)
            }) 
        })
    }

    async getCheckedTasks(tgid) {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT * FROM task_check WHERE tgid=${tgid}`, (err, rows) => {
                if (err) reject(err)
                resolve(rows)
            }) 
        })
    }

    async getTasks() {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT * FROM tasks`, (err, rows) => {
                if (err) reject(err)
                resolve(rows)
            }) 
        })
    }

    async getUser(tgid) {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT * FROM users WHERE tgid=${tgid}`, (err, rows) => {
                if (err) reject(err)
                resolve(rows[0])
            }) 
        })
    }

    async getClanUsers(title) {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT tgid, name, score, level, band FROM users WHERE clan='${title}' ORDER BY score DESC LIMIT 50`, (err, rows) => {
                if (err) reject(err)
                resolve(rows)
            }) 
        })
    }

    async getUsersSum() {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT SUM(score) as sum FROM users`, (err, rows) => {
                if (err) reject(err)
                resolve(rows)
            }) 
        })
    }

    async getWonBand() {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT SUM(score) as sum, band FROM users GROUP BY band ORDER BY sum DESC`, (err, rows) => {
                if (err) reject(err)
                resolve(rows[0])
            }) 
        })
    }

    async getRefferalsCount(tgid) {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT COUNT(*) as count FROM users WHERE refferal=${tgid}`, (err, rows) => {
                if (err) reject(err)
                resolve(rows[0])
            }) 
        })
    }

    async getClanName(clan_id) {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT title FROM clans WHERE id=${clan_id}`, (err, rows) => {
                if (err) reject(err)
                resolve(rows[0])
            }) 
        })
    }

    async getRefferalsEarned(tgid) {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT ref_earned FROM users WHERE tgid=${tgid}`, (err, rows) => {
                if (err) reject(err)
                resolve(rows[0])
            }) 
        })
    }

    async getBandScore(band) {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT SUM(score) as sum FROM users WHERE band='${band}'`, (err, rows) => {
                if (err) reject(err)
                const sum = rows[0]['sum']
                if (sum === null) {
                    resolve(0)
                } else {
                    resolve(sum)
                }
            })
        })
    }

    async getBandPlayers(band) {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT COUNT(*) as sum FROM users WHERE band='${band}'`, (err, rows) => {
                if (err) reject(err)
                const sum = rows[0]['sum']
                if (sum === null) {
                    resolve(0)
                } else {
                    resolve(sum)
                }
            })
        })
    }

    async addUser(tgId, name, refferal, add_score, band, multiref) {
        this.con.query(`SELECT * FROM users WHERE tgid = ${tgId}`, (err, rows) => {
            if (err) throw err;
            if (rows.length < 1) {
                if (refferal === 0){
                    console.log(`INSERT INTO users VALUES (${tgId}, '${name}', "${band}", 0, 1, "", ${refferal}, 0, 1, ${false}, 0, 1)`)
                    this.con.query(`INSERT INTO users VALUES (${tgId}, '${name}', "${band}", 0, 1, "", ${refferal}, 0, 1, ${false}, 0, 1, 1, '')`)
                } else {
                    let score = add_score
                    if (multiref) {
                        score = 1000000
                    }
                    console.log(`INSERT INTO users VALUES (${tgId}, '${name}', "${band}", ${score}, 1, "", ${refferal}, 0, 1, ${false}, 0, 1)`)
                    this.con.query(`INSERT INTO users VALUES (${tgId}, '${name}', "${band}", ${score}, 1, "", ${refferal}, 0, 1, ${false}, 0, 1, 1, '')`)
                    this.con.query(`UPDATE users SET score = score + ${score}, ref_earned = ref_earned + ${score} WHERE tgid = ${refferal}`)
                }
            }
        })
    }

    async setUserBand(tgId, band) {
        this.con.query(`UPDATE users set band = '${band}' WHERE tgid = ${tgId}`)
    }

    async setUserDay(tgId, reset) {
        if (reset) {
            this.con.query(`UPDATE users set day = 1 WHERE tgid = ${tgId}`)
        } else {
            this.con.query(`UPDATE users set day = day + 1 WHERE tgid = ${tgId}`)
        }
    }

    async addUserScoreLvl(tgId) {
        this.con.query(`UPDATE users set score_level = score_level + 1 WHERE tgid = ${tgId}`)
    }

    async setUserClan(tgId, clan) {
        this.con.query(`UPDATE users set clan = '${clan}' WHERE tgid = ${tgId}`)
    }

    async setUserScore(tgId, score) {
        if (score > 0) {
            this.con.query(`UPDATE users set score = ${score} WHERE tgid = ${tgId}`)
        } else {
            console.log(score)
        }
    }

    async setUserLastCome(tgId, last_come) {
        this.con.query(`UPDATE users set last_come = ${last_come} WHERE tgid = ${tgId}`)
    }

    async checkFClan(tgId) {
        this.con.query(`UPDATE users set f_clan = 1 WHERE tgid = ${tgId}`)
    }

    async setUserMulti(tgId, multitap) {
        this.con.query(`UPDATE users set multitap = ${multitap} WHERE tgid = ${tgId}`)
    }

    async setUserLevel(tgId, add) {
        this.con.query(`UPDATE users set level = level + ${add} WHERE tgid = ${tgId}`)
    }

    async setUserWallet(tgId, wallet) {
        this.con.query(`UPDATE users set wallet = '${wallet}' WHERE tgid = ${tgId}`)
    }

    async leaveUserClan(tgId) {
        this.con.query(`UPDATE users set clan = '' WHERE tgid = ${tgId}`)
    }

    async deleteTaskCheck(tgId, taskId) {
        this.con.query(`DELETE FROM task_check WHERE tgid = ${tgId} AND task_id=${taskId}`)
    }

    async getClans() { 
        return new Promise((resolve, reject) => {
            this.con.query(` SELECT c.id, c.title, b.members, b.score, c.url FROM (SELECT COUNT(*) as members, SUM(score) as score, clan as title FROM (SELECT * FROM users WHERE
clan <> '') as a GROUP BY clan ORDER BY score DESC) as b LEFT JOIN (SELECT id, title, url FROM clans) as c ON b.title = c.title`, (err, rows) => {
                if (err) reject(err)
                resolve(rows)
            }) 
        })
    }

    async getClanInfo(title) {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT COUNT(*) as peaples, SUM(score) as score FROM users WHERE clan='${title}'`, (err, rows) => {
                if (err) reject(err)
                resolve(rows)
            }) 
        })
    }

    async getClan(title) {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT id, url FROM clans WHERE title='${title}'`, (err, rows) => {
                if (err) reject(err)
                resolve(rows)
            }) 
        })
    }

    async getClanLastId() {
        return new Promise((resolve, reject) => {
            this.con.query(` SELECT MAX( id ) as last_id FROM clans;`, (err, rows) => {
                if (err) reject(err)
                resolve(rows)
            }) 
        })
    }

    async getLastMessage() {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT * FROM messages ORDER BY sent DESC LIMIT 1`, (err, rows) => {
                if (err) reject(err)
                resolve(rows[0])
            }) 
        })
    }

    async addClan(title, url="") {
        this.con.query(`INSERT INTO clans VALUES (0, '${title}', '${url}')`)
    }

    async addTaskCheck(tgid, taskid) {
        this.con.query(`INSERT INTO task_check VALUES (${tgid}, ${taskid})`)
    }

    async clearChatTask() {
        console.log(`DELETE FROM task_check WHERE task_id = 9`)
        this.con.query(`DELETE FROM task_check WHERE task_id = 9`)
    }

    async addMRUser(tgid, url) {
        this.con.query(`SELECT * FROM mr_users WHERE tgid = ${tgid}`, (err, rows) => {
            if (err) throw err;
            if (rows.length < 1) {
                this.con.query(`INSERT INTO mr_users VALUES (${tgid}, '${url}')`)
            }
        })
    }

    async getTask(task_type) {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT * FROM tasks WHERE type='${task_type}'`, (err, rows) => {
                if (err) reject(err)
                resolve(rows[0])
            }) 
        })
    }

    async addChatTask(tgid, taskid, new_score) {
        this.con.query(`SELECT * FROM task_check WHERE tgid = ${tgid} AND task_id = ${taskid}`, async (err, rows) => {
            if (err) throw err;
            if (rows.length < 1) {
                this.con.query(`INSERT INTO task_check VALUES (${tgid}, ${taskid})`)
                await db.setUserScore(tgid, new_score)
            }
            
        })
    }

    async getMRUser(url) {
        return new Promise((resolve, reject) => {
            this.con.query(`SELECT * FROM mr_users WHERE url='${url}'`, (err, rows) => {
                if (err) reject(err)
                resolve(rows[0])
            }) 
        })
    }

    async addMessage(tgid, text, band, name, sent) {
        this.con.query(`INSERT INTO messages VALUES (${tgid}, '${mysql_real_escape_string(text)}', '${mysql_real_escape_string(name)}', '${mysql_real_escape_string(band)}', ${sent})`)
    }

    async getMessages(offset) {
        return new Promise((resolve, reject) => {
            console.log(`SELECT * FROM messages ORDER BY sent DESC LIMIT 10 OFFSET ${offset}`)
            this.con.query(`SELECT * FROM messages ORDER BY sent DESC LIMIT 10 OFFSET ${offset}`, (err, rows) => {
                if (err) reject(err)
                resolve(rows)
            }) 
        })
    }

}

const db = new DB()

module.exports = db
