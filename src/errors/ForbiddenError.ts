import { ApolloError } from "apollo-server-express";

export default class ForbiddenError extends ApolloError {
    constructor(message: string) {
        super(message, 'FORBIDDEN');
        Object.defineProperty(this, 'name', { value: 'ForbiddenError' });
    }
}