import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z, ZodError } from 'zod';

const prisma = new PrismaClient();

const createMatchSchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Data inválida (use ISO format, ex: 2025-10-20T15:00:00Z)' }),
  teamA: z.string().min(1, 'Time A é obrigatório'),
  teamB: z.string().min(1, 'Time B é obrigatório'),
  sectors: z.array(z.object({
    sectorId: z.number().int().positive('ID do setor inválido'),
    price: z.number().positive('Preço deve ser maior que zero'),
  })).min(1, 'Pelo menos um setor deve ser definido'),
});

const buyTicketSchema = z.object({
  matchId: z.number().int().positive('ID da partida inválido'),
  sectorId: z.number().int().positive('ID do setor inválido'),
});

export const createMatch = async (req: Request, res: Response) => {
  try {
    const { date, teamA, teamB, sectors } = createMatchSchema.parse(req.body);
    const matchDate = new Date(date);

    // Verificar se todos os setores existem
    const sectorIds = sectors.map(s => s.sectorId);
    const existingSectors = await prisma.sector.findMany({
      where: { id: { in: sectorIds } },
    });

    if (existingSectors.length !== sectorIds.length) {
      return res.status(400).json({ error: 'Um ou mais setores não existem' });
    }

    const match = await prisma.match.create({
      data: {
        date: matchDate,
        teamA,
        teamB,
        matchSectors: {
          create: sectors.map(s => ({
            sectorId: s.sectorId,
            price: s.price,
          })),
        },
      },
      include: {
        matchSectors: {
          include: {
            sector: true,
          },
        },
      },
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

export const getMatchById = async (req: Request, res: Response) => {
  const matchId = parseInt(req.params.matchId);
  if (isNaN(matchId)) {
    return res.status(400).json({ error: 'ID da partida inválido' });
  }

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        matchSectors: {
          include: {
            sector: true,
          },
        },
      },
    });

    if (!match) {
      return res.status(404).json({ error: 'Partida não encontrada' });
    }

    const ticketsBySector = await prisma.ticket.groupBy({
      by: ['sectorId'],
      where: { matchId: matchId },
      _count: true,
    });

    const ticketsMap = new Map(
      ticketsBySector.map(t => [t.sectorId, t._count])
    );

    const sectorsStatus = match.matchSectors.map(ms => ({
      id: ms.sector.id,
      name: ms.sector.name,
      price: parseFloat(ms.price.toString()),
      soldOut: (ticketsMap.get(ms.sectorId) || 0) >= ms.sector.capacity,
    }));

    res.json({
      id: match.id,
      date: match.date,
      location: match.location,
      teamA: match.teamA,
      teamB: match.teamB,
      sectors: sectorsStatus,
    });
  } catch (err) {
    console.error('Erro em getMatchById:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const buyTicket = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { matchId, sectorId } = buyTicketSchema.parse(req.body);

    const matchSector = await prisma.matchSector.findUnique({
      where: {
        matchId_sectorId: {
          matchId: matchId,
          sectorId: sectorId,
        },
      },
      include: {
        match: true,
        sector: true,
      },
    });

    if (!matchSector) {
      return res.status(404).json({ error: 'Partida ou setor não encontrado para esta partida' });
    }

    // Verificar quantos ingressos já foram vendidos
    const soldTickets = await prisma.ticket.count({
      where: {
        matchId: matchId,
        sectorId: sectorId,
      },
    });

    if (soldTickets >= matchSector.sector.capacity) {
      return res.status(400).json({ error: 'Setor esgotado para esta partida' });
    }

    const ticket = await prisma.ticket.create({
      data: {
        userId,
        sectorId,
        matchId,
      },
      include: {
        match: true,
        sector: true,
      },
    });

    res.status(201).json({
      message: 'Ingresso comprado com sucesso',
      ticket: {
        ...ticket,
        price: Number(matchSector.price),
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.issues });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};