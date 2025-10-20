import express from 'express';
import { autenticateJWT } from '../middlewares/auth';
import { createMatch, listMatches, listSectors, getAvailability, buyTicket, getMatchById } from '../controllers/ticketController';

const router = express.Router();

// Rotas públicas
router.get('/matches', listMatches);
router.get('/matches/:matchId', getMatchById);
router.get('/sectors', listSectors);
// router.get('/availability/:matchId', getAvailability); Rota pra mostrar se um setor está disponível

// Rotas protegidas (requer autenticação JWT)
router.post('/matches', autenticateJWT, createMatch);
router.post('/buy', autenticateJWT, buyTicket);

export default router;