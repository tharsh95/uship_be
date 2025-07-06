import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import cors from 'cors';

const prisma = new PrismaClient();
const app = express();

// CORS middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4173',
    'https://your-frontend-domain.com', // Add your production frontend URL
    '*' // Allow all origins for now - you can restrict this later
  ],
  credentials: true
}));

// JWT middleware
app.use((req, res, next) => {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const token = auth.split(' ')[1];
      const user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      (req as any).user = user;
    } catch (e) {
      // Invalid token, ignore
    }
  }
  next();
});

async function startServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => ({ req, prisma, user: (req as any).user }),
    persistedQueries: false
  });
  await server.start();
  server.applyMiddleware({ app: app as any });

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
  });
}

startServer(); 