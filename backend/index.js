import express from "express";
import dotenv from "dotenv";
dotenv.config();

import cookieParser from "cookie-parser";
import cors from "cors";
import passport from "passport";
import "./src/config/passport.js";
import { googleSuccess } from "./src/controllers/authController.js";
import authRouter from "./src/routes/authRoute.js";

// ✅ Prisma client
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(passport.initialize());

app.get("/", (req, res) => {
  res.send("hello from server");
});

// Google callback
app.get(
  "/auth/google/callback",
  passport.authenticate("google", { session: false }),
  googleSuccess
);

// auth routes
app.use("/api/auth", authRouter);

/**
 * ✅ Create a test user
 * POST /test-user
 */
app.post("/test-user", async (req, res) => {
  try {
    // optionally allow custom values from body
    const {
      name = "Test User",
      email = "testuser@gmail.com",
      password = "Test@12345",
      role = "EMPLOYEE",
    } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    res.json({ message: "User created successfully", user });
  } catch (err) {
    console.error(err);

    // common Prisma unique error for email
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }

    res.status(500).json({ error: err.message });
  }
});

/**
 * ✅ Fetch all users
 * GET /users
 */
app.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, async () => {
  console.log("server started on port", port);

  // ✅ optional, but nice to confirm DB connection at startup
  try {
    await prisma.$connect();
    console.log("prisma connected");
  } catch (e) {
    console.error("prisma connection failed:", e.message);
  }
});

// ✅ clean shutdown (prevents hanging connections)
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
