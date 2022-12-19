// Models
import { ApolloServer, GraphQLResponse } from '@apollo/server';
import { DocumentType } from '@typegoose/typegoose';
import assert from 'assert';
import gql from 'graphql-tag';
import mongoose from 'mongoose';
import { buildSchemaSync } from 'type-graphql';

import { TokenModel, UserModel } from '../../models/models';
import { User } from '../../models/User';
import { TypegooseMiddleware } from '../../src/middleware/typegoose_middlware';
import { AuthResolver } from '../../src/resolvers/auth';
import { PatrolResolver } from '../../src/resolvers/patrol';
import { TroopResolver } from '../../src/resolvers/troop';
import { UserResolver } from '../../src/resolvers/user';
import * as authFns from '../../src/utils/Auth';
import createTestContext from '../utils/test_context';
import { setupDB } from '../utils/test_setup';

setupDB('scouttrek-test');

const schema = buildSchemaSync({
  resolvers: [AuthResolver, UserResolver, TroopResolver, PatrolResolver],
  globalMiddlewares: [TypegooseMiddleware],
  authChecker: authFns.customAuthChecker,
});

// Create GraphQL server
const server = new ApolloServer({
  schema,
});

describe("User resolver", () => {
  let user: DocumentType<User>;
  let otherUser: DocumentType<User>;

  beforeEach(async () => {
    user = await UserModel.create({
      name: "Test User",
      email: "test@example.com",
      password: "password",
      passwordConfirm: "password",
      phone: "1234567890",
      birthday: "2000-12-12"
    });
    otherUser = await UserModel.create({
      name: "Other User",
      email: "other@example.com",
      password: "otherpassword",
      passwordConfirm: "otherpassword",
      phone: "9876543210",
      birthday: "2000-01-12"
    });
  });

  describe("Update user", () => {
    let response: GraphQLResponse;

    it('should fail if user is not authenticated', async () => {
      const userID = user._id.toString();
      const updateUser = {
        name: "Updated name"
      };
      const updateUserQuery = gql`
        mutation updateUser($updateUser: UpdateUserInput!, $userID: ID!) {
          updateUser(input: $updateUser, id: $userID) {
            id
            name
          }
        }
      `;

      response = await server.executeOperation({
        query: updateUserQuery,
        variables: {updateUser, userID}
      }, {
        contextValue: await createTestContext()
      });

      assert(response.body.kind === "single");
      expect(response.body.singleResult.errors).toBeDefined();
      expect(response.body.singleResult.errors).toHaveLength(1);
      expect(response.body.singleResult.errors![0]?.extensions?.code).toBe("UNAUTHORIZED");
      expect(response.body.singleResult.errors![0]?.message).toBe("Not authorized!");
    });

    it('should fail if user tries to edit another user', async () => {
      const userID = user._id.toString();
      const otherUserID = otherUser._id.toString();
      const updateUser = {
        name: "Updated name"
      };
      const updateUserQuery = gql`
        mutation updateUser($updateUser: UpdateUserInput!, $userID: ID!) {
          updateUser(input: $updateUser, id: $userID) {
            id
            name
          }
        }
      `;

      response = await server.executeOperation(
        {
          query: updateUserQuery,
          variables: {updateUser, userID: otherUserID}
        }, {
          contextValue: await createTestContext(new mongoose.Types.ObjectId(userID)),
        }
      );

      assert(response.body.kind === "single");
      expect(response.body.singleResult.errors).toBeDefined();
      expect(response.body.singleResult.errors).toHaveLength(1);
      expect(response.body.singleResult.errors![0]?.extensions?.code).toBe("FORBIDDEN");
      expect(response.body.singleResult.errors![0]?.message).toBe("Can't update a different user");
    });

    describe('Without password', () => {
      beforeEach(async () => {
        const userID = user._id.toString();
        const birthday = new Date(Date.now());
        const updateUser = {
          name: "Updated name",
          email: "newemail@example.com",
          phone: "9876543210",
          birthday: birthday.toDateString(),
        };
        const updateUserQuery = gql`
          mutation updateUser($updateUser: UpdateUserInput!, $userID: ID!) {
            updateUser(input: $updateUser, id: $userID) {
              id
              name
              email
              phone
              birthday
            }
          }
        `;

        response = await server.executeOperation(
          {
            query: updateUserQuery,
            variables: {updateUser, userID}
          }, {
            contextValue: await createTestContext(new mongoose.Types.ObjectId(userID))
          }
        );
      });

      it('should not have any errors', () => {
        assert(response.body.kind === "single");
        expect(response.body.singleResult.errors).toBeUndefined();
      });

      it('should return updated information', () => {
        assert(response.body.kind === "single");
        expect(response.body.singleResult.data).toBeDefined();
        const updateUser = response.body.singleResult.data!.updateUser as any; // Necessary because of renaming _id to id
        expect(updateUser.id).toEqual(user._id.toString());
        expect(updateUser.name).toBe("Updated name");
      });

      it('should update the user in the database', async () => {
        const updatedUser = await UserModel.findById(user._id);
        expect(updatedUser).not.toBeNull();
        expect(updatedUser!.name).toBe("Updated name");
      });
    });

    describe('With password', () => {
      beforeEach(async () => {
        const userID = user._id.toString();
        const updateUser = {
          name: "Updated name",
          password: "newpassword",
        };
        const updateUserQuery = gql`
          mutation updateUser($updateUser: UpdateUserInput!, $userID: ID!) {
            updateUser(input: $updateUser, id: $userID) {
              id
              name
            }
          }
        `;

        response = await server.executeOperation(
          {
            query: updateUserQuery,
            variables: {updateUser, userID}
          },
          {
            contextValue: await createTestContext(new mongoose.Types.ObjectId(userID))
          }
        );
      });

      it('should not have any errors', () => {
        assert(response.body.kind === "single");
        expect(response.body.singleResult.errors).toBeUndefined();
      });

      it('should return updated information', () => {
        assert(response.body.kind === "single");
        expect(response.body.singleResult.data).toBeDefined();
        const updateUser = response.body.singleResult.data!.updateUser as any; // Necessary because of renaming _id to id
        expect(updateUser.id).toEqual(user._id.toString());
        expect(updateUser.name).toBe("Updated name");
      });

      it('should update the user in the database', async () => {
        const updatedUser = await UserModel.findById(user._id);
        expect(updatedUser).not.toBeNull();
        expect(updatedUser!.name).toBe("Updated name");
        expect(!updatedUser!.isValidPassword("password"));
        expect(updatedUser!.isValidPassword("newpassword"));
      });
    });
  });

  describe("Request password reset", () => {
    let response: GraphQLResponse;

    it('should do nothing if email does not exist', async () => {
      const requestPasswordResetQuery = gql`
        mutation requestPasswordReset($email: String!) {
          requestPasswordReset(email: $email)
        }
      `;

      response = await server.executeOperation({
        query: requestPasswordResetQuery,
        variables: {email: "doesnt@exist.com"}
      }, {
        contextValue: await createTestContext()
      });

      assert(response.body.kind === "single");
      expect(response.body.singleResult.errors).toBeUndefined();
      expect(response.body.singleResult.data!.requestPasswordReset).toBe(true);
      expect(await TokenModel.count()).toBe(0);
    });

    // TODO: Should we mock the email service even though this is an end-to-end test?
  });
});
