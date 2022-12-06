import { ApolloError } from "apollo-server-express";

export default class UnauthorizedError extends ApolloError {
    constructor(message: string) {
        super(message, 'UNAUTHORIZED');
        Object.defineProperty(this, 'name', { value: 'UnauthorizedError' });
    }
}