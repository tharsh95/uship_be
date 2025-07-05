import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  enum Role {
    ADMIN
    EMPLOYEE
  }

  type Employee {
    id: ID!
    name: String!
    email: String
    age: Int!
    department: String
    position: String
    salary: Float
    class: String!
    subjects: [String!]!
    attendance: Float!
    avatar: String
    phone: String
    address: String
    startDate: Int
    status: String!
    role: Role!
  }

  type EmployeePage {
    employees: [Employee!]!
    totalCount: Int!
  }

  type LoginPayload {
    token: String!
    employee: Employee!
  }

  type Query {
    employees(page: Int, pageSize: Int, sortBy: String, sortOrder: String, filter: String): EmployeePage!
    employee(id: ID!): Employee
  }

  type Mutation {
    register(
      name: String!
      email: String
      age: Int!
      department: String
      position: String
      salary: Float
      class: String!
      subjects: [String!]!
      attendance: Float!
      avatar: String
      phone: String
      address: String
      startDate: Int
      status: String
      password: String!
      role: Role
    ): Employee!
    login(email: String!, password: String!): LoginPayload!
    addEmployee(
      name: String!
      email: String
      age: Int!
      department: String
      position: String
      salary: Float
      class: String!
      subjects: [String!]!
      attendance: Float!
      avatar: String
      phone: String
      address: String
      startDate: Int
      status: String
      role: Role
    ): Employee!
    updateEmployee(
      id: ID!
      name: String
      email: String
      age: Int
      department: String
      position: String
      salary: Float
      class: String
      subjects: [String!]
      attendance: Float
      avatar: String
      phone: String
      address: String
      startDate: Int
      status: String
      role: Role
    ): Employee!
    deleteEmployee(id: Int!): Boolean!
  }
`; 