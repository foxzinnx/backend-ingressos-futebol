import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import AuthRoutes from './routes/auth';
import TicketsRoutes from './routes/tickets';

dotenv.config();
const app = express();
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use('/api/auth', AuthRoutes);
app.use('/api', TicketsRoutes);

app.listen(process.env.PORT || 3000, () => console.log(`Servidor rodando na porta ${process.env.PORT || 3000}`));