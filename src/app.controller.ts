import { Body, Controller, Query, Post, Get, Param, Res } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { CreateClient } from './dto/create-clientes';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor(private prisma: PrismaService) {}

  @Post('cadastro')
  async cadastro(@Body() body: CreateClient, @Res() res: Response) {
    try {
      const { name, password, email } = body;

      if (!name || !password || !email) {
        return res.status(400).json({ message: 'Nome, email e senha são obrigatórios' });
      }

      const existingClient = await this.prisma.client.findUnique({
        where: { email },
      });

      if (existingClient) {
        return res.status(400).json({ message: 'E-mail já cadastrado' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const client = await this.prisma.client.create({
        data: {
          name,
          password: hashedPassword,
          email,
        },
      });

      return res.status(201).json({
        message: 'Cliente cadastrado com sucesso!',
        client: { id: client.id, name: client.name, email: client.email },
      });
    } catch (error) {
      return res.status(500).json({ message: 'Erro ao cadastrar cliente' });
    }
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }, @Res() res: Response) {
    try {
      const { email, password } = body;

      const client = await this.prisma.client.findUnique({
        where: { email },
      });

      if (!client) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      const isPasswordValid = await bcrypt.compare(password, client.password);

      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Senha incorreta' });
      }

      return res.status(200).json({
        message: 'Login bem-sucedido!',
        client: { id: client.id, name: client.name, email: client.email },
      });
    } catch (error) {
      return res.status(500).json({ message: 'Erro no login' });
    }
  }

  @Post('favoritos')
  async addFavorite(
    @Body() body: { clientId: string; recipeId: string },
    @Res() res: Response,
  ) {
    try {
      const { clientId, recipeId } = body;

      if (!clientId) {
        return res.status(400).json({ message: 'clientId é obrigatório' });
      }
      if (!recipeId) {
        return res.status(400).json({ message: 'recipeId é obrigatório' });
      }

      const client = await this.prisma.client.findUnique({
        where: { id: clientId },
      });
      if (!client) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      const recipe = await this.prisma.recipe.findUnique({
        where: { id: recipeId },
      });
      if (!recipe) {
        return res.status(404).json({ message: 'Receita não encontrada' });
      }

      const existingFavorite = await this.prisma.favorite.findFirst({
        where: {
          clientId: clientId,
          recipeId: recipeId,
        },
      });

      if (existingFavorite) {
        return res.status(400).json({ message: 'Esta receita já está nos favoritos' });
      }

      const favorite = await this.prisma.favorite.create({
        data: {
          clientId: clientId,
          recipeId: recipeId,
        },
      });

      return res.status(201).json({
        message: 'Receita adicionada aos favoritos com sucesso!',
        favorite,
      });
    } catch (error) {
      return res.status(500).json({ message: 'Erro ao adicionar favorito', error: error.message });
    }
  }

  @Get('favoritos/:clientId')
async getFavoritesByUser(@Param('clientId') clientId: string, @Res() res: Response) {
  try {
    const favorites = await this.prisma.favorite.findMany({
      where: {
        clientId: clientId,
      },
      include: {
        recipe: true,
      },
    });

    if (favorites.length === 0) {
      return res.status(200).json({
        message: 'Nenhum favorito encontrado para este usuário.',
        favorites: [],
      });
    }
    return res.status(200).json({
      message: 'Favoritos encontrados',
      favorites,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao buscar favoritos' });
  }
}


  @Get('favoritos/ids/:clientId')
async getFavoriteRecipeIds(@Param('clientId') clientId: string, @Res() res: Response) {
  try {
    const favoriteRecipes = await this.prisma.favorite.findMany({
      where: {
        clientId: clientId,
      },
      select: {
        recipeId: true,
      },
    });

    if (favoriteRecipes.length === 0) {
      return res.status(404).json({ message: 'Nenhum favorito' });
    }

    const recipeIds = favoriteRecipes.map(favorite => favorite.recipeId);

    return res.status(200).json({
      message: 'IDs das receitas favoritas encontrados',
      recipeIds,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro' });
  }
}

  
  
@Get('receitas')
async getPaginatedRecipes(
  @Query('take') take: string = '5',
  @Query('skip') skip: string = '0',
  @Query('userId') userId: string,
  @Res() res: Response
) {
  try {
    const recipes = await this.prisma.recipe.findMany({
      skip: parseInt(skip, 10),
      take: parseInt(take, 10),
      where: {
        favorites: {
          none: {
            clientId: userId,
          },
        },
      },
    });

    const totalRecipes = await this.prisma.recipe.count({
      where: {
        favorites: {
          none: {
            clientId: userId,
          },
        },
      },
    });

    const totalPages = Math.ceil(totalRecipes / parseInt(take, 10));

    return res.status(200).json({
      message: 'Receitas encontradas',
      recipes,
      skip: parseInt(skip, 10),
      take: parseInt(take, 10),
      totalPages,
      totalRecipes,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao buscar receitas' });
  }
}

  

  @Post('receitas')
  async createRecipe(@Body() body: { content: string; clientId: string }, @Res() res: Response) {
    try {
      const { content, clientId } = body;

      if (!content || !clientId) {
        return res.status(400).json({ message: 'Conteúdo e clientId são obrigatórios' });
      }

      const recipe = await this.prisma.recipe.create({
        data: {
          content,
          client: {
            connect: { id: clientId },
          },
        },
      });

      return res.status(201).json({
        message: 'Receita criada com sucesso!',
        recipe,
      });
    } catch (error) {
      return res.status(500).json({ message: 'Erro ao criar receita' });
    }
  }
}
