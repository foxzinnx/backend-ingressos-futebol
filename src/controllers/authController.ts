import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z, ZodError } from 'zod';

const prisma = new PrismaClient();

const registerSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
    name: z.string().min(3, 'Nome é obrigatório'),
})

const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'Senha é obrigatória'),
})

export const register = async (req: Request, res: Response) => {
    const { email, password, name } = registerSchema.parse(req.body);
    try {
        const existingUser = await prisma.user.findUnique({ where: { email }});
        if(existingUser){
            return res.status(400).json({ error: 'Email já está em uso'});
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await prisma.user.create({data: { email, password: hashedPassword, name}});

        res.status(201).json({ message: 'Conta criada com sucesso!'});
    } catch (err) {
        if(err instanceof z.ZodError){
            return res.status(400).json({ error: err.issues })
        }
        return res.status(500).json({ error: 'Erro interno do servidor'});
    }
}

export const login = async(req: Request, res: Response) => {
    const { email, password } = loginSchema.parse(req.body);

    try {
        const user = await prisma.user.findUnique({ where: { email }});
        if(!user || !(await bcrypt.compare(password, user.password))){
            return res.status(401).json({ error: 'Credenciais inválidas'});
        };

        const accessToken = jwt.sign(
            {userId: user.id},
            process.env.JWT_SECRET as string,
            {expiresIn: '1h'}
        );

        res.json({ accessToken });
    } catch (err) {
        if(err instanceof z.ZodError){
            return res.status(400).json({ error: err.issues});
        }
        res.status(500).json({ error: 'Erro interno do servidor'});
    }
}