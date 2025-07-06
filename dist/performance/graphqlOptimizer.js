"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQLPerformanceMonitor = exports.GraphQLCache = exports.ResponseOptimizer = exports.QueryComplexityAnalyzer = exports.EmployeeDataLoader = void 0;
const dataloader_1 = __importDefault(require("dataloader"));
// DataLoader for preventing N+1 queries
class EmployeeDataLoader {
    constructor(prisma) {
        this.employeeLoader = new dataloader_1.default(async (ids) => {
            const employees = await prisma.employee.findMany({
                where: { id: { in: [...ids] } },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    age: true,
                    department: true,
                    position: true,
                    salary: true,
                    class: true,
                    subjects: true,
                    attendance: true,
                    avatar: true,
                    phone: true,
                    address: true,
                    startDate: true,
                    status: true,
                    role: true,
                },
            });
            // Return employees in the same order as requested IDs
            const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
            return ids.map(id => employeeMap.get(id) || null);
        });
        this.employeeByEmailLoader = new dataloader_1.default(async (emails) => {
            const employees = await prisma.employee.findMany({
                where: { email: { in: [...emails] } },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    age: true,
                    department: true,
                    position: true,
                    salary: true,
                    class: true,
                    subjects: true,
                    attendance: true,
                    avatar: true,
                    phone: true,
                    address: true,
                    startDate: true,
                    status: true,
                    role: true,
                },
            });
            const employeeMap = new Map(employees.map(emp => [emp.email, emp]));
            return emails.map(email => employeeMap.get(email) || null);
        });
    }
    static getInstance(prisma) {
        if (!EmployeeDataLoader.instance) {
            EmployeeDataLoader.instance = new EmployeeDataLoader(prisma);
        }
        return EmployeeDataLoader.instance;
    }
    load(id) {
        return this.employeeLoader.load(id);
    }
    loadByEmail(email) {
        return this.employeeByEmailLoader.load(email);
    }
    clear(id) {
        if (id) {
            this.employeeLoader.clear(id);
        }
        else {
            this.employeeLoader.clearAll();
        }
    }
}
exports.EmployeeDataLoader = EmployeeDataLoader;
// Query complexity analysis
class QueryComplexityAnalyzer {
    static calculateComplexity(info) {
        let complexity = 0;
        const maxComplexity = 1000; // Adjust based on your needs
        const calculateFieldComplexity = (fieldName, parentType) => {
            const rules = this.complexityRules[parentType];
            return rules?.[fieldName] || 1;
        };
        const traverse = (selections, parentType) => {
            let fieldComplexity = 0;
            for (const selection of selections) {
                if (selection.kind === 'Field') {
                    const fieldComplexityValue = calculateFieldComplexity(selection.name.value, parentType);
                    fieldComplexity += fieldComplexityValue;
                    if (selection.selectionSet) {
                        fieldComplexity += traverse(selection.selectionSet.selections, selection.name.value);
                    }
                }
                else if (selection.kind === 'InlineFragment') {
                    fieldComplexity += traverse(selection.selectionSet.selections, parentType);
                }
            }
            return fieldComplexity;
        };
        complexity = traverse(info.fieldNodes[0].selectionSet?.selections || [], info.parentType.name);
        if (complexity > maxComplexity) {
            throw new Error(`Query complexity (${complexity}) exceeds maximum allowed (${maxComplexity})`);
        }
        return complexity;
    }
}
exports.QueryComplexityAnalyzer = QueryComplexityAnalyzer;
QueryComplexityAnalyzer.complexityRules = {
    Query: {
        employees: 1,
        employee: 1,
    },
    Mutation: {
        addEmployee: 10,
        updateEmployee: 5,
        deleteEmployee: 5,
        login: 1,
        register: 10,
        resendPasswordEmail: 5,
    },
    Employee: {
        id: 0,
        name: 0,
        email: 0,
        age: 0,
        department: 0,
        position: 0,
        salary: 0,
        class: 0,
        subjects: 0,
        attendance: 0,
        avatar: 0,
        phone: 0,
        address: 0,
        startDate: 0,
        status: 0,
        role: 0,
    },
};
// Response optimization utilities
class ResponseOptimizer {
    // Remove null/undefined values from response
    static cleanResponse(data) {
        if (data === null || data === undefined) {
            return data;
        }
        if (Array.isArray(data)) {
            return data.map(item => this.cleanResponse(item)).filter(item => item !== null);
        }
        if (typeof data === 'object') {
            const cleaned = {};
            for (const [key, value] of Object.entries(data)) {
                const cleanedValue = this.cleanResponse(value);
                if (cleanedValue !== null && cleanedValue !== undefined) {
                    cleaned[key] = cleanedValue;
                }
            }
            return cleaned;
        }
        return data;
    }
    // Optimize field selection based on query
    static optimizeFieldSelection(info) {
        const fields = [];
        const extractFields = (selections) => {
            for (const selection of selections) {
                if (selection.kind === 'Field') {
                    fields.push(selection.name.value);
                    if (selection.selectionSet) {
                        extractFields(selection.selectionSet.selections);
                    }
                }
            }
        };
        if (info.fieldNodes[0].selectionSet) {
            extractFields(info.fieldNodes[0].selectionSet.selections);
        }
        return fields;
    }
}
exports.ResponseOptimizer = ResponseOptimizer;
// Caching middleware for GraphQL responses
class GraphQLCache {
    static set(key, data, ttl = 300000) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });
    }
    static get(key) {
        const cached = this.cache.get(key);
        if (!cached)
            return null;
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }
        return cached.data;
    }
    static generateKey(operation, variables) {
        return `${operation}_${JSON.stringify(variables)}`;
    }
    static clear(pattern) {
        if (pattern) {
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
        }
        else {
            this.cache.clear();
        }
    }
    static getStats() {
        return {
            size: this.cache.size,
            hitRate: 0, // Would need to track hits/misses for accurate rate
        };
    }
}
exports.GraphQLCache = GraphQLCache;
GraphQLCache.cache = new Map();
// Performance monitoring for GraphQL operations
class GraphQLPerformanceMonitor {
    static startOperation(operationName) {
        const startTime = performance.now();
        return () => {
            const duration = performance.now() - startTime;
            this.recordOperationTime(operationName, duration);
            if (duration > this.slowOperationThreshold) {
                console.warn(`🐌 Slow GraphQL operation: ${operationName} took ${duration.toFixed(2)}ms`);
            }
        };
    }
    static recordOperationTime(operationName, duration) {
        if (!this.operationTimes.has(operationName)) {
            this.operationTimes.set(operationName, []);
        }
        this.operationTimes.get(operationName).push(duration);
    }
    static getOperationStats() {
        const stats = {};
        for (const [operationName, times] of this.operationTimes.entries()) {
            const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
            const max = Math.max(...times);
            stats[operationName] = { avg, count: times.length, max };
        }
        return stats;
    }
}
exports.GraphQLPerformanceMonitor = GraphQLPerformanceMonitor;
GraphQLPerformanceMonitor.operationTimes = new Map();
GraphQLPerformanceMonitor.slowOperationThreshold = 500; // 500ms
