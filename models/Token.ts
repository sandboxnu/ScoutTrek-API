import { modelOptions, prop as Property } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from './User';

import type { Ref } from "@typegoose/typegoose";

export enum TOKEN_TYPE {
    SESSION,
    PASS_RESET,
}

@modelOptions({
    schemaOptions: {
        timestamps: true,
    }
})
export class Token {
  @Property({ required: true, enum: TOKEN_TYPE })
  public type!: TOKEN_TYPE;

  @Property({ required: true, ref: () => User })
  public user!: Ref<User, mongoose.Types.ObjectId>;

  @Property({ required: true })
  public token!: string;

  @Property({ expires: 3600 })
  public createdAt?: Date;
}
