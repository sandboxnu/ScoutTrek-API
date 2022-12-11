import mongoose from 'mongoose';

import { EventModel, TroopModel, UserModel, TokenModel } from '../../models/models';
import { ContextType } from '../../src/context';
import * as authFns from '../../src/utils/Auth';

async function createTestContext(userID?: mongoose.Types.ObjectId, membershipIDString?: string): Promise<ContextType> {
    const ret: ContextType = {
        UserModel,
        EventModel,
        TroopModel,
        TokenModel,
        authFns,
    };

    if (!userID) {
        return ret;
    }
    const user = await UserModel.findById(userID);
    if (!user) {
        return ret;
    }
    ret.user = user;
    if (!membershipIDString) {
        return ret;
    }
    const currMembership = user.groups.find((membership) => {
        return membership._id.equals(membershipIDString);
    });
    if (!currMembership) {
        return ret;
    }
    ret.membershipIDString = membershipIDString;
    ret.currMembership = currMembership;
    return ret;
};

export default createTestContext;