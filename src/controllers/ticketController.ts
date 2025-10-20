import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z, ZodError } from 'zod';

const prisma = new PrismaClient();

const createMatchSchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Data inválida (use ISO format, ex: 2025-10-20T15:00:00Z)' }),
  teamA: z.string().min(1, 'Time A é obrigatório'),
  teamB: z.string().min(1, 'Time B é obrigatório'),
});

const buyTicketSchema = z.object({
  matchId: z.coerce.number().int().positive('ID da partida inválido'),
  sectorId: z.coerce.number().int().positive('ID do setor inválido'),
});

export const createMatch = async (req: Request, res: Response) => {
  try {
    const { date, teamA, teamB } = createMatchSchema.parse(req.body);
    const matchDate = new Date(date);

    const match = await prisma.match.create({
      data: { date: matchDate, teamA, teamB },
    });

    res.status(201).json({ message: 'Partida criada com sucesso', match });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.issues });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const listMatches = async (req: Request, res: Response) => {
  try {
    const matches = await prisma.match.findMany({
      select: { id: true, date: true, location: true, teamA: true, teamB: true },
    });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const listSectors = async (req: Request, res: Response) => {
  try {
    const sectors = await prisma.sector.findMany({
      select: { id: true, name: true, capacity: true },
    });
    res.json(sectors);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const getAvailability = async (req: Request, res: Response) => {
  const matchId = parseInt(req.params.matchId);
  if (isNaN(matchId)) {
    return res.status(400).json({ error: 'ID da partida inválido' });
  }

  try {
    const sectors = await prisma.sector.findMany({
      include: {
        tickets: {
          where: { matchId: matchId },
        },
      },
    });

    const availability = sectors.map(sector => ({
      id: sector.id,
      name: sector.name,
      capacity: sector.capacity,
      sold: sector.tickets.length,
      available: sector.capacity - sector.tickets.length,
    }));

    res.json(availability);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const buyTicket = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { matchId, sectorId } = buyTicketSchema.parse(req.body);

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      return res.status(404).json({ error: 'Partida não encontrada' });
    }

    const sector = await prisma.sector.findUnique({
      where: { id: sectorId },
      include: {
        tickets: {
          where: { matchId: matchId },
        },
      },
    });
    if (!sector) {
      return res.status(404).json({ error: 'Setor não encontrado' });
    }

    if (sector.tickets.length >= sector.capacity) {
      return res.status(400).json({ error: 'Setor esgotado para esta partida' });
    }

    const ticket = await prisma.ticket.create({
      data: {
        userId,
        sectorId,
        matchId,
      },
    });

    res.status(201).json({ message: 'Ingresso comprado com sucesso', ticket });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.issues });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};