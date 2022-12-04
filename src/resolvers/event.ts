import { GraphQLScalarType } from 'graphql';
import mongoose from 'mongoose';
import {
  Arg,
  Authorized,
  Ctx,
  Field,
  FieldResolver,
  Float,
  ID,
  InputType,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
} from 'type-graphql';

import { Event, EVENT_TYPE } from '../../models/Event';
import { Location, Patrol, Troop } from '../../models/TroopAndPatrol';
import { User } from '../../models/User';
import EventSchemas from '../Event/EventSchemas.json';
import { sendNotifications } from '../notifications';

import type { ContextType } from '../context';
import { EVENT_SCHEMAS } from '../utils/EventSchemas';
import type { FormInput } from 'src/utils/FormTypes';
@InputType()
class AddRosterInput {
  @Field(type => [ID])
  groups!: mongoose.Types.ObjectId[];
  @Field(type => [ID])
  patrols!: mongoose.Types.ObjectId[];
  @Field(type => [ID])
  individuals!: mongoose.Types.ObjectId[];
}


@InputType()
class UpdateLocationInput {
  // if this is the same as the imported location type, can we remove?
  @Field(type => Float)
  lat: number;
  @Field(type => Float)
  lng: number;
  @Field({nullable: true})
  address?: string;
}

@InputType()
class CreateEventInput {
  @Field(type => EVENT_TYPE)
  type!: EVENT_TYPE;
  // TODO: create a scalar for FormInput
  @Field(type => FormInput)
  fields!: FormInput;
  @Field(type => Boolean, { nullable: true })
  published?: boolean;
}

@InputType()
class AddEventInput {
  @Field(type => EVENT_TYPE)
  type!: EVENT_TYPE;
  @Field(type => AddRosterInput, { nullable: true })
  invited?: AddRosterInput;
  @Field({ nullable: true })
  title?: string;
  @Field({ nullable: true })
  description?: string;
  @Field(type => Date, { nullable: true })
  date?: Date;
  @Field({ nullable: true })
  startTime?: string;
  @Field(type => Date, { nullable: true })
  meetTime?: Date;
  @Field(type => Date, { nullable: true })
  leaveTime?: Date;
  @Field({ nullable: true })
  endTime?: string;
  @Field(type => Date, { nullable: true })
  endDate?: Date;
  @Field(type => Date, { nullable: true })
  pickupTime?: Date;
  @Field({ nullable: true })
  uniqueMeetLocation?: string;
  @Field(type => UpdateLocationInput, { nullable: true }) 
  location?: UpdateLocationInput; 
  @Field(type => UpdateLocationInput, { nullable: true })
  meetLocation?: UpdateLocationInput;
  @Field(type => Date, { nullable: true })
  checkoutTime?: Date;
  @Field(type => Int, { nullable: true })
  distance?: number;
  @Field(type => Boolean, { nullable: true })
  published?: boolean;
}


@InputType()
class UpdateEventInput { 
  @Field(type => EVENT_TYPE, { nullable: true })
  type?: EVENT_TYPE;
  @Field(type => AddRosterInput, { nullable: true })
  invited?: AddRosterInput;
  @Field(type => AddRosterInput, { nullable: true })
  attending?: AddRosterInput;
  @Field({ nullable: true })
  title?: string;
  @Field({ nullable: true })
  description?: string;
  @Field(type => Date, { nullable: true })
  date?: Date;
  @Field({ nullable: true })
  startTime?: string;
  @Field(type => Date, { nullable: true })
  meetTime?: Date;
  @Field(type => Date, { nullable: true })
  leaveTime?: Date;
  @Field({ nullable: true })
  endTime?: string;
  @Field(type => Date, { nullable: true })
  endDate?: Date;
  @Field(type => Date, { nullable: true })
  pickupTime?: Date;
  @Field({ nullable: true })
  uniqueMeetLocation?: string;
  @Field(type => UpdateLocationInput, { nullable: true }) 
  location?: UpdateLocationInput; 
  @Field(type => UpdateLocationInput, { nullable: true })
  meetLocation?: UpdateLocationInput;
  @Field(type => Date, { nullable: true })
  checkoutTime?: Date;
  @Field(type => Int, { nullable: true })
  distance?: number;
  @Field(type => Boolean, { nullable: true })
  published?: boolean;
}

// custom scalar type so that we can query for event schemas without throwing an error
// this is the barest of bare-bone implementations but it works
const EventSchemaScalar = new GraphQLScalarType({
  name: "EventSchemaType",
  description: "scalar for event schema",
  serialize(value: Object) {
    return value;
  },
  parseValue(value: Object) {
    return value;
  },
  parseLiteral(value) {
    return value;
  }
})

const EventSchemaScalar2 = new GraphQLScalarType({
  name: "EventFormSchema",
  description: "scalar for event schema",
  serialize(value: Object) {
    return value;
  },
  parseValue(value: Object) {
    return value;
  },
  parseLiteral(value) {
    return value;
  }
})

@Resolver(of => Event)
export class EventResolver {
  // what is the json in resolvers??? 
  @Authorized()
  @Query(returns => Event)
  async event(
    @Arg("id", type => ID) id: string,
    @Ctx() ctx: ContextType
  ): Promise<Event> {
    const event = await ctx.EventModel.findById(id);
    if (!event) {
      throw new Error("Event could not be found");
    }
    return event;
  }

  @Authorized()
  @Query(returns => [Event])
  async events(
    @Arg("first", type => Int, { nullable: true }) first: number,
    @Arg("skip", type => Int, { nullable: true }) skip: number,
    @Ctx() ctx: ContextType,
  ): Promise<Event[]> {
    if (ctx.currMembership === undefined) {
      throw new Error("No membership selected!");
    }
    const myTroop = await ctx.TroopModel.findById(ctx.currMembership.troop._id);
    if (myTroop === null) {
      throw new Error("Selected troop does not exist");
    }

    const events = await ctx.EventModel.find(
      {
        date: {
          $gte: new Date(Date.now() - 86400000 * 1.5),
          $lte: new Date(Date.now() + 6.04e8 * 10),
        },
        troop: myTroop,
      },
      null,
      {
        first,
        skip,
      }
    ).sort({ date: 1 }); 

    return events;
  }

  @Query(returns => EventSchemaScalar)
  eventSchemas(): Object {
    // TODO: fix return type once jaron is done correcting the type
    return EventSchemas;
  }

  // TODO: replace above with this
  @Query(returns => EventSchemaScalar2)
  eventFormSchemas(): Object {
    // TODO: jaron is currently working on correcting the type
    return EVENT_SCHEMAS;
  }

  @Authorized()
  @Mutation(returns => ID)
  async deleteEvent(
    @Arg("id", type => ID) id: string,
    @Ctx() ctx: ContextType
  ): Promise<Event | null> {
    // TODO: double check `id` parameter type and Promise return type
    return await ctx.EventModel.findByIdAndDelete(id);
  }

  // TODO: make an endpoint for CreateEventInput
  @Authorized()
  @Mutation(returns => Event)
  async addEvent(
    @Arg("input") input: AddEventInput,
    @Ctx() ctx: ContextType
  ): Promise<Event> {
    if (ctx.currMembership === undefined) {
      throw new Error("No membership selected!");
    }

    if (input.type === "TROOP_MEETING") {
      // odn't fully get the point of this, let's discuss
      input.title = "Troop Meeting"
    }

    // what is the difference between meetTime and startTime ?????
    const startTime = input?.meetTime || input?.startTime;
    let startDatetime = new Date(startTime ?? Date.now());
    const eventDate = new Date(input?.date ?? Date.now());
	  startDatetime.setMonth(eventDate.getMonth());
		startDatetime.setDate(eventDate.getDate());

    const {location, meetLocation, ...restInput} = input;
    const mutationObject: Partial<Event> = {
      ...restInput,
      troop: ctx.currMembership.troop,
      patrol: ctx.currMembership.patrol,
      creator: ctx.user!._id,
      // note to self double check this ;-;
      notification: new Date(startDatetime.valueOf() - 86400000),
    };

    if (location) {
      mutationObject.locationPoint = {
        type: 'Point',
        coordinates: [location.lng, location.lat],
        address: location.address
      };
    }
    if (meetLocation) {
      mutationObject.meetLocationPoint = {
        type: 'Point',
        coordinates: [meetLocation.lng, meetLocation.lat],
        address: meetLocation.address
      };
    }

    const event = await ctx.EventModel.create(mutationObject);
    sendNotifications(ctx.tokens ?? [], `${input.title} event has been created. See details.`, {
      type: "event",
      eventType: event.type,
      ID: event.id
    });
    return event;
  }

  @Authorized()
  @Mutation(returns => Event)
  async updateEvent(
    @Arg("input") input: UpdateEventInput,
    @Arg("id", type => ID) id: string,
    @Ctx() ctx: ContextType
  ): Promise<Event | null>  {
    const {location, meetLocation, ...restInput} = input;
    const newVals: Partial<Event> = { ...restInput };
    if (location) {
      newVals.locationPoint = {
        type: "Point",
        coordinates: [location.lng, location.lat],
        address: location.address
      };
    }
    if (meetLocation) {
      newVals.meetLocationPoint = {
        type: "Point",
        coordinates: [meetLocation.lng, meetLocation.lat],
        address: meetLocation.address
      };
    }
    await ctx.EventModel.updateOne({ _id: id }, newVals);

    // or should we instead just create a new event if updatedEvents is null,
    // that way we don't need to return Event | null and can just return Event
    const updatedEvent = await ctx.EventModel.findById(id);

    sendNotifications(ctx.tokens ?? [], `${updatedEvent?.title} event has been updated!`, {
      type: "event",
      eventType: updatedEvent?.type ?? "",
      ID: updatedEvent?.id ?? ""
    });
    return updatedEvent;
  }

  @FieldResolver(returns => Troop)
  async troop(@Root() event: Event, @Ctx() ctx: ContextType): Promise<Troop | undefined> {
    return await ctx.TroopModel.findById(event.troop._id) ?? undefined;
  }

  @FieldResolver(returns => Patrol)
  async patrol(@Root() event: Event, @Ctx() ctx: ContextType): Promise<Patrol | undefined> {
    const troop = await ctx.TroopModel.findById(event.troop._id);
    const patrol = await troop?.patrols?.id(event.patrol);
    return patrol ?? undefined;
  }

  @FieldResolver(returns => User)
  async creator(@Root() event: Event, @Ctx() ctx: ContextType): Promise<User | undefined> {
    return await ctx.UserModel.findById(event.creator?._id) ?? undefined;
  }
  
  @FieldResolver(returns => Location, { nullable: true })
  location(@Root() event: Event): Location | null{
    if (event.locationPoint && event.locationPoint.coordinates.length == 2) {
      return {
        lng: event.locationPoint.coordinates[0]!,
        lat: event.locationPoint.coordinates[1]!,
        address: event.locationPoint.address,
      };
    }
    return null;
  }

  @FieldResolver(returns => Location, { nullable: true })
  meetLocation(@Root() event: Event): Location | null{
    if (event.meetLocationPoint && event.meetLocationPoint.coordinates.length == 2) {
      return {
        lng: event.meetLocationPoint.coordinates[0]!,
        lat: event.meetLocationPoint.coordinates[1]!,
        address: event.meetLocationPoint.address,
      };
    }
    return null;
  }
}