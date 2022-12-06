// Models
import { ApolloServer, GraphQLResponse } from '@apollo/server';
import assert from 'assert';
import { gql } from 'graphql-tag';
import { ContextType } from 'src/context';
import { buildSchemaSync } from 'type-graphql';

import { UserModel } from '../../models/models';
import { TypegooseMiddleware } from '../../src/middleware/typegoose_middlware';
import { AuthResolver, SignupPayload } from '../../src/resolvers/auth';
import { PatrolResolver } from '../../src/resolvers/patrol';
import { TroopResolver } from '../../src/resolvers/troop';
import { UserResolver } from '../../src/resolvers/user';
import * as authFns from '../../src/utils/Auth';
import { setupDB } from '../test_setup';
import createTestContext from '../utils/test_context';

setupDB('scouttrek-test');

const schema = buildSchemaSync({
  resolvers: [AuthResolver, UserResolver, TroopResolver, PatrolResolver],
  globalMiddlewares: [TypegooseMiddleware],
  authChecker: authFns.customAuthChecker,
});

// Create GraphQL server
const server = new ApolloServer<ContextType>({
  schema,
});

describe("User signup", () => {
  describe("Create a new user", () => {
    let response: GraphQLResponse;

    beforeEach(async () => {
      const createUser = gql`
        mutation {
          signup(
            input: {
              name: "Test User"
              email: "test@example.com"
              password: "password"
              passwordConfirm: "password"
              phone: "1234567890"
              birthday: "2000-12-12"
            }
          ) {
            user {
              id
              name
              email
              phone
              birthday
            }
            token
            noGroups
          }
        }
      `;
      response = await server.executeOperation({
        query: createUser,
      }, {
        contextValue: await createTestContext(),
      });
    });

    test('correct fields should be returned', async () => {
      assert(response.body.kind === 'single');
      const signupResponse = response.body.singleResult.data?.signup as SignupPayload;
      const createdUser = signupResponse.user;
      expect(createdUser.name).toBe("Test User");
      expect(createdUser.email).toBe("test@example.com");
      expect(createdUser.phone).toBe("1234567890");
      expect(new Date(createdUser.birthday!).getTime()).toBe(new Date("2000-12-12").getTime());
    });

    test('user should be created in the db', async () => {
      assert(response.body.kind === 'single');
      const signupResponse = response.body.singleResult.data?.signup as any;
      const count = await UserModel.count({ _id: signupResponse.user.id });
      expect(count).toBe(1);
    });
  });
});
