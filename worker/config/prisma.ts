import { PrismaClient } from "../generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Create a connection pool using your database URL
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

// Create the adapter
const adapter = new PrismaPg(pool);

// Pass the adapter to the constructor
export const prisma = new PrismaClient({ adapter });