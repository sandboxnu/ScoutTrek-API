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
import createTestContext from '../utils/test_context';
import { setupDB } from '../utils/test_setup';

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
      const createdUser = signupResponse.user as any; // Necessary because of renaming _id to id
      expect(createdUser.name).toBe("Test User");
      expect(createdUser.email).toBe("test@example.com");
      expect(createdUser.phone).toBe("1234567890");
      expect(new Date(createdUser.birthday!).getTime()).toBe(new Date("2000-12-12").getTime());
      expect(signupResponse.token).toBe(authFns.createToken({id: createdUser.id}));
      expect(signupResponse.noGroups).toBe(true);
    });

    test('user should be created in the db', async () => {
      assert(response.body.kind === 'single');
      const signupResponse = response.body.singleResult.data?.signup as any; // Necessary because of renaming _id to id
      const count = await UserModel.count({ _id: signupResponse.user.id });
      expect(count).toBe(1);
    });
  });

  it('should fail if passwords do not match', async () => {
    const createUser = gql`
      mutation {
        signup(
          input: {
            name: "Test User"
            email: "test@example.com"
            password: "password1"
            passwordConfirm: "password2"
            phone: "1234567890"
            birthday: "2000-12-12"
          }
        ) {
          token
        }
      }
    `;
    const result = await server.executeOperation({
      query: createUser,
    }, {
      contextValue: await createTestContext()
    });
    assert(result.body.kind === "single");
    expect(result.body.singleResult.errors).toHaveLength(1);
    expect(result.body.singleResult.errors![0]?.message).toBe("User validation failed: passwordConfirm: Passwords do not match")
  });
});
