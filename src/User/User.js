import mongoose from "mongoose";
const { gql } = require("apollo-server-express");
const { authenticated, authorized } = require("../utils/Auth");

export const typeDefs = gql`
  enum ROLE {
    SCOUTMASTER
    ASST_SCOUTMASTER
    SENIOR_PATROL_LEADER
    PATROL_LEADER
    SCOUT
    PARENT
    ADULT_VOLUNTEER
  }

  type Notification {
    id: ID!
    title: String!
    type: String!
    eventType: String!
    eventID: ID!
    createdAt: String!
  }

  type Membership {
    id: ID!
    troopID: ID!
    troopNumber: String!
    patrolID: ID!
    role: ROLE!
  }

  input AddMembershipInput {
    troopID: ID!
    troopNumber: String!
    patrolID: ID!
    role: ROLE!
    children: [String]
  }

  type User {
    id: ID!
    expoNotificationToken: String!
    createdAt: String
    updatedAt: String
    name: String!
    email: String!
    phone: String
    birthday: String
    age: Int
    currTroop: Troop
    currPatrol: Patrol
    currRole: ROLE
    groups: [Membership]
    otherGroups: [Membership]
    events: Event
    children: [String]
    userPhoto: String!
    unreadNotifications: [Notification]
    noGroups: Boolean
  }

  type MembershipPayload {
    groupID: ID!
    groupNum: String!
  }

  input AddUserInput {
    name: String!
    email: String!
    password: String!
    passwordConfirm: String!
    expoNotificationToken: String
    phone: String
    birthday: String
  }

  input UpdateUserInput {
    name: String
    email: String
    expoNotificationToken: String
    password: String
    phone: String
    birthday: String
    role: ROLE
    groups: [AddMembershipInput]
    children: [String]
  }

  type Query {
    users(limit: Int, skip: Int): [User]
    user(id: ID!): User
    currUser: User
  }

  type Mutation {
    addGroup(input: AddMembershipInput): MembershipPayload
    updateUser(input: UpdateUserInput!, id: ID!): User
    deleteUser(id: ID!): User
    updateCurrUser(input: UpdateUserInput!): User
    deleteCurrUser: User
    dismissNotification(id: ID!): Boolean!
  }
`;

export const resolvers = {
  Membership: {
    id: (parent) => {
      return parent._id;
    },
  },
  Notification: {
    id: (parent) => {
      return parent._id;
    },
  },
  User: {
    id: (parent) => {
      return parent._id;
    },
    currRole: (parent, __, { currMembership }) => {
      return currMembership ? currMembership.role : parent.role;
    },
    currTroop: async (parent, __, { Troop, currMembership }) => {
      return await Troop.findById(
        currMembership ? currMembership.troopID : parent.troop
      );
    },
    currPatrol: async (parent, __, { Troop, currMembership }) => {
      const myTroop = await Troop.findById(
        currMembership ? currMembership.troopID : parent.troop
      );
      const myPatrol = await myTroop.patrols.id(currMembership.patrolID);
      return myPatrol;
    },
    otherGroups: async (_, __, { user, membershipIDString }) => {
      const userObj = JSON.parse(JSON.stringify(user));
      let otherGroups = [];
      if (userObj?.groups?.length > 1) {
        otherGroups = userObj.groups.filter(
          (group) => group?._id !== membershipIDString
        );
      }
      return otherGroups;
    },
    noGroups: async (parent) => !parent.groups.length,
    unreadNotifications: async (parent) => {
      if (parent?.unreadNotifications) {
        return parent?.unreadNotifications;
      } else {
        return null;
      }
    },
  },
  Query: {
    user: authenticated(async (_, { id }, { User }) => await User.findById(id)),
    users: authenticated(async (_, { limit, skip }, { User }) => {
      return await User.find({}, null, { limit, skip });
    }),
    currUser: async (_, __, { user }) => user,
  },
  Mutation: {
    addGroup: authenticated(async (_, { input }, { user, User, Troop }) => {
      const newGroupID = mongoose.Types.ObjectId();

      Troop.findById(input.troopID, function (err, doc) {
        if (input.role === "SCOUTMASTER") {
          doc.scoutMaster = user.id;
        }
        if (input.patrolID) {
          const currPatrol = doc.patrols.find(
            (patrol) => patrol.id === input.patrolID
          );
          currPatrol.members.push(user.id);
        }
        doc.save();
      });

      User.findById(user.id, function (err, doc) {
        if (err) return false;
        const { children, ...membershipDetails } = input;
        doc.children.push(...children);
        doc.groups.push({ _id: newGroupID, ...membershipDetails });
        doc.save();
      });

      return {
        groupID: newGroupID,
      };
    }),
    updateUser: authenticated(
      authorized("SCOUTMASTER", async (_, { input, id }, { User }) => {
        if (typeof input.password === "string") {
          // Note: this might be broken and its also weird
          input.password = await User.findById(id, function (err, doc) {
            if (err) return false;
            doc.password = input.password;
            doc.save();
          });
        }
        return await User.findByIdAndUpdate(id, { ...input }, { new: true });
      })
    ),
    deleteUser: authenticated(
      authorized(
        "SCOUTMASTER",
        async (_, { id }, { User }) => await User.findByIdAndDelete(id)
      )
    ),
    updateCurrUser: authenticated(
      async (_, { input }, { User, user }) =>
        await User.findByIdAndUpdate(user.id, { ...input }, { new: true })
    ),
    deleteCurrUser: authenticated(
      async (_, { id }, { User }) => await User.findByIdAndDelete(id)
    ),
    dismissNotification: authenticated((_, { id }, { user, User }) => {
      User.findById(user.id, function (err, doc) {
        if (err) return false;

        if (doc?.unreadNotifications) {
          doc.unreadNotifications = doc.unreadNotifications.filter(
            (notification) => notification.id !== id
          );
        }

        doc.save();
      });
      return true;
    }),
  },
};
