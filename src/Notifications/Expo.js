import { Expo } from "expo-server-sdk";
import User from "../../models/User";
let expo = new Expo();

// fill messages
export const getUserNotificationData = async (Troop, User, troopID) => {
  const userData = [];

  let troop;

  if (troopID) {
    troop = await Troop.findById(troopID);
  }

  if (troop) {
    const validPatrols = troop.patrols.filter(
      (patrol) => patrol.members.length
    );

    const addToUserData = (user) => {
      if (user && user.expoNotificationToken) {
        userData.push({ token: user.expoNotificationToken, userID: user.id });
      }
      return Promise.resolve("ok");
    };

    const getUser = async (member) => {
      const user = await User.findById(member);
      return addToUserData(user);
    };

    await Promise.all(
      validPatrols.map((patrol) =>
        Promise.all(patrol.members.map((member) => getUser(member)))
      )
    );
  }

  return userData;
};

export const sendNotifications = (userData, body, data) => {
  let messages = [];
  for (let user of userData) {
    const { userID, token } = user;

    let notificationData;

    User.findById(userID, function (err, doc) {
      if (err) return false;
      const notification = {
        title: body,
        type: data.type,
        eventType: data.eventType,
        eventID: data.ID,
      };

      let index = doc.unreadNotifications.push(notification);
      doc.save();
      notificationData = doc.unreadNotifications[index - 1];
    });

    data = { ...data, notificationID: notificationData._id };

    if (!Expo.isExpoPushToken(token)) {
      console.error(`Push token ${token} is not a valid Expo push token`);
      continue;
    }

    messages.push({
      to: token,
      sound: "default",
      vibrate: true,
      body,
      data,
    });
  }

  let chunks = expo.chunkPushNotifications(messages);
  let tickets = [];
  (async () => {
    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error(error);
      }
    }
  })();
};
