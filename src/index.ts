import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import { 
  performanceMiddleware, 
  healthCheck, 
  performanceMetrics, 
  getOptimizationRecommendations 
} from './performance/monitoring';
import { prisma } from './performance/databaseOptimizer';
const app = express();

// Security and performance middleware
app.use(helmet());
app.use(compression());
app.use(performanceMiddleware);

// CORS middleware
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Performance monitoring endpoints
app.get('/health', healthCheck);
app.get('/metrics', performanceMetrics);
app.get('/recommendations', getOptimizationRecommendations);

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