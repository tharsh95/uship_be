import DataLoader from 'dataloader';
import { PrismaClient } from '@prisma/client';
import { GraphQLResolveInfo } from 'graphql';

// DataLoader for preventing N+1 queries
class EmployeeDataLoader {
  private static instance: EmployeeDataLoader;
  private employeeLoader: DataLoader<number, any>;
  private employeeByEmailLoader: DataLoader<string, any>;

  private constructor(prisma: PrismaClient) {
    this.employeeLoader = new DataLoader(async (ids: readonly number[]) => {
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

    this.employeeByEmailLoader = new DataLoader(async (emails: readonly string[]) => {
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

  static getInstance(prisma: PrismaClient): EmployeeDataLoader {
    if (!EmployeeDataLoader.instance) {
      EmployeeDataLoader.instance = new EmployeeDataLoader(prisma);
    }
    return EmployeeDataLoader.instance;
  }

  load(id: number) {
    return this.employeeLoader.load(id);
  }

  loadByEmail(email: string) {
    return this.employeeByEmailLoader.load(email);
  }

  clear(id?: number) {
    if (id) {
      this.employeeLoader.clear(id);
    } else {
      this.employeeLoader.clearAll();
    }
  }
}

// Query complexity analysis
class QueryComplexityAnalyzer {
  private static complexityRules = {
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

  static calculateComplexity(info: GraphQLResolveInfo): number {
    let complexity = 0;
    const maxComplexity = 1000; // Adjust based on your needs

    const calculateFieldComplexity = (fieldName: string, parentType: string): number => {
      const rules = this.complexityRules[parentType as keyof typeof this.complexityRules];
      return rules?.[fieldName as keyof typeof rules] || 1;
    };

    const traverse = (selections: readonly any[], parentType: string): number => {
      let fieldComplexity = 0;

      for (const selection of selections) {
        if (selection.kind === 'Field') {
          const fieldComplexityValue = calculateFieldComplexity(selection.name.value, parentType);
          fieldComplexity += fieldComplexityValue;

          if (selection.selectionSet) {
            fieldComplexity += traverse(selection.selectionSet.selections, selection.name.value);
          }
        } else if (selection.kind === 'InlineFragment') {
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

// Response optimization utilities
class ResponseOptimizer {
  // Remove null/undefined values from response
  static cleanResponse(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.cleanResponse(item)).filter(item => item !== null);
    }

    if (typeof data === 'object') {
      const cleaned: any = {};
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
  static optimizeFieldSelection(info: GraphQLResolveInfo): string[] {
    const fields: string[] = [];
    
    const extractFields = (selections: readonly any[]) => {
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

// Caching middleware for GraphQL responses
class GraphQLCache {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  static set(key: string, data: any, ttl: number = 300000): void { // 5 minutes default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  static get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  static generateKey(operation: string, variables: any): string {
    return `${operation}_${JSON.stringify(variables)}`;
  }

  static clear(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  static getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses for accurate rate
    };
  }
}

// Performance monitoring for GraphQL operations
class GraphQLPerformanceMonitor {
  private static operationTimes: Map<string, number[]> = new Map();
  private static slowOperationThreshold = 500; // 500ms

  static startOperation(operationName: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.recordOperationTime(operationName, duration);
      
      if (duration > this.slowOperationThreshold) {
        console.warn(`🐌 Slow GraphQL operation: ${operationName} took ${duration.toFixed(2)}ms`);
      }
    };
  }

  private static recordOperationTime(operationName: string, duration: number): void {
    if (!this.operationTimes.has(operationName)) {
      this.operationTimes.set(operationName, []);
    }
    this.operationTimes.get(operationName)!.push(duration);
  }

  static getOperationStats(): Record<string, { avg: number; count: number; max: number }> {
    const stats: Record<string, { avg: number; count: number; max: number }> = {};
    
    for (const [operationName, times] of this.operationTimes.entries()) {
      const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
      const max = Math.max(...times);
      stats[operationName] = { avg, count: times.length, max };
    }
    
    return stats;
  }
}

export {
  EmployeeDataLoader,
  QueryComplexityAnalyzer,
  ResponseOptimizer,
  GraphQLCache,
  GraphQLPerformanceMonitor,
}; 