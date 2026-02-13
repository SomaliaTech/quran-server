import { PrismaClient } from "@prisma/client";
import { request } from "express";

declare global {
  var prismadb: PrismaClient | undefined;
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
