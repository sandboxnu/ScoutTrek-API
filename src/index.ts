import { expressMiddleware } from '@apollo/server/express4';
import { json } from 'body-parser';
import cors from 'cors';
import express from 'express';

import contextFn from './context';
import apolloServer from './server';

async function startServer() {
  let server = await apolloServer;
  if (server === undefined) {
    return;
  }
  await server.start();

  const app = express();
  app.use(
    '/graphql',
    cors<cors.CorsRequest>(),
    json(),
    expressMiddleware(server, {
      context: contextFn,
    })
  );

  const port = process.env.PORT || 4000;

  // await new Promise((resolve) => app.listen({ port }, resolve));
  await new Promise((resolve) => {
    const serverResponse = app.listen(port);
    resolve(serverResponse);
  });
  console.log(`🚀 Server ready at http://localhost:${port}/graphql`);
}

startServer();
