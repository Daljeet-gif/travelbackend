import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

// ─── Authentication ───────────────────────────────────────────────────────────
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).json({ message: "Access token missing or malformed." });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    const message =
      err.name === "TokenExpiredError" ? "Token expired." : "Invalid token.";
    res.status(401).json({ message });
  }
};

// ─── Authorization (Role-Based) ───────────────────────────────────────────────
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ message: "Not authenticated." });

    if (!allowedRoles.includes(req.user.role))
      return res.status(403).json({ message: "Forbidden: insufficient permissions." });

    next();
  };
};

// ─── Ownership Check ──────────────────────────────────────────────────────────
// Ensures a user can only modify their own resource (unless admin)
export const authorizeOwnerOrAdmin = (req, res, next) => {
  const { id } = req.params;

  if (req.user.id === id || req.user.role === "admin") return next();

  res.status(403).json({ message: "Forbidden: you don't own this resource." });
};