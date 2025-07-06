"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvers = void 0;
const client_1 = require("@prisma/client");
const apollo_server_express_1 = require("apollo-server-express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const emailService_1 = require("./emailService");
const prisma = new client_1.PrismaClient();
function parseSubjects(subjects) {
    try {
        return JSON.parse(subjects);
    }
    catch {
        return [];
    }
}
function stringifySubjects(subjects) {
    return JSON.stringify(subjects);
}
exports.resolvers = {
    Query: {
        employees: async (_parent, args, context) => {
            if (!context.user)
                throw new apollo_server_express_1.AuthenticationError('Not authenticated');
            if (context.user.role === 'EMPLOYEE') {
                // Only return the logged-in employee
                const employee = await context.prisma.employee.findUnique({ where: { id: context.user.id } });
                if (!employee)
                    return { employees: [], totalCount: 0 };
                return {
                    employees: [{
                            ...employee,
                            subjects: parseSubjects(employee.subjects),
                            startDate: employee.startDate ? Math.floor(employee.startDate.getTime() / 1000) : null
                        }],
                    totalCount: 1
                };
            }
            if (context.user.role !== 'ADMIN')
                throw new apollo_server_express_1.ForbiddenError('Not authorized');
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
                employees: employees.map((e) => ({
                    ...e,
                    subjects: parseSubjects(e.subjects),
                    startDate: e.startDate ? Math.floor(e.startDate.getTime() / 1000) : null
                })),
                totalCount,
            };
        },
        employee: async (_parent, { id }, context) => {
            if (!context.user)
                throw new apollo_server_express_1.AuthenticationError('Not authenticated');
            if (context.user.role === 'EMPLOYEE') {
                // Always return the logged-in employee's details
                id = context.user.id;
            }
            else if (context.user.role !== 'ADMIN' && context.user.id !== id) {
                throw new apollo_server_express_1.ForbiddenError('Not authorized');
            }
            const employee = await context.prisma.employee.findUnique({ where: { id: +id } });
            if (!employee)
                return null;
            return {
                ...employee,
                subjects: parseSubjects(employee.subjects),
                startDate: employee.startDate ? Math.floor(employee.startDate.getTime() / 1000) : null
            };
        },
    },
    Mutation: {
        addEmployee: async (_parent, args, context) => {
            if (!context.user)
                throw new apollo_server_express_1.AuthenticationError('Not authenticated');
            if (context.user.role !== 'ADMIN')
                throw new apollo_server_express_1.ForbiddenError('Not authorized');
            const { name, age, class: className, subjects, attendance, role = client_1.Role.EMPLOYEE, email, department, position, salary, avatar, phone, address, startDate, status = 'active' } = args;
            // Generate a random plain password
            const plainPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcryptjs_1.default.hash(plainPassword, 10);
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
            if (email) {
                try {
                    const emailSent = await emailService_1.emailService.sendPasswordEmail(name, email, plainPassword);
                    if (emailSent) {
                        console.log(`Password email sent successfully to ${email}`);
                    }
                    else {
                        console.error(`Failed to send password email to ${email}`);
                    }
                }
                catch (error) {
                    console.error('Error sending password email:', error);
                    // Don't throw error to avoid breaking the employee creation
                }
            }
            else {
                console.log(`No email provided for ${name}, skipping email notification`);
            }
            return {
                ...employee,
                subjects,
                startDate: employee.startDate ? Math.floor(employee.startDate.getTime() / 1000) : null
            };
        },
        updateEmployee: async (_parent, args, context) => {
            if (!context.user)
                throw new apollo_server_express_1.AuthenticationError('Not authenticated');
            if (context.user.role !== 'ADMIN')
                throw new apollo_server_express_1.ForbiddenError('Not authorized');
            const { id, subjects, startDate, ...rest } = args;
            const data = { ...rest };
            if (subjects)
                data.subjects = stringifySubjects(subjects);
            if (startDate)
                data.startDate = new Date(startDate * 1000);
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
        deleteEmployee: async (_parent, { id }, context) => {
            if (!context.user)
                throw new apollo_server_express_1.AuthenticationError('Not authenticated');
            if (context.user.role !== 'ADMIN')
                throw new apollo_server_express_1.ForbiddenError('Not authorized');
            await context.prisma.employee.delete({ where: { id } });
            return true;
        },
        login: async (_parent, { email, password }, context) => {
            const employee = await context.prisma.employee.findUnique({ where: { email } });
            if (!employee)
                throw new apollo_server_express_1.AuthenticationError('Invalid credentials');
            const valid = await bcryptjs_1.default.compare(password, employee.password);
            if (!valid)
                throw new apollo_server_express_1.AuthenticationError('Invalid credentials');
            const token = jsonwebtoken_1.default.sign({ id: employee.id, role: employee.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
            return {
                token,
                employee: {
                    ...employee,
                    subjects: parseSubjects(employee.subjects),
                    startDate: employee.startDate ? Math.floor(employee.startDate.getTime() / 1000) : null
                }
            };
        },
        register: async (_parent, args, context) => {
            const { name, age, class: className, subjects, attendance, password, role = 'EMPLOYEE', email, department, position, salary, avatar, phone, address, startDate, status = 'active' } = args;
            const hashedPassword = await bcryptjs_1.default.hash(password, 10);
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
        resendPasswordEmail: async (_parent, { employeeId }, context) => {
            if (!context.user)
                throw new apollo_server_express_1.AuthenticationError('Not authenticated');
            if (context.user.role !== 'ADMIN')
                throw new apollo_server_express_1.ForbiddenError('Not authorized');
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
            const newHashedPassword = await bcryptjs_1.default.hash(newPlainPassword, 10);
            // Update the employee's password
            await context.prisma.employee.update({
                where: { id: parseInt(employeeId) },
                data: { password: newHashedPassword },
            });
            // Send the new password via email
            try {
                const emailSent = await emailService_1.emailService.sendPasswordEmail(employee.name, employee.email, newPlainPassword);
                if (emailSent) {
                    console.log(`Password reset email sent successfully to ${employee.email}`);
                    return true;
                }
                else {
                    console.error(`Failed to send password reset email to ${employee.email}`);
                    return false;
                }
            }
            catch (error) {
                console.error('Error sending password reset email:', error);
                return false;
            }
        },
    },
};
