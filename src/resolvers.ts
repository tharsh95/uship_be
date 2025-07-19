import { PrismaClient, Role } from '@prisma/client';
import { GraphQLResolveInfo } from 'graphql';
import { AuthenticationError, ForbiddenError } from 'apollo-server-express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { emailService } from './emailService';
import { 
  OptimizedQueryBuilder, 
  QueryPerformanceMonitor,
  DatabaseHealthCheck
} from './performance/databaseOptimizer';
import { 
  EmployeeDataLoader,
  QueryComplexityAnalyzer,
  ResponseOptimizer,
  GraphQLCache,
  GraphQLPerformanceMonitor
} from './performance/graphqlOptimizer';
import { prisma } from './performance/databaseOptimizer';

function parseSubjects(subjects: string): string[] {
  try {
    return JSON.parse(subjects);
  } catch {
    return [];
  }
}

function stringifySubjects(subjects: string[]): string {
  return JSON.stringify(subjects);
}

export const resolvers = {
  Query: {
    employees: async (_parent: any, args: any, context: any) => {
      if (!context.user) throw new AuthenticationError('Not authenticated');
      if (context.user.role === 'EMPLOYEE') {
        // Only return the logged-in employee
        const employee = await context.prisma.employee.findUnique({ where: { id: context.user.id } });
        if (!employee) return { employees: [], totalCount: 0 };
        return {
          employees: [{
            ...employee,
            subjects: parseSubjects(employee.subjects),
            startDate: employee.startDate ? Math.floor(employee.startDate.getTime() / 1000) : null
          }],
          totalCount: 1
        };
      }
      if (context.user.role !== 'ADMIN') throw new ForbiddenError('Not authorized');
      const { page = 1, pageSize = 10, sortBy = 'id', sortOrder = 'asc', filter = '' } = args;
      const skip = (page - 1) * pageSize;
      const where = filter
        ? {
            OR: [
              { name: { contains: filter } },
              { class: { contains: filter } },
              { department: { contains: filter } },
              { position: { contains: filter } },
            ],
          }
        : {};
      const [employees, totalCount] = await Promise.all([
        context.prisma.employee.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
        }),
        context.prisma.employee.count({ where }),
      ]);
      return {
        employees: employees.map((e: any) => ({ 
          ...e, 
          subjects: parseSubjects(e.subjects),
          startDate: e.startDate ? Math.floor(e.startDate.getTime() / 1000) : null
        })),
        totalCount,
      };
    },
    employee: async (_parent: any, { id }: { id: number }, context: any) => {
      if (!context.user) throw new AuthenticationError('Not authenticated');
      if (context.user.role === 'EMPLOYEE') {
        // Always return the logged-in employee's details
        id = context.user.id;
      } else if (context.user.role !== 'ADMIN' && context.user.id !== id) {
        throw new ForbiddenError('Not authorized');
      }
      const employee = await context.prisma.employee.findUnique({ where: { id: +id } });
      if (!employee) return null;
      return {
        ...employee,
        subjects: parseSubjects(employee.subjects),
        startDate: employee.startDate ? Math.floor(employee.startDate.getTime() / 1000) : null
      };
    },
  },
  Mutation: {
    addEmployee: async (_parent: any, args: any, context: any) => {
      if (!context.user) throw new AuthenticationError('Not authenticated');
      if (context.user.role !== 'ADMIN') throw new ForbiddenError('Not authorized');
      if (!args.name || args.name.trim() === "") {
        throw new Error("Name cannot be empty");
      }
      if (!args.email || args.email.trim() === "") {
        throw new Error("Email cannot be empty");
      }
      const { 
        name, age, class: className, subjects, attendance, role = Role.EMPLOYEE,
        email, department, position, salary, avatar, phone, address, startDate, status = 'active'
      } = args;
      // Generate a random plain password
      const plainPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      console.log(`Generated password for ${email || name}:`, plainPassword);
      
      const employee = await context.prisma.employee.create({
        data: {
          name,
          email,
          age,
          department,
          position,
          salary,
          class: className,
          subjects: stringifySubjects(subjects),
          attendance,
          avatar,
          phone,
          address,
          startDate: startDate ? new Date(startDate * 1000) : null,
          status,
          role,
          password: hashedPassword,
        },
      });

      // Send email with credentials if email is provided
      console.log(email)
      if (email) {
        try {
          const emailSent = await emailService.sendPasswordEmail(name, email, plainPassword);
          if (emailSent) {
            console.log(`Password email sent successfully to ${email}`);
          } else {
            console.error(`Failed to send password email to ${email}`);
          }
        } catch (error) {
          console.error('Error sending password email:', error);
          // Don't throw error to avoid breaking the employee creation
        }
      } else {
        console.log(`No email provided for ${name}, skipping email notification`);
      }

      return { 
        ...employee, 
        subjects,
        startDate: employee.startDate ? Math.floor(employee.startDate.getTime() / 1000) : null
      };
    },
    updateEmployee: async (_parent: any, args: any, context: any) => {
      if (!context.user) throw new AuthenticationError('Not authenticated');
      if (context.user.role !== 'ADMIN') throw new ForbiddenError('Not authorized');
      const { 
        id, subjects, startDate, ...rest 
      } = args;
      const data: any = { ...rest };
      if (subjects) data.subjects = stringifySubjects(subjects);
      if (startDate) data.startDate = new Date(startDate * 1000);
      const employee = await context.prisma.employee.update({
        where: { id: Number(id) },
        data,
      });
      return { 
        ...employee, 
        subjects: subjects || parseSubjects(employee.subjects),
        startDate: employee.startDate ? Math.floor(employee.startDate.getTime() / 1000) : null
      };
    },
    deleteEmployee: async (_parent: any, { id }: { id: number }, context: any) => {
      if (!context.user) throw new AuthenticationError('Not authenticated');
      if (context.user.role !== 'ADMIN') throw new ForbiddenError('Not authorized');
      await context.prisma.employee.delete({ where: { id } });
      return true;
    },
    login: async (_parent: any, { email, password }: { email: string, password: string }, context: any) => {
      const employee = await context.prisma.employee.findUnique({ where: { email } });
      if (!employee) throw new AuthenticationError('Invalid credentials');
      const valid = await bcrypt.compare(password, employee.password);
      if (!valid) throw new AuthenticationError('Invalid credentials');
      const token = jwt.sign({ id: employee.id, role: employee.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
      return { 
        token, 
        employee: { 
          ...employee, 
          subjects: parseSubjects(employee.subjects),
          startDate: employee.startDate ? Math.floor(employee.startDate.getTime() / 1000) : null
        } 
      };
    },
    register: async (_parent: any, args: any, context: any) => {
      const { 
        name, age, class: className, subjects, attendance, password, role = 'EMPLOYEE',
        email, department, position, salary, avatar, phone, address, startDate, status = 'active'
      } = args;
      const hashedPassword = await bcrypt.hash(password, 10);
      const employee = await context.prisma.employee.create({
        data: {
          name,
          email,
          age,
          department,
          position,
          salary,
          class: className,
          subjects: stringifySubjects(subjects),
          attendance,
          avatar,
          phone,
          address,
          startDate: startDate ? new Date(startDate * 1000) : null,
          status,
          role,
          password: hashedPassword,
        },
      });
      return { 
        ...employee, 
        subjects,
        startDate: employee.startDate ? Math.floor(employee.startDate.getTime() / 1000) : null
      };
    },
    resendPasswordEmail: async (_parent: any, { employeeId }: { employeeId: string }, context: any) => {
      if (!context.user) throw new AuthenticationError('Not authenticated');
      if (context.user.role !== 'ADMIN') throw new ForbiddenError('Not authorized');
      
      const employee = await context.prisma.employee.findUnique({ 
        where: { id: parseInt(employeeId) } 
      });
      
      if (!employee) {
        throw new Error('Employee not found');
      }
      
      if (!employee.email) {
        throw new Error('Employee does not have an email address');
      }
      
      // Generate a new temporary password
      const newPlainPassword = Math.random().toString(36).slice(-8);
      const newHashedPassword = await bcrypt.hash(newPlainPassword, 10);
      
      // Update the employee's password
      await context.prisma.employee.update({
        where: { id: parseInt(employeeId) },
        data: { password: newHashedPassword },
      });
      
      // Send the new password via email
      try {
        const emailSent = await emailService.sendPasswordEmail(
          employee.name, 
          employee.email, 
          newPlainPassword
        );
        
        if (emailSent) {
          console.log(`Password reset email sent successfully to ${employee.email}`);
          return true;
        } else {
          console.error(`Failed to send password reset email to ${employee.email}`);
          return false;
        }
      } catch (error) {
        console.error('Error sending password reset email:', error);
        return false;
      }
    },
  },
}; 