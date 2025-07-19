# uShip Backend – GraphQL API

A scalable Node.js + TypeScript backend using Apollo Server, Prisma ORM, and MySQL. Supports JWT authentication, role-based access control, and a robust Employee data model.

---

## 🚀 Features
- GraphQL API (Apollo Server)
- Employee CRUD with pagination, sorting, filtering
- JWT authentication (login/register)
- Role-based access (admin/employee)
- Prisma ORM (MySQL)
- TypeScript

---

## 🏗️ Project Structure
```
backend/
  src/
    index.ts        # Server entrypoint
    schema.ts       # GraphQL schema (typeDefs)
    resolvers.ts    # GraphQL resolvers
  prisma/
    schema.prisma   # Prisma data model
  .env              # Environment variables
  package.json      # Dependencies & scripts
```

---

## ⚙️ Setup
1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Configure environment:**
   - Copy your MySQL connection string to `.env`:
     ```env
     DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"
     JWT_SECRET="your_jwt_secret"
     ```
3. **Run migrations:**
   ```sh
   npx prisma migrate dev --name init
   ```
4. **Start the server:**
   ```sh
   npm run dev
   # or for production
   npm run build && npm start
   ```
5. **Access GraphQL Playground:**
   - [http://localhost:4000/graphql](http://localhost:4000/graphql)

---

## 🔐 Authentication
- Use the `register` mutation to create a user (employee or admin).
- Use the `login` mutation to get a JWT token.
- For all other queries/mutations, add this header:
  ```
  Authorization: Bearer <token>
  ```

---

## 📚 Example Queries & Mutations

### Register
```graphql
mutation {
  register(
    name: "Alice"
    age: 28
    class: "A"
    subjects: ["Math", "Science"]
    attendance: 95
    password: "yourpassword"
    role: ADMIN
  ) {
    id
    name
    role
  }
}
```

### Login
```graphql
mutation {
  login(id: 1) {
    token
    employee { id name role }
  }
}
```

### List Employees (Admin Only)
```graphql
query {
  employees(page: 1, pageSize: 10) {
    employees {
      id
      name
      age
      class
      subjects
      attendance
      role
    }
    totalCount
  }
}
```

### Get Single Employee (Admin or Self)
```graphql
query {
  employee(id: 1) {
    id
    name
    age
    class
    subjects
    attendance
    role
  }
}
```

### Add Employee (Admin Only)
```graphql
mutation {
  addEmployee(
    name: "Bob"
    age: 30
    class: "B"
    subjects: ["English", "History"]
    attendance: 90
    role: EMPLOYEE
  ) {
    id
    name
    role
  }
}
```

### Update Employee (Admin Only)
```graphql
mutation {
  updateEmployee(
    id: 1
    name: "Alice Updated"
    attendance: 99
  ) {
    id
    name
    attendance
  }
}
```

### Delete Employee (Admin Only)
```graphql
mutation {
  deleteEmployee(id: 1)
}
```

---

## 🛡️ Role-Based Access
- **Admin:** Can list, add, update, delete any employee.
- **Employee:** Can only view their own record.

---

## 📝 Notes
- All queries/mutations are sent to `/graphql` endpoint.
- Use JWT token in the `Authorization` header for all protected operations.
- For demo, login is by employee ID. For production, extend to username/email + password.

---

## 📦 Scripts
- `npm run dev` – Start in dev mode
- `npm run build` – Compile TypeScript
- `npm start` – Start from compiled output
- `npx prisma migrate dev` – Run migrations
- `npx prisma studio` – Visual DB browser

---
