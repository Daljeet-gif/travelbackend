import { User } from "../models/User.js";
import { compare } from "bcrypt";
import jwt from "jsonwebtoken";

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ─── Register ────────────────────────────────────────────────────────────────
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required." });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: "Email already in use." });

    const user = await User.create({ name, email, password });

    res.status(201).json({
      message: "User registered successfully.",
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

// ─── Login ───────────────────────────────────────────────────────────────────
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid credentials." });

    const isMatch = await compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials." });

    const accessToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    // Store refresh token in httpOnly cookie
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    res.status(200).json({
      message: "Login successful.",
      accessToken,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

// ─── Get Profile (protected) ─────────────────────────────────────────────────
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user)
      return res.status(404).json({ message: "User not found." });

    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

// ─── Update Profile (protected) ──────────────────────────────────────────────
export const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { name, email },
      { new: true, runValidators: true }
    ).select("-password");

    res.status(200).json({ message: "Profile updated.", user: updated });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

// ─── Delete Account (protected) ──────────────────────────────────────────────
export const deleteAccount = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);
    res.clearCookie("refreshToken", refreshCookieOptions);
    res.status(200).json({ message: "Account deleted." });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
};

// ─── Refresh Token ───────────────────────────────────────────────────────────
export const refreshAccessToken = (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token)
    return res.status(401).json({ message: "No refresh token provided." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const accessToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    res.status(200).json({ accessToken });
  } catch {
    res.status(403).json({ message: "Invalid or expired refresh token." });
  }
};

// ─── Logout ──────────────────────────────────────────────────────────────────
export const logoutUser = (req, res) => {
  res.clearCookie("refreshToken", refreshCookieOptions);
  res.status(200).json({ message: "Logged out successfully." });
};
