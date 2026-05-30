import { hash } from "bcrypt";
import mongoose  from "mongoose";

const UserSchema = new mongoose.Schema({
    name: {
        required: true,
        type: String,
    },
    email: {    
        required: true,
        type: String,
    },
    password: {
        required: true,
        type: String,
    },


}, { timestamps: true });

UserSchema.pre('save', async function (next) {
    if (!this.isModified("password")) return next();

    this.password = await hash(this.password, 10);
})

export const User = mongoose.model('User', UserSchema);