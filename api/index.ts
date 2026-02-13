// api/index.ts - Vercel serverless function entry point
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Your routes
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "API is running" });
});

app.use(express.json({ limit: "100mb" }));
const PORT = 6001;
app.listen(PORT, () => {
  console.log("app running");
});

export default app;
