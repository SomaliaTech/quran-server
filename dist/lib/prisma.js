// lib/prisma.ts
import { PrismaClient } from "@prisma/client";
const prisma = global.prismadb || new PrismaClient();
if (process.env.NODE_ENV === "production") {
    global.prismadb = prisma;
}
else {
    // In development, prevent multiple instances
    if (!global.prismadb) {
        global.prismadb = prisma;
    }
}
export default prisma;
