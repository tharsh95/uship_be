"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const apollo_server_express_1 = require("apollo-server-express");
const schema_1 = require("./schema");
const resolvers_1 = require("./resolvers");
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
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
        context: ({ req }) => ({ req, prisma, user: req.user })
    });
    await server.start();
    server.applyMiddleware({ app: app });
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
    });
}
startServer();
