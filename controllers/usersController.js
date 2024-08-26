const { error } = require('console');
const db = require('../db/db')
const fs = require('fs')

module.exports = {

    async addUser (req, res) {
        try {
            console.log(req.body)
            if (!req.body.tgId){
                res.status(400).json({ error: "Не указан tgId"} )
                return;
            }

            if (!req.body.name){
                res.status(400).json({ error: "Не указан name"} )
                return;
            }

            if ((!req.body.refferal) && (req.body.refferal !== 0)){
                res.status(400).json({ error: "Не указан refferal"} )
                return;
            }

            if (!req.body.add_score){
                res.status(400).json({ error: "Не указан add_score"} )
                return;
            }

            if ((!req.body.band) && (req.body.band !== '')){
                res.status(400).json({ error: "Не указан band"} )
                return;
            }

            const { tgId, name, refferal, add_score, band, multiref } = req.body

            try {
                await db.addUser(tgId, name, refferal, add_score, band, multiref)
                console.log(band)
                res.status(200).send({msg: "OK"})
            } catch (e) {
                console.log(e)
                res.status(400).send({error: "Ошибка в добавлении пользователя"})    
            }

        } catch (e) {
            console.log(e)
            res.status(400).send({error: "Ошибка в добавлении пользователя"})
        }
    },

    async setUserClan (req, res) {
        try {
            console.log(req.body)
            if (!req.body.tgId){
                res.status(400).json({ error: "Не указан tgId"} )
                return;
            }

            if (!req.body.clan_id){
                res.status(400).json({ error: "Не указан name"} )
                return;
            }

            if (!req.body.refferal){
                res.status(400).json({ error: "Не указан name"} )
                return;
            }

            const { tgId, clan_id, refferal } = req.body

            try {
                let clan_title = await db.getClanName(clan_id)
                if (clan_title) {
                    clan_title = clan_title['title']
                    await db.setUserClan(tgId, clan_title)
                    const user = await db.getUser(tgId)
                    const ref = await db.getUser(refferal)
                    if (user) {
                        if (ref) {
                            if (user.f_clan === 0) {
                                await db.setUserScore(tgId, user.score + 100000)
                                await db.setUserScore(ref.tgid, ref.score + 100000)
                                await db.checkFClan(tgId)
                                console.log("here")
                            }
                        }
                    }
                }
                
                res.status(200).send({msg: "OK"})
            } catch (e) {
                console.log(e)
                res.status(400).send({error: "Ошибка в добавлении пользователя"})    
            }

        } catch (e) {
            console.log(e)
            res.status(400).send({error: "Ошибка в добавлении пользователя"})
        }
    },

    async checkMR (req, res) {
        try {
            if ((!req.body.url) && (req.body.url !== '')){
                res.status(400).json({ error: "Не указан url"} )
                return;
            }

            const { url } = req.body

            try {
                const mr = await db.getMRUser("@" + url)
                res.status(200).send({msg: mr})
            } catch (e) {
                console.log(e)
                res.status(400).send({error: "Ошибка в добавлении пользователя"})    
            }

        } catch (e) {
            console.log(e)
            res.status(400).send({error: "Ошибка в добавлении пользователя"})
        }
    },

    async checkGameEnd (req, res) {
        try {
            
            let sum = await db.getUsersSum()
            if (sum) {
                sum = parseInt(sum[0]['sum'])
                if (sum >= 100000000000) {
                    const info = await db.getWonBand()
                    res.status(200).send({
                        msg: true,
                        sum: info['sum'],
                        band: info['band']
                    })
                } else {
                    res.status(200).send({msg: false})
                }
            }

        } catch (e) {
            console.log(e)
            res.status(400).send({error: "Ошибка в добавлении пользователя"})
        }
    },

}