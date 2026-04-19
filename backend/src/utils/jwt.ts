import jwt from "jsonwebtoken";
import { env } from "../config/env";

const JWT_EXPIRES_IN = "8h";

export const generateToken = (userId: string) => {
  return jwt.sign({}, env.JWT_SECRET_CURRENT, {
    algorithm: "HS256",
    audience: env.JWT_AUDIENCE,
    expiresIn: JWT_EXPIRES_IN,
    issuer: env.JWT_ISSUER,
    subject: userId,
  });
};

export const verifyToken = (token: string) => {
  const candidateSecrets = [env.JWT_SECRET_CURRENT, env.JWT_SECRET_PREVIOUS].filter(
    Boolean
  ) as string[];

  for (const secret of candidateSecrets) {
    try {
      const decoded = jwt.verify(token, secret, {
        algorithms: ["HS256"],
        audience: env.JWT_AUDIENCE,
        issuer: env.JWT_ISSUER,
      }) as jwt.JwtPayload;

      if (!decoded.sub) {
        throw new Error("Token subject is missing");
      }

      return { userId: decoded.sub };
    } catch {
      continue;
    }
  }

  throw new Error("Invalid token");
};
