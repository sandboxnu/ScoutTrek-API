import * as validator from 'email-validator';
import { Arg, Ctx, Field, ID, InputType, Mutation, ObjectType, Resolver } from 'type-graphql';

import { UserModel } from '../../models/models';
import { User } from '../../models/User';
import * as authFns from '../utils/Auth';

import type { ContextType } from '../context';

@InputType()
export class LoginInput {
  @Field()
  email!: string;
  @Field()
  password!: string;
  @Field({ nullable: true })
  expoNotificationToken?: string;
}

@InputType()
export class SignupInput {
  @Field()
  name!: string;
  @Field()
  email!: string;
  @Field()
  password!: string;
  @Field()
  passwordConfirm!: string;
  @Field({ nullable: true })
  expoNotificationToken?: string;
  @Field({ nullable: true })
  phone?: string;
  @Field({ nullable: true })
  birthday?: Date;
}

@ObjectType()
export class SignupPayload {
  @Field()
  token!: string;
  @Field(type => User)
  user!: User;
  @Field()
  noGroups!: boolean;
}

@ObjectType()
export class LoginPayload {
  @Field()
  token!: string;
  @Field(type => User)
  user!: User;
  @Field()
  noGroups!: boolean;
  @Field(type => ID, {nullable: true})
  groupID?: string;
}

@Resolver()
export class AuthResolver {
  @Mutation(returns => SignupPayload)
  async signup(
    @Arg("input") input: SignupInput,
    @Ctx() ctx: ContextType
  ): Promise<SignupPayload> {
    if (!validator.validate(input.email)) {
      throw new Error("Please enter a valid email.");
    }

    const user = await ctx.UserModel.create(input);

    const token = authFns.createToken({
      id: user._id.toString()
    });

    return {
      user,
      token,
      noGroups: true
    };
  }

  @Mutation(returns => LoginPayload)
  async login(
    @Arg("input") input: LoginInput,
    @Ctx() ctx: ContextType
  ): Promise<LoginPayload> {
    const { email, password } = input;

    if (!email || !password) {
      throw new Error("Please provide an email and password.");
    }

    const user = await ctx.UserModel.findOne({ email });

    if (!user || !(await user.isValidPassword(password))) {
      throw new Error("Invalid login");
    }

    if (input.expoNotificationToken) {
      if (input.expoNotificationToken !== user.expoNotificationToken) {
        await UserModel.findByIdAndUpdate(user._id, {
          expoNotificationToken: input.expoNotificationToken,
        });
      }
    }

    const token = authFns.createToken({ id: user._id.toString() });
    return {
      token,
      user,
      noGroups: !user.groups.length,
      groupID: user.groups.length > 0 ? user.groups[0]!._id : undefined,
    };
  }
}