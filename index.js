const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const bodyParser = require('body-parser')
const db = require('./db/db')
const config = require('./config')
const Xray = require("x-ray")
const fs = require('fs')
const client = require('https')
const cron = require('node-cron')
const fetch = require('node-fetch');
const usersRouter = require('./routers/usersRouter.js')
var x = Xray()

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

const daily_rewards = [
    50000,
    100000,
    200000,
    400000,
    500000,
    600000,
    700000
]

app.use(cors())


app.use(bodyParser.json({limit: "50mb"}))
app.use(bodyParser.urlencoded({ extended: true }))

app.use('/api/clan_images', express.static("./images"))
app.use('/api/tasks_logo', express.static("./tasks_logo"))
app.use('/api/users', usersRouter)


const PORT = process.env.PORT || 3001

const getPhotoUrl = async(username) => {
    const url = `https://t.me/${username}`
    const res = await x(url, '.tgme_page', {
        photo: ".tgme_page_photo_image@src"
    })
    if (Object.keys(res).length){
        if (!res['photo'].startsWith("data:image")) {
            return res['photo']
        } else {
            return undefined
        }
    }
}

app.listen(PORT, () => {
    console.log(`Server was started at ${PORT} port!`)
})



io.on('connection', async (socket) => {
    const tgid = socket.handshake.query.tgid
    let user = await db.getUser(tgid)
    
    if (user !== undefined){
        if ((user.band !== undefined) && (user.band !== "")) {
            socket.emit("auth", {})
            var d = new Date(user.last_come * 1000).setHours(0, 0, 0, 0) / 1000
            const now_date = parseInt(new Date().getTime() / 1000)
            if (user.day > 7) {
                db.setUserDay(tgid, true)
            }
            if (user.last_come > 0) {
                const dTime = (((now_date - d) / 60) / 60) / 24
                db.setUserLastCome(tgid, now_date)

                if ((dTime > 1) && (dTime <= 2)) {
                    db.setUserDay(tgid, false)
                } else if (dTime > 2) {
                    db.setUserDay(tgid, true)
                }

                if (dTime > 1) {
                    
                    const daily_task_id = (await db.getTasks()).filter(v => v.type === "eday")[0].id
                    db.deleteTaskCheck(tgid, daily_task_id)
                    let sum = 1000
                    
                    const count = await db.getRefferalsCount(tgid)
                    if ((count > 0) && (count <= 5)) {
                        sum += 10000
                    } else if ((count > 5) && (count <= 10)) {
                        sum += 50000
                    } else if ((count > 10) && (count <= 50)) {
                        sum += 100000
                    } else if ((count > 50) && (count <= 100)) {
                        sum += 1000000
                    }
                    if (user.score + sum === 0) {
                        //console.log("LINE 102")
                    }
                    db.setUserScore(tgid, user.score + sum)
                }

            } else {
                db.setUserLastCome(tgid, now_date)
                let sum = 1000
                
                const count = await db.getRefferalsCount(tgid)
                if ((count > 0) && (count <= 5)) {
                    sum += 10000
                } else if ((count > 5) && (count <= 10)) {
                    sum += 50000
                } else if ((count > 10) && (count <= 50)) {
                    sum += 100000
                } else if ((count > 50) && (count <= 100)) {
                    sum += 1000000
                }
                if (user.score + sum === 0) {
                    //console.log("LINE 125")
                }
                db.setUserScore(tgid, user.score + sum)
            }
            
        } else {
            socket.emit("no_auth", {})
        }
    } else {
        socket.emit("no_auth", {})
    }

    socket.on('connect_error', (e) => {
        console.log(e.message)
    })

    socket.on("get_tasks", async ({ tgid }) => {
        try {
            let user = await db.getUser(tgid)
            const tasks = await db.getTasks()
            const checked_tasks = await db.getCheckedTasks(tgid)
            let res = []
            let eday = undefined
            for (const k of tasks) {
                if (checked_tasks.length > 0) {
                    if (checked_tasks.filter(v => v.task_id === k.id).length > 0) {
                        k['checked'] = true
                    } else {
                        k['checked'] = false    
                    }
                } else {
                    k['checked'] = false
                }
                if (k.type === 'eday') {
                    k['bonus'] = daily_rewards[user.day - 1]
                    eday = k
                } else {
                    res.push(k)
                }
            }
            res.unshift(eday)
            socket.emit("send_tasks", res)
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("select_band", ({ tgid, band }) => {
        try {
            db.setUserBand(tgid, band)
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("check_tg_sub", async ({ tgid, task }) => {
        try {
            console.log(task)
            let url = `https://api.telegram.org/bot${config.bot_token}/getChatMember?`
            url += `chat_id=${task.link.replace("https://t.me/", "@")}&`
            url += `user_id=${tgid}`
            const res = await (await fetch(url)).json()
            if (res) {
                if (res.ok) {
                  if (res.result.status !== 'left') {
                    user = await db.getUser(tgid)
                    if (user) {
                        db.addTaskCheck(tgid, task.id)
                        if (task.bonus + user.score === 0) {
                            //console.log("LINE 519")
                        }

                        db.setUserScore(tgid, task.bonus + user.score)
                        socket.emit("sub", { task: task })
                    }
                  } else {
                    socket.emit("not_sub", { task: task })
                  }
                } else {
                    socket.emit("not_sub", { task: task })
                  } 
            } else {
                socket.emit("not_sub", { task: task })
              }

        } catch (e) {
            console.log(e)
        }
    })

    socket.on("set_user_wallet", ({ tgid, wallet }) => {
        try {
            db.setUserWallet(tgid, wallet)
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("set_multitap", ({ tgid, multitap, score }) => {
        try {
            if (score === 0) {
                //console.log("LINE 191")
            }
            db.setUserScore(tgid, score)
            db.setUserMulti(tgid, multitap)
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("get_main_info", async ({ tgid }) => {
        try {
            user = await db.getUser(tgid)
            

            let l_mes = await db.getLastMessage()

            let url = `https://api.telegram.org/bot${config.bot_token}/getChat?`
            const username = (await ( await fetch(url + `chat_id=${l_mes['tgid']}`)).json()).result.username
            l_mes['photo'] = await getPhotoUrl(username)

            
            if (user) { 
                const res = {
                    name: user.name,
                    score: user.score,
                    level: user.level,
                    band: user.band,
                    bandScore: await db.getBandScore(user.band),
                    multitap: user.multitap,
                    refferal: user.refferal,
                    l_mes: l_mes
                }
                socket.emit("send_main_info", res)
            }
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("get_all_bands_score", async () => {
        try {
            const atztek = await db.getBandScore("Atztek")
            const vagos = await db.getBandScore("Vagos")
            const gs = await db.getBandScore("Grove Street")
            const ballas = await db.getBandScore("Ballas")
            const res = {
                atztek: atztek,
                vagos: vagos,
                gs: gs,
                ballas: ballas,
                sum: atztek + vagos + gs + ballas,
                players: io.engine.clientsCount
            }
            socket.emit("send_all_bands_score", res)
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("get_all_bands_stats", async () => {
        try {
            const atztekScore = await db.getBandScore("Atztek")
            const vagosScore = await db.getBandScore("Vagos")
            const gsScore = await db.getBandScore("Grove Street")
            const ballasScore = await db.getBandScore("Ballas")
            const atztekPlayers = await db.getBandPlayers("Atztek")
            const vagosPlayers = await db.getBandPlayers("Vagos")
            const gsPlayers = await db.getBandPlayers("Grove Street")
            const ballasPlayers = await db.getBandPlayers("Ballas")
            const res = [
                { name: "Ballas", players: ballasPlayers, score: ballasScore},
                { name: "Vagos", players: vagosPlayers, score: vagosScore},
                { name: "Grove Street", players: gsPlayers, score: gsScore},
                { name: "Atztek", players: atztekPlayers, score: atztekScore},
            ]
            socket.emit("send_all_bands_stats", res)
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("get_friends_info", async ({ tgid }) => {
        try {
            const ref_counts = await db.getRefferalsCount(tgid)
            const earned = await db.getRefferalsEarned(tgid)
            const info = { count: ref_counts['count'], earned: earned['ref_earned'] }
            socket.emit("send_friends_info", info)
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("user_click", async ({ tgid, add }) => {
        try {
            console.log("click")
            if (add === 0) {
                //console.log("LINE 274")
            } else {
                user = await db.getUser(tgid)
                await db.setUserScore(tgid, add)
                if (user) {
                    if (user.refferal > 0) {
                        if (add >= (user.score_level * 100000)) {
                            const ref = await db.getUser(user.refferal)
                            db.addUserScoreLvl(tgid)
                            if ((ref.score + 10000) === 0) {
                                //console.log("LINE 283")
                            }
                            await db.setUserScore(ref.tgid, ref.score + 10000)
                        }
                    }
                }
            }
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("user_levelup", async ({ tgid, add }) => {
        try {
            await db.setUserLevel(tgid, add)
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("refferal", async ({ tgid }) => {
        try {
            let url = `https://api.telegram.org/bot${config.bot_token}/sendMessage?`
            let txt = "Invite your friends and get bonuses for each invited friend!🎁%0A%0A"
            txt += `Your referral link: ${config.bot_url}?start=r_${tgid}`
            url += `chat_id=${tgid}&`
            url += `text=${txt}&`
            url += `parse_mode=HTML&`
            let invite_txt = "🏆 100k gtm tokens as a first time bonus\n"
            invite_txt += "💎 100k for each friend you bring"
            const invite_url = `https://t.me/share/url?text=${invite_txt}${encodeURI("&")}url=${encodeURI(`${config.bot_url}?start=r_${tgid}`)}`
            
            const keyboard = JSON.stringify({
                "inline_keyboard": [
                    [
                        {
                            "text": "Invite a Friend",
                            "url": invite_url
                        }
                    ],
                    [
                        {
                            "text": "Back to GTM Seizure",
                            "web_app": { url: config.webapp_url }
                        }
                    ]
                ]
            })
            url += `reply_markup=${encodeURIComponent(keyboard)}`
            const resp = await fetch(url)
            const res = await resp.json()
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("refferal_gang", async ({ tgid }) => {
        try {
            user = await db.getUser(tgid)
            let url = `https://api.telegram.org/bot${config.bot_token}/sendMessage?`
            let txt = "Invite your friends and get bonuses for each invited friend!🎁%0A%0A"
            txt += `Your referral link: ${config.bot_url}?start=g_${tgid}_${user.band}`
            url += `chat_id=${tgid}&`
            url += `text=${txt}&`
            url += `parse_mode=HTML&`
            let invite_txt = "🏆 100k gtm tokens as a first time bonus\n"
            invite_txt += "💎 100k for each friend you bring"
            const invite_url = `https://t.me/share/url?text=${invite_txt}${encodeURI("&")}url=${encodeURI(`${config.bot_url}?start=g_${tgid}_${user.band}`)}`
            
            const keyboard = JSON.stringify({
                "inline_keyboard": [
                    [
                        {
                            "text": "Invite a Friend",
                            "url": invite_url
                        }
                    ],
                    [
                        {
                            "text": "Back to GTM Seizure",
                            "web_app": { url: config.webapp_url }
                        }
                    ]
                ]
            })
            url += `reply_markup=${encodeURIComponent(keyboard)}`
            const resp = await fetch(url)
            const res = await resp.json()
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("create_clan", async ({ url, tgid, userClan }) => {
        try {
            if (userClan) {
                if ((await db.getClan(url)).length) {
                    socket.emit("error_clan", { message: "This chanel already created"})
                } else {
                    await db.addClan(url)
                    await db.setUserClan(tgid, url)
                    clan = (await db.getClanLastId())[0]['last_id']
                    socket.emit("has_clan", { clan: clan, title: url, url: ""})
                }

            } else {
                const res = await x(url, '.tgme_page', {
                    title: ".tgme_page_title",
                    photo: ".tgme_page_photo_image@src"
                })
                if (Object.keys(res).length){
                    if (!res['photo'].startsWith("data:image")) {
                        res['title'] = res['title'].trim() 
                        let clan = await db.getClan(res['title'])
                        if (clan.length < 1) {
                            await db.addClan(res['title'], url)
                            clan = (await db.getClanLastId())[0]['last_id']
                            if (clan === null){ clan = 1 }else { clan += 1 }
                            client.get(res['photo'], resp => {
                                resp.pipe(fs.createWriteStream(`./images/clan_${clan}.png`));
                                db.setUserClan(tgid, res['title'])
                                socket.emit("has_clan", { clan: clan, title: res['title'], url: url})
                            })
                        } else socket.emit("error_clan", { message: "This chanel already created"})

                    } else socket.emit("error_clan", { message: "Please add avatar to your chanel"})

                } else socket.emit("error_clan", { message: "No public chanel with this url"})
            }
                
        } catch (err) {
            console.log(err)
            socket.emit("error_clan", { message: "No public chanel with this url"})
        }
    })

    socket.on("is_in_clan", async ({ tgid }) => {
        try {
            user = await db.getUser(tgid)
            if (user) {
                if (user.clan) {
                    const clan_id = (await db.getClan(user.clan))[0]
                    socket.emit("has_clan", { clan: clan_id['id'], title: user.clan, url: clan_id['url']})
                }
            }
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("get_user_clan", async ({ tgid }) => {
        try {
            user = await db.getUser(tgid)
            if (user) {
                socket.emit("set_user_clan", { title: user.clan })
            }
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("create_multi_refferal", async ({ tgid, tgurl }) => {
        try {
            const uname = "@" + tgurl.replace("https://t.me/", "").replace(" ", "")
            if (uname) {
                const has_mr_user = await db.getMRUser(uname)
                if (has_mr_user === undefined) {
                    let url = `https://api.telegram.org/bot${config.bot_token}/getMe`
                    const botid = (await (await fetch(url)).json())['result']['id']
                    url = `https://api.telegram.org/bot${config.bot_token}/getChatMember?`
                    url += `chat_id=${uname}&`
                    url += `user_id=${botid}`
                    const res = await (await fetch(url)).json()
                    if (res['ok']) {
                        if (res['result']['status'] === 'administrator'){
                            url = `https://api.telegram.org/bot${config.bot_token}/getChatMemberCount?`
                            url += `chat_id=${uname}&`
                            const subs = await (await fetch(url)).json()
                            if (subs['result'] >= 10000 ) {
                                await db.addMRUser(tgid, uname)
                                url = `https://api.telegram.org/bot${config.bot_token}/sendMessage?`
                                let txt = "Invite your friends and get bonuses for each invited friend!🎁%0A%0A"
                                txt += `Your referral link: ${config.bot_url}?start=r_${tgid}-${uname.replace("@", "")}`
                                url += `chat_id=${tgid}&`
                                url += `text=${txt}&`
                                url += `parse_mode=HTML&`
                                let invite_txt = "🏆 1kk gtm tokens as a first time bonus\n"
                                invite_txt += "💎 1kk for each friend you bring"
                                const invite_url = `https://t.me/share/url?text=${invite_txt}${encodeURI("&")}url=${encodeURI(`${config.bot_url}?start=r_${tgid}-${uname.replace("@", "")}`)}`
                                
                                const keyboard = JSON.stringify({
                                    "inline_keyboard": [
                                        [
                                            {
                                                "text": "Invite a Friend",
                                                "url": invite_url
                                            }
                                        ],
                                        [
                                            {
                                                "text": "Back to GTM Seizure",
                                                "web_app": { url: config.webapp_url }
                                            }
                                        ]
                                    ]
                                })
                                url += `reply_markup=${encodeURIComponent(keyboard)}`
                                const resp = await fetch(url)
                                const res = await resp.json()
                                socket.emit("create_mr_link", {})
                            } else {
                                socket.emit("error_multiref", { message: "You have less than 10,000 subscribers"})
                            }
                        } else {
                            socket.emit("error_multiref", { message: "Our bot was not added to your channel administrators"})        
                        }
                    } else {
                        socket.emit("error_multiref", { message: "Our bot was not added to your channel administrators"})    
                    }
                } else {
                    socket.emit("error_multiref", { message: "This channel already added"})    
                }
            } else {
                socket.emit("error_multiref", { message: "No public chanel with this url"})
            }
            
        } catch (e) {
            console.log(e)
            socket.emit("error_multiref", { message: "Something went wrong!"})
        }
    })

    socket.on("mark_task_checked", async ({ tgid, taskid, taskSum }) => {
        try {
            user = await db.getUser(tgid)
            if (user) {
                db.addTaskCheck(tgid, taskid)
                if (taskSum + user.score === 0) {
                    //console.log("LINE 519")
                }

                db.setUserScore(tgid, taskSum + user.score)
            }
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("get_clans", async ({ }) => {
        try {
            socket.emit("clan_list_loading", {})
            const clans = await db.getClans()
            socket.emit("set_clans", { clans: clans})
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("leave_clan", async ({ tgid }) => {
        try {
            await db.leaveUserClan(tgid)
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("enter_clan", async ({ tgid, title }) => {
        try {
            await db.setUserClan(tgid, title)
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("get_clan_users", async ({ title }) => {
        try {
            let users = await db.getClanUsers(title)
            let url = `https://api.telegram.org/bot${config.bot_token}/getChat?`
            socket.emit("clan_list_loading", {})
            let reqs = []
            let reqs_res = []

            for (const k of users) {
                reqs.push(fetch(url + `chat_id=${k['tgid']}`))
            }

            reqs_res = await Promise.all(reqs)
            reqs = []

            for (const k of reqs_res) {
                reqs.push(k.json())
            }
            
            reqs_res = await Promise.all(reqs)
            reqs = []

            for (const k of reqs_res) {
                if (k['ok']){
                    const username = k['result']['username']
                    reqs.push(getPhotoUrl(username))
                }
            }

            reqs_res = await Promise.all(reqs)
            reqs = []

            for (const k in reqs_res) {
                if (reqs_res[k]) {
                    users[k]['photo'] = reqs_res[k]
                } else {
                    users[k]['photo'] = 'empty'
                }
            }

            /*for (const k of users) {
                try {
                    const resp = await fetch(url + `chat_id=${k['tgid']}`)
                    const res = await resp.json()
                    if (res['ok']){
                        k['username'] = res['result']['username']
                        const photo = await getPhotoUrl(res['result']['username'])
                        if (photo) {
                            k['photo'] = photo
                        } else {
                            k['photo'] = 'empty'
                        }
                    }
                } catch(e) {
                    k['photo'] = 'empty'
                }
            }*/


            socket.emit("set_clan_users", { members: users})
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("send_message", async ({ tgid, text }) => {
        try {
            user = await db.getUser(tgid)
            if (user) {
                const cur_date = parseInt((new Date().getTime()) / 1000)
                await db.addMessage(tgid, text, user.band, user.name, cur_date)
                const url = `https://api.telegram.org/bot${config.bot_token}/getChat?`
                let photo = 'empty'
                let username = await (await fetch(url + `chat_id=${tgid}`)).json()
                if (username['ok']){
                    username = username['result']['username']
                    
                    photo = await getPhotoUrl(username)
                    if (photo === undefined) {
                        photo = 'empty'
                    }
                }
                
                io.emit("sended_message", {tgid: tgid, text: text, band: user.band, name: user.name, sent: cur_date, photo: photo})
                const chat_task = await db.getTask('chat')
                await db.addChatTask(tgid, chat_task.id, chat_task.bonus + user.score)
                if (chat_task.bonus + user.score === 0) {
                    //console.log("LINE 619")
                }
            }
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("get_photo", async ({ username }) => {
        try {
            if (username) {
                const photo = await getPhotoUrl(username)
                if (photo) {
                    socket.emit("send_photo", { photo: photo })
                } else {
                    socket.emit("send_photo", { photo: 'empty' })
                }
            }
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("get_messages", async ({ offset }) => {
        try {
            const messages = await db.getMessages(offset)
            
            let reqs = []
            
            for (const k of messages) {
                const url = `https://api.telegram.org/bot${config.bot_token}/getChat?`
                reqs.push(fetch(url + `chat_id=${k['tgid']}`))
            }
            let req_res = await Promise.all(reqs)
            reqs = []
            
            for (const k of req_res) {
                reqs.push(k.json())
            }

            req_res = await Promise.all(reqs)
            reqs = []

            for (const k in req_res) {
                if (req_res[k]['ok']){
                    const username = req_res[k]['result']['username']
                    reqs.push(getPhotoUrl(username))
                }
            }
            
            req_res = await Promise.all(reqs)
            reqs = []

            for (const k in req_res) {
                if (req_res[k]) {
                    messages[k]['photo'] = req_res[k]
                } else {
                    messages[k]['photo'] = 'empty'
                }
            }

            if (messages) {
                if (offset < 1) {
                    socket.emit("send_messages", { messages: messages})
                } else {
                    socket.emit("add_messages", { messages: messages})
                }
            }
        } catch (e) {
            console.log(e)
        }
    })

    socket.on("chanel_refferal", async ({ clan_id, tg_id }) => {
        try {
            let url = `https://api.telegram.org/bot${config.bot_token}/sendMessage?`
            let txt = "Invite your friends and get bonuses for each invited friend!🎁%0A%0A"
            txt += `Your referral link: ${config.bot_url}?start=c_${clan_id}_${tg_id}`
            url += `chat_id=${tgid}&`
            url += `text=${txt}&`
            url += `parse_mode=HTML&`
            let invite_txt = "🏆 100k gtm tokens as a first time bonus\n"
            invite_txt += "💎 100k for each friend you bring"
            const invite_url = `https://t.me/share/url?text=${invite_txt}${encodeURI("&")}url=${encodeURI(`${config.bot_url}?start=c_${clan_id}_${tg_id}`)}`
            
            const keyboard = JSON.stringify({
                "inline_keyboard": [
                    [
                        {
                            "text": "Invite a Friend",
                            "url": invite_url
                        }
                    ],
                    [
                        {
                            "text": "Back to GTM Seizure",
                            "web_app": { url: config.webapp_url }
                        }
                    ]
                ]
            })
            url += `reply_markup=${encodeURIComponent(keyboard)}`
            const resp = await fetch(url)
            const res = await resp.json()
        } catch (e) {
            console.log(e)
        }
    })

    
    socket.on('leave', function({ score }) {

        console.log(score);
    });

    socket.on('disconnect', function(socket) {
        console.log(socket)
        console.log('Got disconnect!');
    });

  });

server.listen(3002, () => {
    cron.schedule('0 0 * * *', async () => {
        await db.clearChatTask()
        const users = await db.getUsers()
        users.map(async v => {
            const dTime = Math.floor(Math.floor(Math.floor(Math.floor((Date.now() - v.last_come) / 1000) / 60) / 60) / 24)
            if (dTime === 13) {
                let url = `https://api.telegram.org/bot${config.bot_token}/sendMessage?`
                let txt = "Внимание, завтра 10% ваших токенов будет списано в связи с отсутствием от вас активности, чтобы предотвратить списание зайдите в игру"
                url += `chat_id=${v.tgid}&`
                url += `text=${txt}`
                const resp = await fetch(url)
            } else if (dTime === 14) {
                let url = `https://api.telegram.org/bot${config.bot_token}/sendMessage?`
                let txt = "Внимание, 10% ваших токенов были списаны в связи с отсутствием от вас активности, чтобы предотвращать списания - заходите в игру почаще"
                url += `chat_id=${v.tgid}&`
                url += `text=${txt}`
                const resp = await fetch(url)
            }
        })
    });
    console.log("Socket.io server is running at 3002 port")
})
