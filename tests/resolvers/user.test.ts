// Models
import { DocumentType } from '@typegoose/typegoose';
import { ApolloServer, gql } from 'apollo-server-express';
import { createTestClient } from 'apollo-server-integration-testing';
import { GraphQLResponse } from 'apollo-server-types';
import { buildSchemaSync } from 'type-graphql';

import { UserModel } from '../../models/models';
import { User } from '../../models/User';
import contextFn from '../../src/context';
import { TypegooseMiddleware } from '../../src/middleware/typegoose_middlware';
import { AuthResolver } from '../../src/resolvers/auth';
import { PatrolResolver } from '../../src/resolvers/patrol';
import { TroopResolver } from '../../src/resolvers/troop';
import { UserResolver } from '../../src/resolvers/user';
import * as authFns from '../../src/utils/Auth';
import { setupDB } from '../test_setup';

setupDB('scouttrek-test');

const schema = buildSchemaSync({
  resolvers: [AuthResolver, UserResolver, TroopResolver, PatrolResolver],
  globalMiddlewares: [TypegooseMiddleware],
  authChecker: authFns.customAuthChecker,
});

// Create GraphQL server
const server = new ApolloServer({
  schema,
  context: contextFn,
});

const { mutate, setOptions } = createTestClient({
  apolloServer: server
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

      response = await mutate(updateUserQuery, {
        variables: {updateUser, userID}
      });

      expect(response.errors).toBeDefined();
      expect(response.errors).toHaveLength(1);
      expect(response.errors![0]?.extensions?.code).toBe("UNAUTHORIZED");
      expect(response.errors![0]?.message).toBe("Not authorized!");
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

      setOptions({
        request: {
          headers: {
            authorization: `Bearer ${authFns.createToken({id: userID})}`,
          }
        }
      });

      response = await mutate(updateUserQuery, {
        variables: {updateUser, userID: otherUserID}
      });

      expect(response.errors).toBeDefined();
      expect(response.errors).toHaveLength(1);
      expect(response.errors![0]?.extensions?.code).toBe("FORBIDDEN");
      expect(response.errors![0]?.message).toBe("Can't update a different user");
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

        setOptions({
          request: {
            headers: {
              authorization: `Bearer ${authFns.createToken({id: userID})}`,
            }
          }
        });

        response = await mutate(updateUserQuery, {
          variables: {updateUser, userID}
        });
      });

      it('should not have any errors', () => {
        expect(response.errors).toBeUndefined();
      });

      it('should return updated information', () => {
        expect(response.data).toBeDefined();
        expect(response.data!.updateUser.id).toEqual(user._id.toString());
        expect(response.data!.updateUser.name).toBe("Updated name");
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

        setOptions({
          request: {
            headers: {
              authorization: `Bearer ${authFns.createToken({id: userID})}`,
            }
          }
        });

        response = await mutate(updateUserQuery, {
          variables: {updateUser, userID}
        });
      });

      it('should not have any errors', () => {
        expect(response.errors).toBeUndefined();
      });

      it('should return updated information', () => {
        expect(response.data).toBeDefined();
        expect(response.data!.updateUser.id).toEqual(user._id.toString());
        expect(response.data!.updateUser.name).toBe("Updated name");
      });

      it('should update the user in the database', async () => {
        const updatedUser = await UserModel.findById(user._id).select("+password");
        expect(updatedUser).not.toBeNull();
        expect(updatedUser!.name).toBe("Updated name");
        expect(updatedUser!.isValidPassword("newpassword")).resolves.toBe(true);
      });
    });
  });
});
