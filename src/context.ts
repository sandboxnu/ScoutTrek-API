import { ContextFunction } from '@apollo/server';
import { ExpressContextFunctionArgument } from '@apollo/server/dist/esm/express4';
import { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { Event } from '../models/Event';
import { EventModel, TokenModel, TroopModel, UserModel } from '../models/models';
import { Token } from '../models/Token';
import { Membership, Troop } from '../models/TroopAndPatrol';
import { User } from '../models/User';
import { getUserNotificationData, UserData } from './notifications';
import * as authFns from './utils/Auth';

import type { ReturnModelType } from '@typegoose/typegoose';
export interface ContextType {
	UserModel: ReturnModelType<typeof User>,
	EventModel: ReturnModelType<typeof Event>,
	TroopModel: ReturnModelType<typeof Troop>,
    TokenModel: ReturnModelType<typeof Token>,
	authFns: typeof authFns,
	tokens?: UserData[] | null,
	membershipIDString?: string,
	currMembership?: DocumentType<Membership>,
	user?: DocumentType<User>,
}

const contextFn: ContextFunction<[ExpressContextFunctionArgument]> = async ({ req }) => {
    let ret: ContextType = {
        UserModel,
        EventModel,
        TroopModel,
        TokenModel,
        authFns
    };
    const token = authFns.getTokenFromReq(req);
    if (!token) {
        return ret;
    }
    const user = await authFns.getUserFromToken(token);
    if (!user) {
        return ret;
    }

    ret.user = user;

    // Update this for membership paradigm --(connie: not sure what this means but will leave the comment here )
    const membership = Array.isArray(req.headers?.membership) ? req.headers?.membership[0] : req.headers?.membership; // this is really bad... 

    const membershipIDString = membership === "undefined" ? undefined : new mongoose.Types.ObjectId(membership).toString();

    if (membershipIDString && user.groups) {
        ret.membershipIDString = membershipIDString;
        const currMembership = user.groups.find((membership) => {
            return membership._id.equals(membershipIDString);
        });
        if (currMembership) {
            ret.tokens = await getUserNotificationData(currMembership.troopID._id.toString());
            ret.currMembership = currMembership;
        }
    }

    return ret;
};

export default contextFn;