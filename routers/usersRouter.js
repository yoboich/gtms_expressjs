const Router = require('express')
const router = new Router()
const controller = require('../controllers/usersController')
const bodyParser = require('body-parser')

router.post('/', bodyParser.json(), controller.addUser)
router.post('/set_clan', bodyParser.json(), controller.setUserClan)
router.post('/check_mr', bodyParser.json(), controller.checkMR)
router.get('/game_ended', bodyParser.json(), controller.checkGameEnd)
 

module.exports = router
