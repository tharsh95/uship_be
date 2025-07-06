"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const apollo_server_express_1 = require("apollo-server-express");
const schema_1 = require("./schema");
const resolvers_1 = require("./resolvers");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const helmet_1 = __importDefault(require("helmet"));
const monitoring_1 = require("./performance/monitoring");
const databaseOptimizer_1 = require("./performance/databaseOptimizer");
const app = (0, express_1.default)();
// Security and performance middleware
app.use((0, helmet_1.default)());
app.use((0, compression_1.default)());
app.use(monitoring_1.performanceMiddleware);
// CORS middleware
app.use((0, cors_1.default)({
    origin: true, // Allow all origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Performance monitoring endpoints
app.get('/health', monitoring_1.healthCheck);
app.get('/metrics', monitoring_1.performanceMetrics);
app.get('/recommendations', monitoring_1.getOptimizationRecommendations);
// JWT middleware
app.use((req, res, next) => {
    const auth = req.headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
        try {
            const token = auth.split(' ')[1];
            const user = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
            req.user = user;
        }
        catch (e) {
            // Invalid token, ignore
        }
    }
    next();
});
async function startServer() {
    const server = new apollo_server_express_1.ApolloServer({
        typeDefs: schema_1.typeDefs,
        resolvers: resolvers_1.resolvers,
        context: ({ req }) => ({ req, prisma: databaseOptimizer_1.prisma, user: req.user }),
        persistedQueries: false
    });
    await server.start();
    server.applyMiddleware({ app: app });
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
    });
}
startServer();
