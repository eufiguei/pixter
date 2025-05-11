import "next-auth/next";
import { Session } from "next-auth";

declare module "next-auth/next" {
  import { NextApiRequest, NextApiResponse } from "next";
  import { AuthOptions } from "next-auth";

  /**
   * Strongly-typed version of getServerSession with Session including user.
   */
  export function getServerSession(
    options: AuthOptions
  ): Promise<Session | null>;

  export function getServerSession(
    req: NextApiRequest,
    res: NextApiResponse,
    options: AuthOptions
  ): Promise<Session | null>;
}

export {};
