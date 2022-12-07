import { ApolloServer } from '@apollo/server';
import mongoose from 'mongoose';
import cron from 'node-cron';
import { buildSchema } from 'type-graphql';

import { EventModel } from '../models/models';
import { TypegooseMiddleware } from './middleware/typegoose_middlware';
import { getUserNotificationData, sendNotifications } from './notifications';
import { AuthResolver } from './resolvers/auth';
import { EventResolver } from './resolvers/event';
import { PatrolResolver } from './resolvers/patrol';
import { SharedAssetsResolver } from './resolvers/sharedAssets';
import { TroopResolver } from './resolvers/troop';
import { UserResolver } from './resolvers/user';
import * as authFns from './utils/Auth';

// Models
mongoose.connect(process.env.MONGO_URL!);

const mongo = mongoose.connection;
mongo.on("error", console.error.bind(console, "connection error:"));
mongo.once("open", function () {
	console.log("Database connected!");
});

cron.schedule("* * * * *", async () => {
	const oneDayReminderEvents = await EventModel.find({
		notification: { $lte: new Date() }
	});
	if (oneDayReminderEvents.length > 0) {
		oneDayReminderEvents.map(async (event) => {
			const tokens = await getUserNotificationData(event.troop._id.toString());
			sendNotifications(
				tokens,
				`Friendly ScoutTrek Reminder that ${event.title} happens tomorrow!`,
				{ type: "event", eventType: event.type, ID: event.id }
			);
			event.notification = undefined;
			event.save();
		});
	}
});

async function bootstrap() {
	try {
		// build TypeGraphQL executable schema
		const schema = await buildSchema({
			resolvers: [AuthResolver, EventResolver, UserResolver, TroopResolver, PatrolResolver, SharedAssetsResolver],
			globalMiddlewares: [TypegooseMiddleware],
			authChecker: authFns.customAuthChecker,
		});

		// Create GraphQL server
		const server = new ApolloServer({
			schema,
		});

		return server;
	} catch (err) {
		console.error(err);
	}
}

const apolloServer = bootstrap();

export default apolloServer;
