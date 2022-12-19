import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { GraphQLError } from 'graphql';
import mongoose, { Error } from 'mongoose';
import * as EmailService from '../services/email';
import {
  Arg,
  Authorized,
  Ctx,
  Field,
  FieldResolver,
  ID,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from 'type-graphql';

import { TOKEN_TYPE } from '../../models/Token';
import { Membership, Patrol, ROLE, Troop } from '../../models/TroopAndPatrol';
import { User } from '../../models/User';

import type { ContextType } from '../context';

@InputType()
class AddMembershipInput implements Partial<Membership> {
  @Field(type => ID)
  troopID!: mongoose.Types.ObjectId;

  @Field(type => ID)
  troopNumber!: string;

  @Field(type => ID)
  patrolID!: mongoose.Types.ObjectId;

  @Field(type => ROLE)
  role!: ROLE;

  @Field(type => [String], {nullable: true})
  children?: string[];
}

@ObjectType()
class MembershipPayload implements Partial<Membership> {
  @Field(type => ID)
  groupID: mongoose.Types.ObjectId;
  @Field()
  troopNumber: string;
}

@InputType()
class UpdateUserInput { // implements Partial<User>
  @Field({nullable: true})
  name?: string;
  @Field({nullable: true})
  email?: string;
  @Field({nullable: true})
  expoNotificationToken?: string;
  @Field({nullable: true})
  password?: string;
  @Field({nullable: true})
  phone?: string;
  @Field({nullable: true})
  birthday?: Date;
  @Field(type => [AddMembershipInput], {nullable: true})
  groups?: AddMembershipInput[];
  @Field(type => [String], {nullable: true})
  children?: string[];
}

@InputType()
class ResetPasswordInput {
  @Field()
  email!: string;
  @Field()
  token!: string;
  @Field()
  password!: string;
}

@Resolver(of => User)
export class UserResolver {
  @Authorized()
  @Query(returns => User)
  async user(
    @Arg("id", type => ID) id: string,
    @Ctx() ctx: ContextType
  ): Promise<User> {
    const user = await ctx.UserModel.findById(id);
    if (!user) {
      throw new Error("User could not be found")
    }
    return user;
  }

  @Authorized()
  @Query(returns => [User])
  async users(
    @Arg("limit", type => Int, {nullable: true}) limit: number,
    @Arg("skip", type => Int, {nullable: true}) skip: number,
    @Ctx() ctx: ContextType
  ): Promise<User[]> {
    return await ctx.UserModel.find({}, null, { limit, skip })
  }

  @Authorized()
  @Query(returns => User, {nullable: true})
  async currUser(@Ctx() ctx: ContextType): Promise<User | undefined> {
    return ctx.user;
  }

  @Authorized()
  @Mutation(returns => MembershipPayload)
  async addGroup(
    @Arg("input") input: AddMembershipInput,
    @Ctx() ctx: ContextType
  ): Promise<MembershipPayload> {
    const newGroupID = new mongoose.Types.ObjectId();

    const troopDoc = await ctx.TroopModel.findById(input.troopID);
    if (!troopDoc) {
      throw new Error("No such troop");
    }
    if (input.role === ROLE.SCOUTMASTER) {
      troopDoc.scoutMaster = ctx.user!._id;
    }
    if (input.patrolID) {
      const patrol = troopDoc.patrols.id(input.patrolID);
      if (!patrol) {
        throw new Error("No such patrol");
      }
      patrol.members.push(ctx.user!._id);
    }
    troopDoc.save();

    const { children, ...membershipDetails } = input;
    if (children) {
      ctx.user!.children?.push(...children);
    }
    ctx.user!.groups.push({ _id: newGroupID, ...membershipDetails });
    ctx.user!.save();

    return {
      groupID: newGroupID,
      troopNumber: input.troopNumber
    };
  }

  @Authorized()
  @Mutation(returns => User)
  async updateUser(
    @Arg("input") input: UpdateUserInput,
    @Arg("id", type => ID) id: string,
    @Ctx() ctx: ContextType
  ): Promise<User> {
    if (id !== ctx.user!._id.toString()) {
      throw new GraphQLError("Can't update a different user", {
        extensions: {
          code: "FORBIDDEN",
        },
      });
    }
    // If password is changed, hash it since findAndUpdate doesn't call pre-save
    if (input.password) {
      input.password = await bcrypt.hash(input.password, 12);
    }
    const userDoc = await ctx.UserModel.findByIdAndUpdate(id, input, { new: true });
    if (!userDoc) {
      throw new Error("No such user");
    }
    return userDoc;
  }

  @Authorized([ROLE.SCOUTMASTER])
  @Mutation(returns => User)
  async deleteUser(
    @Arg("id", type => ID) id: mongoose.Types.ObjectId,
    @Ctx() ctx: ContextType
  ): Promise<User | null> {
    return await ctx.UserModel.findByIdAndDelete(id);
  }

  @Authorized()
  @Mutation(returns => User)
  async updateCurrUser(
    @Arg("input") input: UpdateUserInput,
    @Ctx() ctx: ContextType
  ): Promise<User | null> {
    return await ctx.UserModel.findByIdAndUpdate(ctx.user!._id, input, { new: true });
  }

  @Authorized()
  @Mutation(returns => Boolean)
  async dismissNotification(
    @Arg("id", type => ID) id: mongoose.Types.ObjectId,
    @Ctx() ctx: ContextType
  ): Promise<boolean> {
    const notif = ctx.user!.unreadNotifications.id(id);
    if (notif === null) {
      return false;
    }
    notif.remove();
    ctx.user!.save();
    return true;
  }
  
  @Mutation()
  requestPasswordReset(
    @Arg("email") email: string,
    @Ctx() ctx: ContextType
  ): boolean {
    ctx.UserModel.findOne({email}).then((user) => {
      if (!user) {
        return;
      }
      ctx.TokenModel.create({
        type: TOKEN_TYPE.PASS_RESET,
        user: user._id,
        token: crypto.randomUUID(),
      }).then((tok) => {
        EmailService.sendResetPasswordEmail(email, tok.token);
      });
    });

    return true; // Always return true
  }

  @Mutation(returns => User, {nullable: true})
  async resetPassword(
    @Arg("input") input: ResetPasswordInput,
    @Ctx() ctx: ContextType
  ): Promise<User | null> {
    const user = await ctx.UserModel.findOne({email: input.email});
    if (!user) {
      return null;
    }
    const token = await ctx.TokenModel.findOne({user: {_id: user._id}, token: input.token, type: TOKEN_TYPE.PASS_RESET});
    if (!token) {
      return null;
    }
    user.password = input.password;
    const ret = await user.save();
    token.delete();
    return ret;
  }

  @Authorized()
  @FieldResolver(returns => ROLE, {nullable: true})
  currRole(@Root() user: User, @Ctx() ctx: ContextType): ROLE | undefined {
    if (user._id.equals(ctx.user!._id)) {
      return ctx.currMembership?.role;
    }
  }

  @Authorized()
  @FieldResolver(returns => Troop)
  async currTroop(@Root() user: User, @Ctx() ctx: ContextType): Promise<Troop | undefined> {
    if (user._id.equals(ctx.user!._id) && ctx.currMembership) {
      return await ctx.TroopModel.findById(ctx.currMembership.troopID._id) ?? undefined;
    }
  }

  @Authorized()
  @FieldResolver(returns => Patrol)
  async currPatrol(@Root() user: User, @Ctx() ctx: ContextType): Promise<Patrol | undefined> {
    if (user._id.equals(ctx.user!._id) && ctx.currMembership) {
      const myTroop = await ctx.TroopModel.findById(ctx.currMembership.troopID._id);
      if (myTroop) {
        return myTroop.patrols.id(ctx.currMembership.patrolID) ?? undefined;
      }
    }
  }

  @Authorized()
  @FieldResolver(returns => [Membership])
  otherGroups(@Ctx() ctx: ContextType): Membership[] {
    if (ctx.user && ctx.user.groups.length > 1) {
      return ctx.user.groups.reduce((mapped: Membership[], group) => {
        if (group._id && group._id.toString() !== ctx.membershipIDString) {
          mapped.push(group);
        }
        return mapped;
      }, []);
    }
    return [];
  }
}
