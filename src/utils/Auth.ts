import { Request } from 'express';
import { sign, verify } from 'jsonwebtoken';
import { AuthChecker, ResolverData } from 'type-graphql';

import { UserModel } from '../../models/models';
import { ROLE } from '../../models/TroopAndPatrol';
import { User } from '../../models/User';

import type { ContextType } from '../context';
import type { DocumentType } from "@typegoose/typegoose";
import { GraphQLError } from 'graphql';

const SECRET = "themfingsuperobvioussting";
const DEFAULT_EXPIRES_IN = "55d";

interface UserToken {
  id: string;
}

/**
 * takes a user token object and creates jwt out of it
 * using user.id and user.role
 * @param {Object} user the user to create a jwt for
 */
export function createToken(unsignedToken: UserToken): string {
  return sign({ id: unsignedToken.id }, SECRET, { expiresIn: DEFAULT_EXPIRES_IN });
}

/**
 * will attempt to verify a jwt and find a user in the
 * db associated with it. Catches any error and returns
 * a null user
 * @param {String} token jwt from client
 * @throws {Error} if user cannot be found from specified token
 */
export async function getUserFromToken(encodedToken: string): Promise<DocumentType<User> | null> {
  try {
    const jwtUserInfo = verify(encodedToken, SECRET) as UserToken;
    const user = await UserModel.findById(jwtUserInfo.id);

    if (user === null) {
      return null;
    }

    return user;
  } catch (e) {
    return null;
  }
};

/**
 * TODO:
 * @param req
 */
export function getTokenFromReq(req: Request): string | null {
  const authReq = req?.headers.authorization;
  const regex = new RegExp("^Bearer .+");
  if (!authReq || !regex.test(authReq)) {
    return null;
  }

  return authReq.replace("Bearer ", "");
};

export const customAuthChecker: AuthChecker<ContextType, ROLE> = (
  { context }: ResolverData<ContextType>,
  roles: ROLE[]
) => {
  if (!context.user) {
    throw new GraphQLError('Not authorized!', {
      extensions: {
        code: 'UNAUTHORIZED',
      },
    });
  }

  return roles.length == 0 || context.currMembership !== undefined && roles.includes(context.currMembership.role);
};
